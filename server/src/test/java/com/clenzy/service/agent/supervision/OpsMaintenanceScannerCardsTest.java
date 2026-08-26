package com.clenzy.service.agent.supervision;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionAssignmentResponse;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.ServiceQuote;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.PropertyStockItemRepository;
import com.clenzy.repository.ServiceQuoteRepository;
import com.clenzy.repository.SmartLockDeviceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Les cartes Operations de la constellation :
 * « mission a confirmer » (assignee, sans reponse de l'intervenant) et
 * « acompte a regler » (devis approuve, acompte non encaisse), et « demande sans
 * prestataire » — cette derniere etant une PROJECTION du signal deja porte par la
 * liste d'actions du tableau de bord, sur le logement concerne.
 *
 * <p>Le piege que ces tests verrouillent : {@code assignmentResponse} est une
 * ENUMERATION. Une comparaison a la chaine {@code "PENDING".equals(...)} compile
 * sans broncher et vaut toujours faux — la carte ne serait jamais emise, en
 * silence.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OpsMaintenanceScannerCardsTest {

    private static final Long ORG = 1L;
    private static final Long PROP = 3L;
    private static final Long INTERVENTION_ID = 94L;

    @Mock private SmartLockDeviceRepository smartLockDeviceRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private ServiceQuoteRepository serviceQuoteRepository;
    @Mock private PropertyStockItemRepository propertyStockItemRepository;
    @Mock private com.clenzy.repository.ServiceRequestRepository serviceRequestRepository;
    @Mock private SupervisionSuggestionService suggestionService;

    private final Clock clock = Clock.fixed(Instant.parse("2026-08-22T10:00:00Z"), ZoneOffset.UTC);

    private OpsMaintenanceScanner scanner() {
        return new OpsMaintenanceScanner(smartLockDeviceRepository, interventionRepository,
                propertyRepository, serviceQuoteRepository, propertyStockItemRepository,
                serviceRequestRepository, suggestionService, clock);
    }

    private Intervention intervention(InterventionStatus status,
                                      User assignee,
                                      InterventionAssignmentResponse response) {
        Intervention i = new Intervention();
        i.setId(INTERVENTION_ID);
        i.setTitle("Reprise peinture salon");
        i.setStatus(status);
        i.setAssignedUser(assignee);
        i.setAssignmentResponse(response);
        return i;
    }

    private User technicien() {
        User u = new User();
        u.setId(4L);
        u.setFirstName("Marc");
        u.setLastName("Perrin");
        return u;
    }

    private ServiceQuote quote(ServiceQuote.Status status, BigDecimal deposit, LocalDateTime paidAt) {
        ServiceQuote q = new ServiceQuote();
        q.setId(17L);
        q.setStatus(status);
        q.setProviderName("Marc Perrin");
        q.setCurrency("EUR");
        q.setAmount(new BigDecimal("200.00"));
        q.setDepositAmount(deposit);
        q.setDepositPaidAt(paidAt);
        return q;
    }

    private void givenIntervention(Intervention i) {
        when(interventionRepository.findByPropertyAndCreatedBetween(
                eq(PROP), eq(ORG), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(i));
    }

    // --- Mission a confirmer -------------------------------------------------

    @Test
    void whenMissionAssignedAndAwaitingResponse_thenCardRecorded() {
        givenIntervention(intervention(InterventionStatus.PENDING, technicien(),
                InterventionAssignmentResponse.PENDING));

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService).record(eq(ORG), eq(PROP), eq("ops"), eq("mission_to_confirm"),
                contains("#94"), contains("Marc Perrin"));
    }

    @Test
    void whenMissionAlreadyAccepted_thenNoCard() {
        givenIntervention(intervention(InterventionStatus.PENDING, technicien(),
                InterventionAssignmentResponse.ACCEPTED));

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService, never()).record(anyLong(), anyLong(), any(),
                eq("mission_to_confirm"), any(), any());
    }

    @Test
    void whenMissionUnassigned_thenNoCard() {
        givenIntervention(intervention(InterventionStatus.PENDING, null,
                InterventionAssignmentResponse.PENDING));

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService, never()).record(anyLong(), anyLong(), any(),
                eq("mission_to_confirm"), any(), any());
    }

    @Test
    void whenMissionClosed_thenNoCard() {
        givenIntervention(intervention(InterventionStatus.COMPLETED, technicien(),
                InterventionAssignmentResponse.PENDING));

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService, never()).record(anyLong(), anyLong(), any(),
                eq("mission_to_confirm"), any(), any());
    }

    // --- Acompte a regler ----------------------------------------------------

    @Test
    void whenApprovedQuoteHasUnpaidDeposit_thenCardRecorded() {
        givenIntervention(intervention(InterventionStatus.PENDING, technicien(),
                InterventionAssignmentResponse.ACCEPTED));
        when(serviceQuoteRepository.findByInterventionIdAndOrganizationIdOrderByAmountAsc(
                INTERVENTION_ID, ORG))
                .thenReturn(List.of(quote(ServiceQuote.Status.APPROVED, new BigDecimal("40.00"), null)));

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService).record(eq(ORG), eq(PROP), eq("ops"), eq("deposit_to_collect"),
                contains("#94"), contains("40.00"));
    }

    @Test
    void whenDepositAlreadyPaid_thenNoCard() {
        givenIntervention(intervention(InterventionStatus.PENDING, technicien(),
                InterventionAssignmentResponse.ACCEPTED));
        when(serviceQuoteRepository.findByInterventionIdAndOrganizationIdOrderByAmountAsc(
                INTERVENTION_ID, ORG))
                .thenReturn(List.of(quote(ServiceQuote.Status.APPROVED, new BigDecimal("40.00"),
                        LocalDateTime.parse("2026-08-21T09:00:00"))));

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService, never()).record(anyLong(), anyLong(), any(),
                eq("deposit_to_collect"), any(), any());
    }

    @Test
    void whenQuoteNotApproved_thenNoCard() {
        givenIntervention(intervention(InterventionStatus.PENDING, technicien(),
                InterventionAssignmentResponse.ACCEPTED));
        when(serviceQuoteRepository.findByInterventionIdAndOrganizationIdOrderByAmountAsc(
                INTERVENTION_ID, ORG))
                .thenReturn(List.of(quote(ServiceQuote.Status.RECEIVED, new BigDecimal("40.00"), null)));

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService, never()).record(anyLong(), anyLong(), any(),
                eq("deposit_to_collect"), any(), any());
    }

    @Test
    void whenQuoteHasNoDeposit_thenNoCard() {
        givenIntervention(intervention(InterventionStatus.PENDING, technicien(),
                InterventionAssignmentResponse.ACCEPTED));
        when(serviceQuoteRepository.findByInterventionIdAndOrganizationIdOrderByAmountAsc(
                INTERVENTION_ID, ORG))
                .thenReturn(List.of(quote(ServiceQuote.Status.APPROVED, BigDecimal.ZERO, null)));

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService, never()).record(anyLong(), anyLong(), any(),
                eq("deposit_to_collect"), any(), any());
    }

    // --- Demande sans prestataire -------------------------------------------

    private com.clenzy.model.ServiceRequest serviceRequest(Long propertyId, String desiredDate) {
        com.clenzy.model.Property p = new com.clenzy.model.Property();
        p.setId(propertyId);
        com.clenzy.model.ServiceRequest sr = new com.clenzy.model.ServiceRequest();
        sr.setId(142L);
        sr.setTitle("Fuite salle de bain");
        sr.setProperty(p);
        if (desiredDate != null) {
            sr.setDesiredDate(LocalDateTime.parse(desiredDate));
        }
        return sr;
    }

    private void givenStuck(com.clenzy.model.ServiceRequest... requests) {
        when(serviceRequestRepository.findStuckUnassignedForOrg(eq(ORG), any(LocalDateTime.class)))
                .thenReturn(List.of(requests));
    }

    @Test
    void whenServiceRequestStuckOnScannedProperty_thenCardRecorded() {
        givenStuck(serviceRequest(PROP, "2026-09-01T10:00:00"));

        scanner().scanProperty(ORG, PROP);

        // Actionnable : la carte porte la reprise en main, pas seulement le constat.
        verify(suggestionService).recordActionable(eq(ORG), eq(PROP), eq("ops"),
                contains("#142"), contains("assigner a la main"),
                eq(SupervisionActionType.REASSIGN_MANUAL), contains("\"serviceRequestId\":142"),
                isNull(), eq("warning"));
    }

    @Test
    void whenDesiredDateAlreadyPassed_thenCardSaysItIsTooLate() {
        // Horloge figee au 2026-08-22 : la date souhaitee est derriere nous.
        givenStuck(serviceRequest(PROP, "2026-08-01T10:00:00"));

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService).recordActionable(eq(ORG), eq(PROP), eq("ops"),
                any(), contains("n'aura pas lieu"),
                eq(SupervisionActionType.REASSIGN_MANUAL), any(), isNull(), eq("critical"));
    }

    @Test
    void whenStuckRequestBelongsToAnotherProperty_thenNoCard() {
        // La requete partagee est org-scopee : sans ce filtre, la carte se poserait
        // sur le logement en cours de scan alors qu'elle concerne le voisin.
        givenStuck(serviceRequest(999L, "2026-09-01T10:00:00"));

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService, never()).recordActionable(anyLong(), anyLong(), any(),
                any(), any(), eq(SupervisionActionType.REASSIGN_MANUAL), any(), any(), any());
    }
}
