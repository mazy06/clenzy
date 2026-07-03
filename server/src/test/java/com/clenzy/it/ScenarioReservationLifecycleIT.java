package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationExecution;
import com.clenzy.model.AutomationExecutionStatus;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.CleaningFrequency;
import com.clenzy.model.Guest;
import com.clenzy.model.GuestReview;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.Property;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.ServiceType;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.model.User;
import com.clenzy.repository.AutomationExecutionRepository;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.repository.MessageTemplateRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.agent.supervision.SupervisionActionType;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.clenzy.service.messaging.AutomationSchedulerService;
import com.clenzy.service.messaging.GuestMessagingService;
import com.clenzy.testkit.MutableClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Scenario S1 — cycle de vie complet d'une reservation, moteur d'automatisations
 * REEL sur base Testcontainers, horloge {@link MutableClock} (jamais de sleep) :
 *
 * <ol>
 *   <li>RESERVATION_BOOKED → menage cree au checkout (heure + fuseau
 *       Pacific/Auckland corrects) + idempotence au rejeu ;</li>
 *   <li>RESERVATION_CANCELLED → menage lie annule ;</li>
 *   <li>Sweep scheduler + avance d'horloge : demande d'avis SKIPPED si un avis
 *       existe, envoyee sinon ; revocation du code d'acces re-planifiee avant
 *       checkout+4h puis executee apres ; suggestion de liberation de caution
 *       creee a J+2.</li>
 * </ol>
 *
 * <p>Anti-fuite : l'org B a la meme regle BOOKED — aucun effet chez elle quand
 * l'org A declenche.</p>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true")
class ScenarioReservationLifecycleIT extends AbstractIntegrationTest {

    private static final ZoneId AUCKLAND = ZoneId.of("Pacific/Auckland");
    /** Base temporelle du scenario (hiver NZ, UTC+12 — pas d'ambiguite DST). */
    private static final Instant T0 = Instant.parse("2026-08-10T00:00:00Z");
    private static final LocalDate CHECK_IN = LocalDate.of(2026, 8, 12);
    private static final LocalDate CHECK_OUT = LocalDate.of(2026, 8, 15);

    @TestConfiguration
    static class FixedClockConfig {
        /**
         * {@link MutableClock} EST un {@link Clock} : le @Primary remplace le
         * bean {@code Clock.systemUTC()} de ClockConfig dans tout le contexte.
         */
        @Bean
        @Primary
        MutableClock mutableClock() {
            return MutableClock.utc(T0);
        }
    }

    @Autowired private AutomationEngine automationEngine;
    @Autowired private AutomationSchedulerService automationSchedulerService;
    @Autowired private MutableClock clock;

    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private ReservationRepository reservationRepository;
    @Autowired private GuestRepository guestRepository;
    @Autowired private AutomationRuleRepository ruleRepository;
    @Autowired private AutomationExecutionRepository executionRepository;
    @Autowired private ServiceRequestRepository serviceRequestRepository;
    @Autowired private GuestReviewRepository guestReviewRepository;
    @Autowired private SecurityDepositRepository securityDepositRepository;
    @Autowired private SupervisionSuggestionRepository suggestionRepository;
    @Autowired private MessageTemplateRepository messageTemplateRepository;
    @Autowired private CheckInInstructionsRepository checkInInstructionsRepository;
    @Autowired private com.clenzy.repository.WelcomeGuideRepository welcomeGuideRepository;

    /** Frontiere externe (emails/WhatsApp guests) : mockee, le pipeline reste reel. */
    @MockBean private GuestMessagingService guestMessagingService;

    private Long orgAId;
    private Long orgBId;
    private User ownerA;
    private Property propertyA;

    @BeforeEach
    void seedOrganizationsAndProperty() {
        clock.setInstant(T0);

        String salt = UUID.randomUUID().toString().substring(0, 8);
        orgAId = organizationRepository.save(new Organization(
                "Lifecycle A " + salt, OrganizationType.INDIVIDUAL, "lifecycle-a-" + salt)).getId();
        orgBId = organizationRepository.save(new Organization(
                "Lifecycle B " + salt, OrganizationType.INDIVIDUAL, "lifecycle-b-" + salt)).getId();

        ownerA = new User("Ana", "Kiwi", "ana." + salt + "@test.com", "password123");
        ownerA.setOrganizationId(orgAId);
        ownerA.setKeycloakId("kc-lc-a-" + salt);
        ownerA = userRepository.save(ownerA);

        User ownerB = new User("Bea", "Kiwi", "bea." + salt + "@test.com", "password123");
        ownerB.setOrganizationId(orgBId);
        ownerB.setKeycloakId("kc-lc-b-" + salt);
        ownerB = userRepository.save(ownerB);

        // Propriete en fuseau exotique (anti-timezone-bug).
        propertyA = new Property("Bach Auckland " + salt, "1 Queen St", 2, 1, ownerA);
        propertyA.setOrganizationId(orgAId);
        propertyA.setNightlyPrice(new BigDecimal("120.00"));
        propertyA.setTimezone("Pacific/Auckland");
        propertyA.setDefaultCheckOutTime("10:00");
        propertyA.setCleaningFrequency(CleaningFrequency.AFTER_EACH_STAY);
        propertyA.setCleaningBasePrice(new BigDecimal("60.00"));
        propertyA = propertyRepository.save(propertyA);

        Property propertyB = new Property("Villa B " + salt, "2 rue B", 2, 1, ownerB);
        propertyB.setOrganizationId(orgBId);
        propertyB.setNightlyPrice(new BigDecimal("100.00"));
        propertyB.setCleaningFrequency(CleaningFrequency.AFTER_EACH_STAY);
        propertyRepository.save(propertyB);

        // Regle BOOKED identique dans les DEUX orgs (preuve de zero-fuite).
        seedRule(orgAId, "Menage auto A", AutomationTrigger.RESERVATION_BOOKED,
                AutomationAction.CREATE_CLEANING_REQUEST, 0, null, null);
        seedRule(orgBId, "Menage auto B", AutomationTrigger.RESERVATION_BOOKED,
                AutomationAction.CREATE_CLEANING_REQUEST, 0, null, null);
        seedRule(orgAId, "Annulation menage A", AutomationTrigger.RESERVATION_CANCELLED,
                AutomationAction.CANCEL_LINKED_CLEANING_REQUEST, 0, null, null);

        setupTenantContext(orgAId, false);
    }

    private AutomationRule seedRule(Long orgId, String name, AutomationTrigger trigger,
                                    AutomationAction action, int offsetDays,
                                    String actionConfig, MessageTemplate template) {
        AutomationRule rule = new AutomationRule();
        rule.setOrganizationId(orgId);
        rule.setName(name);
        rule.setEnabled(true);
        rule.setTriggerType(trigger);
        rule.setActionType(action);
        rule.setTriggerOffsetDays(offsetDays);
        rule.setTriggerTime("09:00");
        rule.setActionConfig(actionConfig);
        rule.setTemplate(template);
        return ruleRepository.save(rule);
    }

    private Reservation seedReservation(Property property, Long orgId, Guest guest) {
        Reservation reservation = new Reservation();
        reservation.setOrganizationId(orgId);
        reservation.setProperty(property);
        reservation.setCheckIn(CHECK_IN);
        reservation.setCheckOut(CHECK_OUT);
        reservation.setStatus("confirmed");
        reservation.setGuest(guest);
        return reservationRepository.save(reservation);
    }

    private void fire(AutomationTrigger trigger, Long orgId, Long reservationId) {
        automationEngine.fireTrigger(trigger, orgId,
                new AutomationSubject(AutomationSubject.TYPE_RESERVATION, reservationId, Map.of()));
    }

    private List<AutomationExecution> executionsFor(Long orgId, AutomationAction action) {
        // Le rule du proxy est lazy et la session est fermee : on resout les ids
        // de regles par action AVANT de filtrer (jamais de deref du proxy).
        java.util.Set<Long> ruleIds = ruleRepository.findAll().stream()
                .filter(r -> r.getActionType() == action)
                .map(AutomationRule::getId)
                .collect(java.util.stream.Collectors.toSet());
        return executionRepository.findAll().stream()
                .filter(e -> orgId.equals(e.getOrganizationId()))
                .filter(e -> e.getAutomationRule() != null
                        && ruleIds.contains(e.getAutomationRule().getId()))
                .toList();
    }

    // ─── 1. BOOKED → menage au checkout, fuseau correct, idempotent ─────────

    @Test
    void reservationBooked_createsCleaningAtCheckoutInPropertyTimezone_idempotently() {
        Reservation reservation = seedReservation(propertyA, orgAId, null);

        fire(AutomationTrigger.RESERVATION_BOOKED, orgAId, reservation.getId());

        // Menage cree : jour du checkout a l'heure de checkout de la propriete
        // (10:00, heure LOCALE Pacific/Auckland — pas une conversion serveur).
        ServiceRequest sr = serviceRequestRepository.findByAutoFlowKey(
                "AUTO_CLEANING:" + propertyA.getId() + ":" + CHECK_IN + ":" + CHECK_OUT, orgAId)
                .orElseThrow();
        assertThat(sr.getServiceType()).isEqualTo(ServiceType.CLEANING);
        assertThat(sr.getStatus()).isEqualTo(RequestStatus.PENDING);
        assertThat(sr.getDesiredDate())
                .isEqualTo(LocalDateTime.of(CHECK_OUT, LocalTime.of(10, 0)));

        List<AutomationExecution> executions = executionsFor(orgAId, AutomationAction.CREATE_CLEANING_REQUEST);
        assertThat(executions).hasSize(1);
        assertThat(executions.get(0).getStatus()).isEqualTo(AutomationExecutionStatus.EXECUTED);

        // Idempotence : rejouer l'evenement (redelivery Kafka) → zero doublon.
        fire(AutomationTrigger.RESERVATION_BOOKED, orgAId, reservation.getId());
        assertThat(executionsFor(orgAId, AutomationAction.CREATE_CLEANING_REQUEST)).hasSize(1);
        long cleanings = serviceRequestRepository.findAll().stream()
                .filter(s -> orgAId.equals(s.getOrganizationId()))
                .filter(s -> s.getServiceType() == ServiceType.CLEANING)
                .count();
        assertThat(cleanings).isEqualTo(1);

        // Zero-fuite : la regle jumelle de l'org B n'a rien execute.
        assertThat(executionRepository.findAll().stream()
                .filter(e -> orgBId.equals(e.getOrganizationId()))).isEmpty();
    }

    // ─── 2. CANCELLED → menage lie annule ───────────────────────────────────

    @Test
    void reservationCancelled_cancelsLinkedCleaningRequest() {
        Reservation reservation = seedReservation(propertyA, orgAId, null);
        fire(AutomationTrigger.RESERVATION_BOOKED, orgAId, reservation.getId());
        ServiceRequest created = serviceRequestRepository.findByAutoFlowKey(
                "AUTO_CLEANING:" + propertyA.getId() + ":" + CHECK_IN + ":" + CHECK_OUT, orgAId)
                .orElseThrow();

        fire(AutomationTrigger.RESERVATION_CANCELLED, orgAId, reservation.getId());

        ServiceRequest cancelled = serviceRequestRepository.findById(created.getId()).orElseThrow();
        assertThat(cancelled.getStatus()).isEqualTo(RequestStatus.CANCELLED);
        // La cle est suffixee → une re-reservation des memes dates recree un menage.
        assertThat(cancelled.getAutoFlowKey()).contains(":CANCELLED:");

        List<AutomationExecution> cancels =
                executionsFor(orgAId, AutomationAction.CANCEL_LINKED_CLEANING_REQUEST);
        assertThat(cancels).hasSize(1);
        assertThat(cancels.get(0).getStatus()).isEqualTo(AutomationExecutionStatus.EXECUTED);
    }

    // ─── 3. Horloge + sweep : avis / revocation +4h / caution J+2 ───────────

    @Test
    void clockDrivenSweep_reviewSkipOrSend_revokeAfterGrace_depositSuggestionAtJPlus2() {
        // Template requis par le pipeline messaging guest.
        MessageTemplate template = new MessageTemplate();
        template.setOrganizationId(orgAId);
        template.setName("Demande avis IT");
        template.setType(MessageTemplateType.CUSTOM);
        template.setSubject("Votre avis compte");
        template.setBody("Bonjour {guestName}, laissez-nous un avis !");
        template = messageTemplateRepository.save(template);

        seedRule(orgAId, "Avis J0", AutomationTrigger.REVIEW_REMINDER,
                AutomationAction.SEND_REVIEW_REQUEST, 0, null, template);
        seedRule(orgAId, "Revocation code +4h", AutomationTrigger.CHECK_OUT_PASSED,
                AutomationAction.REVOKE_ACCESS_CODE, 0, "{\"graceHours\": 4}", null);
        seedRule(orgAId, "Caution J+2", AutomationTrigger.CHECK_OUT_PASSED,
                AutomationAction.SUGGEST_DEPOSIT_RELEASE, 2, null, null);

        // Code statique → la revocation a un effet reel (rotation du code).
        CheckInInstructions instructions = new CheckInInstructions();
        instructions.setProperty(propertyA);
        instructions.setOrganizationId(orgAId);
        instructions.setAccessCode("4321");
        checkInInstructionsRepository.save(instructions);

        Guest guestWithReview = guestRepository.save(new Guest("Rita", "Reviewer", orgAId));
        Guest guestSilent = new Guest("Sam", "Silent", orgAId);
        guestSilent.setEmail("sam.silent@test.com");
        guestSilent = guestRepository.save(guestSilent);

        Reservation reviewed = seedReservation(propertyA, orgAId, guestWithReview);
        // 2e sejour sur un AUTRE bien de la meme org (meme dates).
        Property propertyA2 = new Property("Bach Auckland 2", "2 Queen St", 1, 1, ownerA);
        propertyA2.setOrganizationId(orgAId);
        propertyA2.setNightlyPrice(new BigDecimal("90.00"));
        propertyA2.setTimezone("Pacific/Auckland");
        propertyA2.setDefaultCheckOutTime("10:00");
        propertyA2 = propertyRepository.save(propertyA2);
        Reservation silent = seedReservation(propertyA2, orgAId, guestSilent);

        // Avis existant pour la 1re reservation → la relance d'avis sera SKIPPED.
        GuestReview review = new GuestReview();
        review.setOrganizationId(orgAId);
        review.setPropertyId(propertyA.getId());
        review.setReservationId(reviewed.getId());
        review.setChannelName(ChannelName.AIRBNB);
        review.setGuestName("Rita");
        review.setRating(5);
        review.setReviewDate(CHECK_OUT);
        guestReviewRepository.save(review);

        // Caution encore retenue pour la 1re reservation.
        SecurityDeposit deposit = new SecurityDeposit();
        deposit.setOrganizationId(orgAId);
        deposit.setReservationId(reviewed.getId());
        deposit.setAmount(new BigDecimal("300.00"));
        deposit.setCurrency("EUR");
        deposit.setStatus(SecurityDepositStatus.HELD);
        securityDepositRepository.save(deposit);

        // La demande d'avis exige un livret d'accueil PUBLIE sur le logement
        // (le lien {reviewLink} est adosse a un token de livret).
        com.clenzy.model.WelcomeGuide guide = new com.clenzy.model.WelcomeGuide();
        guide.setOrganizationId(orgAId);
        guide.setProperty(propertyA2);
        guide.setTitle("Livret Bach Auckland 2");
        guide.setPublished(true);
        welcomeGuideRepository.save(guide);

        // Le sweep tourne comme en production : thread scheduler SANS contexte
        // tenant (TenantScopedExecutor refuse les contextes imbriques).
        tenantContext.setOrganizationId(null);

        // ── T1 : jour du checkout, 13:00 Auckland (apres l'heure d'avis 09:00,
        //    avant checkout 10:00 + grace 4h = 14:00). ──
        clock.setInstant(ZonedDateTime.of(CHECK_OUT, LocalTime.of(13, 0), AUCKLAND).toInstant());
        automationSchedulerService.processScheduledAutomations();

        // Avis : SKIPPED pour la resa avec avis, EXECUTED (envoi reel via le
        // pipeline mocke en frontiere) pour l'autre.
        List<AutomationExecution> reviewExecs = executionsFor(orgAId, AutomationAction.SEND_REVIEW_REQUEST);
        assertThat(reviewExecs).hasSize(2);
        Map<Long, AutomationExecutionStatus> reviewBySubject = Map.of(
                reviewExecs.get(0).getSubjectId(), reviewExecs.get(0).getStatus(),
                reviewExecs.get(1).getSubjectId(), reviewExecs.get(1).getStatus());
        assertThat(reviewBySubject.get(reviewed.getId())).isEqualTo(AutomationExecutionStatus.SKIPPED);
        assertThat(reviewBySubject.get(silent.getId())).isEqualTo(AutomationExecutionStatus.EXECUTED);
        verify(guestMessagingService).sendForReservationViaChannel(
                org.mockito.ArgumentMatchers.argThat(r -> r.getId().equals(silent.getId())),
                any(MessageTemplate.class), anyLong(), any(), anyMap());

        // Revocation : PAS avant checkout+4h — l'execution est planifiee/replanifiee
        // au moment exact de revocation (14:00 Auckland), toujours PENDING.
        List<AutomationExecution> revokeExecs = executionsFor(orgAId, AutomationAction.REVOKE_ACCESS_CODE);
        assertThat(revokeExecs).isNotEmpty();
        assertThat(revokeExecs).allMatch(e -> e.getStatus() == AutomationExecutionStatus.PENDING);
        String codeBefore = checkInInstructionsRepository
                .findByPropertyIdAndOrganizationId(propertyA.getId(), orgAId)
                .orElseThrow().getAccessCode();
        assertThat(codeBefore).isEqualTo("4321");

        // ── T2 : 15:00 Auckland (checkout+5h > grace) → drain → revocation executee. ──
        clock.setInstant(ZonedDateTime.of(CHECK_OUT, LocalTime.of(15, 0), AUCKLAND).toInstant());
        automationSchedulerService.processScheduledAutomations();

        AutomationExecution revokeForReviewed = executionsFor(orgAId, AutomationAction.REVOKE_ACCESS_CODE)
                .stream().filter(e -> reviewed.getId().equals(e.getSubjectId()))
                .findFirst().orElseThrow();
        assertThat(revokeForReviewed.getStatus()).isEqualTo(AutomationExecutionStatus.EXECUTED);
        String codeAfter = checkInInstructionsRepository
                .findByPropertyIdAndOrganizationId(propertyA.getId(), orgAId)
                .orElseThrow().getAccessCode();
        assertThat(codeAfter).isNotEqualTo("4321"); // code statique tourne

        // Caution : rien avant J+2.
        assertThat(suggestionRepository.findAll().stream()
                .filter(s -> orgAId.equals(s.getOrganizationId()))
                .filter(s -> SupervisionActionType.DEPOSIT_RELEASE.equals(s.getActionType())))
                .isEmpty();

        // ── T3 : J+2 10:00 Auckland → drain → suggestion de liberation creee. ──
        clock.setInstant(ZonedDateTime.of(CHECK_OUT.plusDays(2), LocalTime.of(10, 0), AUCKLAND).toInstant());
        automationSchedulerService.processScheduledAutomations();

        List<SupervisionSuggestion> depositSuggestions = suggestionRepository.findAll().stream()
                .filter(s -> orgAId.equals(s.getOrganizationId()))
                .filter(s -> SupervisionActionType.DEPOSIT_RELEASE.equals(s.getActionType()))
                .toList();
        assertThat(depositSuggestions).hasSize(1);
        SupervisionSuggestion suggestion = depositSuggestions.get(0);
        assertThat(suggestion.getStatus()).isEqualTo(SupervisionSuggestion.STATUS_PENDING);
        assertThat(suggestion.getReservationId()).isEqualTo(reviewed.getId());
        assertThat(suggestion.getPropertyId()).isEqualTo(propertyA.getId());
        // La resa sans caution est SKIPPED, jamais de suggestion parasite.
        AutomationExecution depositForSilent = executionsFor(orgAId, AutomationAction.SUGGEST_DEPOSIT_RELEASE)
                .stream().filter(e -> silent.getId().equals(e.getSubjectId()))
                .findFirst().orElseThrow();
        assertThat(depositForSilent.getStatus()).isEqualTo(AutomationExecutionStatus.SKIPPED);

        // Zero-fuite : l'org B n'a strictement aucune execution.
        assertThat(executionRepository.findAll().stream()
                .filter(e -> orgBId.equals(e.getOrganizationId()))).isEmpty();
        verify(guestMessagingService, never()).sendForReservationViaChannel(
                org.mockito.ArgumentMatchers.argThat(r -> r.getId().equals(reviewed.getId())),
                any(), anyLong(), any(), anyMap());
    }
}
