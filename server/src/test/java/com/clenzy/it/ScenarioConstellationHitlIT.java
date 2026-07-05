package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.dto.SupervisionActivitySnapshotDto;
import com.clenzy.dto.SupervisionSuggestionDto;
import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.Guest;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.model.User;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Scénario : un flux DÉTERMINISTE (règle du hub, sans IA) doit produire une
 * CARTE HITL visible dans la Constellation.
 *
 * <p>Chaîne prouvée : règle {@code RESERVATION_CANCELLED → SUGGEST_DEPOSIT_REFUND}
 * (caution HELD) → {@code fireTrigger} → l'exécuteur crée une suggestion
 * actionnable → elle est renvoyée par {@link SupervisionSuggestionService#list}
 * (la SOURCE exacte des cartes HITL de la Constellation) → et le moteur écrit une
 * entrée dans le journal de la Constellation ({@link SupervisionActivityService},
 * domaine « fin »). Anti-fuite : une 2ᵉ org avec la même règle mais sans
 * événement ne reçoit AUCUNE carte.</p>
 */
class ScenarioConstellationHitlIT extends AbstractIntegrationTest {

    @Autowired private AutomationEngine automationEngine;
    @Autowired private SupervisionSuggestionService suggestionService;
    @Autowired private SupervisionActivityService activityService;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private ReservationRepository reservationRepository;
    @Autowired private GuestRepository guestRepository;
    @Autowired private AutomationRuleRepository ruleRepository;
    @Autowired private SecurityDepositRepository securityDepositRepository;

    private Long orgAId;
    private Long orgBId;
    private Property propertyA;
    private Property propertyB;
    private Reservation reservationA;

    @BeforeEach
    void seed() {
        String salt = UUID.randomUUID().toString().substring(0, 8);

        orgAId = organizationRepository.save(new Organization(
                "HITL A " + salt, OrganizationType.INDIVIDUAL, "hitl-a-" + salt)).getId();
        orgBId = organizationRepository.save(new Organization(
                "HITL B " + salt, OrganizationType.INDIVIDUAL, "hitl-b-" + salt)).getId();

        User ownerA = new User("Ana", "Kiwi", "ana." + salt + "@test.com", "password123");
        ownerA.setOrganizationId(orgAId);
        ownerA.setKeycloakId("kc-hitl-a-" + salt);
        ownerA = userRepository.save(ownerA);

        User ownerB = new User("Bea", "Kiwi", "bea." + salt + "@test.com", "password123");
        ownerB.setOrganizationId(orgBId);
        ownerB.setKeycloakId("kc-hitl-b-" + salt);
        ownerB = userRepository.save(ownerB);

        propertyA = new Property("Bach A " + salt, "1 Queen St", 2, 1, ownerA);
        propertyA.setOrganizationId(orgAId);
        propertyA.setNightlyPrice(new BigDecimal("120.00"));
        propertyA = propertyRepository.save(propertyA);

        propertyB = new Property("Villa B " + salt, "2 rue B", 2, 1, ownerB);
        propertyB.setOrganizationId(orgBId);
        propertyB.setNightlyPrice(new BigDecimal("100.00"));
        propertyB = propertyRepository.save(propertyB);

        // Même règle actionnable dans les DEUX orgs (preuve d'isolation).
        seedRefundRule(orgAId);
        seedRefundRule(orgBId);

        Guest guest = guestRepository.save(new Guest("Sam", "Guest", orgAId));
        reservationA = new Reservation();
        reservationA.setOrganizationId(orgAId);
        reservationA.setProperty(propertyA);
        reservationA.setCheckIn(LocalDate.of(2026, 7, 1));
        reservationA.setCheckOut(LocalDate.of(2026, 7, 4));
        reservationA.setStatus("cancelled");
        reservationA.setGuest(guest);
        reservationA = reservationRepository.save(reservationA);

        // Caution encore retenue → il y a bien quelque chose à suggérer de rembourser.
        SecurityDeposit deposit = new SecurityDeposit();
        deposit.setOrganizationId(orgAId);
        deposit.setReservationId(reservationA.getId());
        deposit.setAmount(new BigDecimal("300.00"));
        deposit.setCurrency("EUR");
        deposit.setStatus(SecurityDepositStatus.HELD);
        securityDepositRepository.save(deposit);
    }

    private void seedRefundRule(Long orgId) {
        AutomationRule rule = new AutomationRule();
        rule.setOrganizationId(orgId);
        rule.setName("Annulation → suggérer remboursement caution");
        rule.setEnabled(true);
        rule.setTriggerType(AutomationTrigger.RESERVATION_CANCELLED);
        rule.setActionType(AutomationAction.SUGGEST_DEPOSIT_REFUND);
        rule.setTriggerTime("09:00");
        ruleRepository.save(rule);
    }

    @Test
    void deterministicSuggestRule_producesHitlCardAndConstellationFeed() {
        // Le flux déterministe se déclenche (aucune IA, aucun token).
        automationEngine.fireTrigger(AutomationTrigger.RESERVATION_CANCELLED, orgAId,
                new AutomationSubject(AutomationSubject.TYPE_RESERVATION, reservationA.getId(), Map.of()));

        // 1) La carte HITL arrive dans la Constellation (source = suggestionService.list).
        List<SupervisionSuggestionDto> cards = suggestionService.list(orgAId, propertyA.getId());
        assertThat(cards).hasSize(1);
        SupervisionSuggestionDto card = cards.get(0);
        assertThat(card.actionType()).isEqualTo("DEPOSIT_REFUND"); // carte « Appliquer », actionnable
        assertThat(card.agentId()).isEqualTo("fin");               // domaine Finance
        assertThat(card.reservationId()).isEqualTo(reservationA.getId());
        assertThat(card.title()).isNotBlank();

        // 2) Le journal de la Constellation reflète le flux déterministe (mon câblage).
        setupTenantContext(orgAId, false);
        SupervisionActivitySnapshotDto snap = activityService.getSnapshot(propertyA.getId());
        assertThat(snap.feed()).isNotEmpty();
        assertThat(snap.feed().get(0).agentId()).isEqualTo("fin");
        assertThat(snap.autoActions()).isGreaterThanOrEqualTo(1);

        // 3) Anti-fuite : l'org B a la même règle mais AUCUN événement → aucune carte.
        assertThat(suggestionService.list(orgBId, propertyB.getId())).isEmpty();
    }
}
