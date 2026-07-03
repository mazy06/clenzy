package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationExecution;
import com.clenzy.model.AutomationExecutionStatus;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Guest;
import com.clenzy.model.NoiseAlert;
import com.clenzy.model.NoiseAlertConfig;
import com.clenzy.model.NoiseAlertTimeWindow;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.model.SystemEmailTemplate;
import com.clenzy.model.User;
import com.clenzy.repository.AutomationExecutionRepository;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.NoiseAlertConfigRepository;
import com.clenzy.repository.NoiseAlertRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
import com.clenzy.repository.SystemEmailTemplateRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.EmailService;
import com.clenzy.service.NoiseAlertService;
import com.clenzy.service.agent.supervision.SupervisionActionType;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Scenario S2 — incident bruit : 3 alertes en 24 h → UN SEUL message voyageur
 * (claim Redis atomique) → escalade par condition numerique
 * ({@code alertsLast24h >= 3}) → NOTIFY_STAFF + suggestion de blocage calendrier
 * → apply de la suggestion → {@code CalendarEngine.block} effectif (CalendarDay
 * BLOCKED en base).
 *
 * <p>Frontiere externe mockee : {@link EmailService} uniquement (SMTP). Le
 * pipeline claim/templates/moteur/conditions/apply est REEL.</p>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true")
class ScenarioNoiseIncidentIT extends AbstractIntegrationTest {

    @Autowired private NoiseAlertService noiseAlertService;
    @Autowired private SupervisionSuggestionService suggestionService;

    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private ReservationRepository reservationRepository;
    @Autowired private GuestRepository guestRepository;
    @Autowired private NoiseAlertRepository noiseAlertRepository;
    @Autowired private NoiseAlertConfigRepository noiseAlertConfigRepository;
    @Autowired private AutomationRuleRepository ruleRepository;
    @Autowired private AutomationExecutionRepository executionRepository;
    @Autowired private SupervisionSuggestionRepository suggestionRepository;
    @Autowired private CalendarDayRepository calendarDayRepository;
    @Autowired private SystemEmailTemplateRepository systemEmailTemplateRepository;

    @MockBean private EmailService emailService;

    private Long orgAId;
    private Long orgBId;
    private Long propertyId;

    @BeforeEach
    void seedNoiseSetup() {
        String salt = UUID.randomUUID().toString().substring(0, 8);
        orgAId = organizationRepository.save(new Organization(
                "Noise A " + salt, OrganizationType.INDIVIDUAL, "noise-a-" + salt)).getId();
        orgBId = organizationRepository.save(new Organization(
                "Noise B " + salt, OrganizationType.INDIVIDUAL, "noise-b-" + salt)).getId();

        User owner = new User("Nora", "Noise", "nora." + salt + "@test.com", "password123");
        owner.setOrganizationId(orgAId);
        owner.setKeycloakId("kc-noise-" + salt);
        owner = userRepository.save(owner);

        Property property = new Property("Loft Sonore " + salt, "3 rue du Bruit", 2, 1, owner);
        property.setOrganizationId(orgAId);
        property.setNightlyPrice(new BigDecimal("110.00"));
        propertyId = propertyRepository.save(property).getId();

        // Config bruit : fenetre couvrant toute la journee, cooldown 0 (le test
        // enchaine 3 alertes), pas de message guest par la config (c'est la
        // REGLE SEND_NOISE_WARNING qui envoie — le claim est partage entre les 2 chemins).
        NoiseAlertConfig config = new NoiseAlertConfig();
        config.setOrganizationId(orgAId);
        config.setPropertyId(propertyId);
        config.setEnabled(true);
        config.setNotifyInApp(false);
        config.setNotifyEmail(false);
        config.setNotifyGuestMessage(false);
        config.setCooldownMinutes(0);
        NoiseAlertTimeWindow window = new NoiseAlertTimeWindow();
        window.setConfig(config);
        window.setLabel("Journee complete");
        window.setStartTime(LocalTime.MIN);
        window.setEndTime(LocalTime.of(23, 59, 59));
        window.setWarningThresholdDb(60);
        window.setCriticalThresholdDb(75);
        config.getTimeWindows().add(window);
        noiseAlertConfigRepository.save(config);

        // Sejour EN COURS (aujourd'hui) avec voyageur joignable par email.
        Guest guest = new Guest("Gaspard", "Guest", orgAId);
        guest.setEmail("gaspard.guest@test.com");
        guest = guestRepository.save(guest);
        Reservation stay = new Reservation();
        stay.setOrganizationId(orgAId);
        stay.setProperty(propertyRepository.findById(propertyId).orElseThrow());
        stay.setCheckIn(LocalDate.now().minusDays(1));
        stay.setCheckOut(LocalDate.now().plusDays(2));
        stay.setStatus("confirmed");
        stay.setGuest(guest);
        reservationRepository.save(stay);

        // Template systeme d'email voyageur (schema create-drop : les seeds
        // Liquibase n'existent pas en test → on seed le template nous-memes).
        SystemEmailTemplate template = new SystemEmailTemplate();
        template.setTemplateKey("noise_alert_guest");
        template.setLanguage("fr");
        template.setRecipientType("GUEST");
        template.setSubject("Un peu de calme a {propertyName}");
        template.setBody("Bonjour {guestName}, le niveau sonore est eleve.");
        template.setWrapperStyle("NOTIFICATION_OWNER");
        template.setSystem(true);
        systemEmailTemplateRepository.save(template);

        // Regles moteur : avertissement guest (chaque alerte), escalade staff et
        // suggestion de blocage (condition numerique >= 3 alertes / 24 h).
        seedRule(orgAId, "Avertir voyageur", AutomationAction.SEND_NOISE_WARNING, null);
        seedRule(orgAId, "Escalade staff", AutomationAction.NOTIFY_STAFF,
                "{\"alertsLast24h\": {\"gte\": 3}}");
        seedRule(orgAId, "Suggestion blocage", AutomationAction.SUGGEST_CALENDAR_BLOCK,
                "{\"alertsLast24h\": {\"gte\": 3}}");

        setupTenantContext(orgAId, false);
    }

    private void seedRule(Long orgId, String name, AutomationAction action, String conditions) {
        AutomationRule rule = new AutomationRule();
        rule.setOrganizationId(orgId);
        rule.setName(name);
        rule.setEnabled(true);
        rule.setTriggerType(AutomationTrigger.NOISE_ALERT);
        rule.setActionType(action);
        rule.setConditions(conditions);
        ruleRepository.save(rule);
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

    @Test
    void threeNoiseAlerts_singleGuestMessage_escalation_thenAppliedCalendarBlock() {
        // ── 3 alertes bruit critiques dans la fenetre 24 h. ──
        NoiseAlert first = noiseAlertService.evaluateNoiseLevel(
                orgAId, propertyId, null, 92.0, NoiseAlert.AlertSource.WEBHOOK);
        NoiseAlert second = noiseAlertService.evaluateNoiseLevel(
                orgAId, propertyId, null, 95.0, NoiseAlert.AlertSource.WEBHOOK);
        NoiseAlert third = noiseAlertService.evaluateNoiseLevel(
                orgAId, propertyId, null, 98.0, NoiseAlert.AlertSource.WEBHOOK);
        assertThat(first).isNotNull();
        assertThat(second).isNotNull();
        assertThat(third).isNotNull();

        // ── UN SEUL message voyageur (claim Redis) : 1 EXECUTED, 2 SKIPPED. ──
        List<AutomationExecution> warnings = executionsFor(orgAId, AutomationAction.SEND_NOISE_WARNING);
        assertThat(warnings).hasSize(3);
        assertThat(warnings.stream()
                .filter(e -> e.getStatus() == AutomationExecutionStatus.EXECUTED)).hasSize(1);
        assertThat(warnings.stream()
                .filter(e -> e.getStatus() == AutomationExecutionStatus.SKIPPED)).hasSize(2);
        // Et un seul email est parti (repli email : WhatsApp non configure).
        verify(emailService, times(1)).sendContactMessage(
                eq("gaspard.guest@test.com"), anyString(), any(), any(), anyString(), anyString(), anyList());
        NoiseAlert refreshedFirst = noiseAlertRepository.findById(first.getId()).orElseThrow();
        assertThat(refreshedFirst.isNotifiedGuest()).isTrue();

        // ── Escalade (condition numerique) : seulement a la 3e alerte. ──
        List<AutomationExecution> staffNotifications = executionsFor(orgAId, AutomationAction.NOTIFY_STAFF);
        assertThat(staffNotifications).hasSize(1);
        assertThat(staffNotifications.get(0).getStatus()).isEqualTo(AutomationExecutionStatus.EXECUTED);
        assertThat(staffNotifications.get(0).getSubjectId()).isEqualTo(third.getId());

        // ── Suggestion de blocage calendrier creee (HITL — jamais d'auto-block). ──
        List<SupervisionSuggestion> suggestions = suggestionRepository.findAll().stream()
                .filter(s -> orgAId.equals(s.getOrganizationId()))
                .filter(s -> SupervisionActionType.CALENDAR_BLOCK.equals(s.getActionType()))
                .toList();
        assertThat(suggestions).hasSize(1);
        SupervisionSuggestion suggestion = suggestions.get(0);
        assertThat(suggestion.getStatus()).isEqualTo(SupervisionSuggestion.STATUS_PENDING);
        assertThat(suggestion.getPropertyId()).isEqualTo(propertyId);
        // Aucun jour bloque tant que l'operateur n'a pas applique.
        assertThat(calendarDayRepository.findAll().stream()
                .filter(d -> propertyId.equals(d.getProperty() != null ? d.getProperty().getId() : null))
                .filter(d -> d.getStatus() == CalendarDayStatus.BLOCKED)).isEmpty();

        // ── Apply de la suggestion → CalendarEngine.block EFFECTIF. ──
        suggestionService.apply(orgAId, suggestion.getId());

        assertThat(suggestionRepository.findById(suggestion.getId()).orElseThrow().getStatus())
                .isEqualTo(SupervisionSuggestion.STATUS_APPLIED);
        long blockedDays = calendarDayRepository.findAll().stream()
                .filter(d -> propertyId.equals(d.getProperty() != null ? d.getProperty().getId() : null))
                .filter(d -> d.getStatus() == CalendarDayStatus.BLOCKED)
                .count();
        assertThat(blockedDays).isEqualTo(7); // {"days": 7} — [aujourd'hui, +7)

        // ── Zero-fuite : rien chez l'org B. ──
        assertThat(executionRepository.findAll().stream()
                .filter(e -> orgBId.equals(e.getOrganizationId()))).isEmpty();
        assertThat(suggestionRepository.findAll().stream()
                .filter(s -> orgBId.equals(s.getOrganizationId()))).isEmpty();
    }

    @Test
    void belowThresholdOrDisabledConfig_neverCreatesAlert() {
        // Sous le seuil warning → aucune alerte, aucun trigger.
        NoiseAlert none = noiseAlertService.evaluateNoiseLevel(
                orgAId, propertyId, null, 40.0, NoiseAlert.AlertSource.WEBHOOK);
        assertThat(none).isNull();
        assertThat(executionsFor(orgAId, AutomationAction.SEND_NOISE_WARNING)).isEmpty();
    }
}
