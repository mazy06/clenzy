package com.clenzy.service;

import com.clenzy.dto.GuestDeclarationRequest;
import com.clenzy.dto.WelcomeGuidePublicDto.DataCollectionInfo;
import com.clenzy.integration.compliance.submission.ComplianceSubmissionService;
import com.clenzy.model.DeclarationStatus;
import com.clenzy.model.GuestDeclaration;
import com.clenzy.model.Property;
import com.clenzy.model.RegulatoryConfig;
import com.clenzy.model.RegulatoryConfig.RegulatoryType;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestDeclarationRepository;
import com.clenzy.repository.RegulatoryConfigRepository;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GuestDeclarationServiceTest {

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 100L;
    private static final Long RESERVATION_ID = 500L;

    @Mock private GuestDeclarationRepository declarationRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private RegulatoryConfigRepository regulatoryConfigRepository;
    @Mock private OnlineCheckInService onlineCheckInService;
    @Mock private ComplianceSubmissionService complianceSubmissionService;

    private GuestDeclarationService service() {
        return new GuestDeclarationService(
            declarationRepository, reservationRepository, regulatoryConfigRepository,
            onlineCheckInService, complianceSubmissionService);
    }

    private Reservation reservation() {
        Property p = new Property();
        p.setId(PROPERTY_ID);
        p.setCountryCode("FR");
        Reservation r = new Reservation();
        r.setId(RESERVATION_ID);
        r.setOrganizationId(ORG_ID);
        r.setProperty(p);
        return r;
    }

    private RegulatoryConfig policeForm(boolean enabled) {
        RegulatoryConfig c = new RegulatoryConfig();
        c.setOrganizationId(ORG_ID);
        c.setPropertyId(PROPERTY_ID);
        c.setRegulatoryType(RegulatoryType.POLICE_FORM);
        c.setIsEnabled(enabled);
        return c;
    }

    private GuestDeclarationRequest.Declarant fullDeclarant() {
        return new GuestDeclarationRequest.Declarant(
            "Jean", "Dupont", null, "1990-05-12", "Lyon", "FR",
            "10 rue de la Paix, Paris", "FR", "PASSPORT", "12AB34567");
    }

    @Test
    void computeRequirements_policeFormDisabled_notRequiredAndComplete() {
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation()));
        when(regulatoryConfigRepository.findByPropertyAndType(PROPERTY_ID, RegulatoryType.POLICE_FORM, ORG_ID))
            .thenReturn(Optional.of(policeForm(false)));

        DataCollectionInfo info = service().computeRequirements(RESERVATION_ID);

        assertFalse(info.required());
        assertTrue(info.complete());
        assertTrue(info.missingFields().isEmpty());
        // Pas de scan des champs ni du check-in si le service est désactivé.
        verify(onlineCheckInService, never()).getByReservation(anyLong(), anyLong());
    }

    @Test
    void computeRequirements_noPoliceFormConfig_notRequired() {
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation()));
        when(regulatoryConfigRepository.findByPropertyAndType(PROPERTY_ID, RegulatoryType.POLICE_FORM, ORG_ID))
            .thenReturn(Optional.empty());

        DataCollectionInfo info = service().computeRequirements(RESERVATION_ID);

        assertFalse(info.required());
        assertTrue(info.complete());
    }

    @Test
    void computeRequirements_enabledAndNoData_requiredWithAllMissingFields() {
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation()));
        when(regulatoryConfigRepository.findByPropertyAndType(PROPERTY_ID, RegulatoryType.POLICE_FORM, ORG_ID))
            .thenReturn(Optional.of(policeForm(true)));
        when(declarationRepository.findByReservationIdOrderByIdAsc(RESERVATION_ID)).thenReturn(List.of());
        when(onlineCheckInService.getByReservation(RESERVATION_ID, ORG_ID)).thenReturn(Optional.empty());

        DataCollectionInfo info = service().computeRequirements(RESERVATION_ID);

        assertTrue(info.required());
        assertFalse(info.complete());
        assertEquals(8, info.missingFields().size());
        assertTrue(info.missingFields().containsAll(List.of(
            "firstName", "lastName", "birthDate", "birthPlace",
            "nationality", "residenceAddress", "idDocumentType", "idDocumentNumber")));
    }

    @Test
    void computeRequirements_completedDeclarationWithAllFields_complete() {
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation()));
        when(regulatoryConfigRepository.findByPropertyAndType(PROPERTY_ID, RegulatoryType.POLICE_FORM, ORG_ID))
            .thenReturn(Optional.of(policeForm(true)));

        GuestDeclaration completed = new GuestDeclaration();
        completed.setPrimary(true);
        completed.setStatus(DeclarationStatus.COMPLETED);
        completed.setFirstName("Jean");
        completed.setLastName("Dupont");
        completed.setBirthDate("1990-05-12");
        completed.setBirthPlace("Lyon");
        completed.setNationality("FR");
        completed.setResidenceAddress("10 rue de la Paix");
        completed.setIdDocumentType("PASSPORT");
        completed.setIdDocumentNumber("12AB34567");
        when(declarationRepository.findByReservationIdOrderByIdAsc(RESERVATION_ID)).thenReturn(List.of(completed));
        lenient().when(onlineCheckInService.getByReservation(RESERVATION_ID, ORG_ID)).thenReturn(Optional.empty());

        DataCollectionInfo info = service().computeRequirements(RESERVATION_ID);

        assertFalse(info.required());
        assertTrue(info.complete());
        assertTrue(info.missingFields().isEmpty());
    }

    @Test
    void computeRequirements_reservationNotFound_completeNoRequirement() {
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.empty());

        DataCollectionInfo info = service().computeRequirements(RESERVATION_ID);

        assertFalse(info.required());
        assertTrue(info.complete());
    }

    @Test
    void submitDeclaration_createsPrimaryAndCompanions() {
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation()));
        when(declarationRepository.findByReservationIdOrderByIdAsc(RESERVATION_ID)).thenReturn(List.of());
        // computeRequirements (re-appelé en fin de submit) : service activé.
        when(regulatoryConfigRepository.findByPropertyAndType(PROPERTY_ID, RegulatoryType.POLICE_FORM, ORG_ID))
            .thenReturn(Optional.of(policeForm(true)));
        lenient().when(onlineCheckInService.getByReservation(RESERVATION_ID, ORG_ID)).thenReturn(Optional.empty());

        GuestDeclarationRequest.Declarant companion = new GuestDeclarationRequest.Declarant(
            "Marie", "Dupont", null, "1992-08-01", "Paris", "FR", null, "FR", "ID_CARD", "X9988");
        GuestDeclarationRequest request = new GuestDeclarationRequest(List.of(fullDeclarant(), companion));

        service().submitDeclaration(RESERVATION_ID, request);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<GuestDeclaration>> captor = ArgumentCaptor.forClass(List.class);
        verify(declarationRepository).saveAll(captor.capture());
        List<GuestDeclaration> saved = captor.getValue();

        assertEquals(2, saved.size());
        GuestDeclaration primary = saved.get(0);
        assertTrue(primary.isPrimary());
        assertEquals(ORG_ID, primary.getOrganizationId());
        assertEquals("FR", primary.getCountryCode());
        assertEquals("Jean", primary.getFirstName());
        assertEquals(DeclarationStatus.COMPLETED, primary.getStatus()); // tous champs requis présents

        GuestDeclaration companionSaved = saved.get(1);
        assertFalse(companionSaved.isPrimary());
        // L'accompagnant complet (sans adresse, non exigée pour un accompagnant) est COMPLETED.
        assertEquals(DeclarationStatus.COMPLETED, companionSaved.getStatus());

        // Déclaration COMPLETED → soumission compliance déclenchée (hors tx en test → immédiat).
        verify(complianceSubmissionService).submitForReservation(RESERVATION_ID, ORG_ID);
    }

    @Test
    void submitDeclaration_noCompletedDeclaration_noComplianceTrigger() {
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation()));
        when(declarationRepository.findByReservationIdOrderByIdAsc(RESERVATION_ID)).thenReturn(List.of());
        when(regulatoryConfigRepository.findByPropertyAndType(PROPERTY_ID, RegulatoryType.POLICE_FORM, ORG_ID))
            .thenReturn(Optional.of(policeForm(true)));
        lenient().when(onlineCheckInService.getByReservation(RESERVATION_ID, ORG_ID)).thenReturn(Optional.empty());

        // Déclarant incomplet (manque date de naissance, lieu, document…) → PENDING, pas de trigger.
        GuestDeclarationRequest.Declarant incomplete = new GuestDeclarationRequest.Declarant(
            "Jean", "Dupont", null, null, null, "FR", null, "FR", null, null);
        GuestDeclarationRequest request = new GuestDeclarationRequest(List.of(incomplete));

        service().submitDeclaration(RESERVATION_ID, request);

        verify(complianceSubmissionService, never()).submitForReservation(anyLong(), anyLong());
    }

    @Test
    void submitDeclaration_replacesExistingDeclarations() {
        Reservation res = reservation();
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(res));
        GuestDeclaration old = new GuestDeclaration();
        old.setId(7L);
        old.setPrimary(true);
        when(declarationRepository.findByReservationIdOrderByIdAsc(RESERVATION_ID))
            .thenReturn(List.of(old))   // appel dans submit
            .thenReturn(List.of());     // appel dans computeRequirements final
        when(regulatoryConfigRepository.findByPropertyAndType(PROPERTY_ID, RegulatoryType.POLICE_FORM, ORG_ID))
            .thenReturn(Optional.of(policeForm(true)));
        lenient().when(onlineCheckInService.getByReservation(RESERVATION_ID, ORG_ID)).thenReturn(Optional.empty());

        GuestDeclarationRequest request = new GuestDeclarationRequest(List.of(fullDeclarant()));

        service().submitDeclaration(RESERVATION_ID, request);

        verify(declarationRepository).deleteAllInBatch(List.of(old));
        verify(declarationRepository).saveAll(any());
    }

    @Test
    void submitDeclaration_emptyDeclarants_throws() {
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation()));

        GuestDeclarationRequest request = new GuestDeclarationRequest(List.of());

        assertThrows(IllegalArgumentException.class,
            () -> service().submitDeclaration(RESERVATION_ID, request));
        verify(declarationRepository, never()).saveAll(any());
    }
}
