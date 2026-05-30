package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.InvoiceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AutoInvoiceServiceTest {

    @Mock private InvoiceGeneratorService invoiceGeneratorService;
    @Mock private InvoiceNumberingService numberingService;
    @Mock private InvoiceRepository invoiceRepository;
    @Mock private FiscalProfileRepository fiscalProfileRepository;
    @Mock private DocumentGenerationRepository documentGenerationRepository;

    @InjectMocks
    private AutoInvoiceService service;

    private static final Long ORG_ID = 11L;
    private static final Long RES_ID = 100L;
    private static final Long INT_ID = 200L;

    @BeforeEach
    void setUp() {
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private Reservation reservation() {
        Reservation r = new Reservation();
        r.setId(RES_ID);
        r.setOrganizationId(ORG_ID);
        return r;
    }

    private Intervention intervention() {
        Intervention i = new Intervention();
        i.setId(INT_ID);
        i.setOrganizationId(ORG_ID);
        return i;
    }

    private FiscalProfile fiscalProfile() {
        FiscalProfile p = new FiscalProfile();
        p.setOrganizationId(ORG_ID);
        return p;
    }

    private Invoice draftInvoice() {
        Invoice i = new Invoice();
        i.setOrganizationId(ORG_ID);
        i.setTotalTtc(new BigDecimal("150.00"));
        return i;
    }

    // ----- generateForReservation -----

    @Test
    void generateForReservation_existingInvoice_skips() {
        when(invoiceRepository.findByReservationId(RES_ID)).thenReturn(Optional.of(new Invoice()));

        Invoice result = service.generateForReservation(reservation());

        assertThat(result).isNull();
        verifyNoInteractions(invoiceGeneratorService, numberingService);
    }

    @Test
    void generateForReservation_noFiscalProfile_skips() {
        when(invoiceRepository.findByReservationId(RES_ID)).thenReturn(Optional.empty());
        when(fiscalProfileRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

        Invoice result = service.generateForReservation(reservation());

        assertThat(result).isNull();
        verifyNoInteractions(invoiceGeneratorService);
    }

    @Test
    void generateForReservation_success_assignsNumberStatusAndPaymentMethod() {
        Reservation reservation = reservation();
        when(invoiceRepository.findByReservationId(RES_ID)).thenReturn(Optional.empty());
        when(fiscalProfileRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(fiscalProfile()));
        when(invoiceGeneratorService.generateFromReservation(reservation, ORG_ID)).thenReturn(draftInvoice());
        when(numberingService.generateNextNumber(ORG_ID)).thenReturn("FAC-2025-001");
        when(documentGenerationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
            ReferenceType.RESERVATION, RES_ID)).thenReturn(List.of());

        Invoice result = service.generateForReservation(reservation);

        assertThat(result).isNotNull();
        assertThat(result.getInvoiceNumber()).isEqualTo("FAC-2025-001");
        assertThat(result.getInvoiceDate()).isNotNull();
        assertThat(result.getStatus()).isEqualTo(InvoiceStatus.PAID);
        assertThat(result.getPaidAt()).isNotNull();
        assertThat(result.getPaymentMethod()).isEqualTo("STRIPE");
        assertThat(result.getDocumentGenerationId()).isNull();
    }

    @Test
    void generateForReservation_linksDocumentGenerationIfPresent() {
        Reservation reservation = reservation();
        DocumentGeneration dg = new DocumentGeneration();
        dg.setId(55L);
        dg.setDocumentType(DocumentType.FACTURE);

        when(invoiceRepository.findByReservationId(RES_ID)).thenReturn(Optional.empty());
        when(fiscalProfileRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(fiscalProfile()));
        when(invoiceGeneratorService.generateFromReservation(reservation, ORG_ID)).thenReturn(draftInvoice());
        when(numberingService.generateNextNumber(ORG_ID)).thenReturn("FAC-001");
        when(documentGenerationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
            ReferenceType.RESERVATION, RES_ID)).thenReturn(List.of(dg));

        Invoice result = service.generateForReservation(reservation);

        assertThat(result.getDocumentGenerationId()).isEqualTo(55L);
    }

    @Test
    void generateForReservation_ignoresNonFactureDocumentGeneration() {
        Reservation reservation = reservation();
        DocumentGeneration devis = new DocumentGeneration();
        devis.setId(33L);
        devis.setDocumentType(DocumentType.DEVIS);

        when(invoiceRepository.findByReservationId(RES_ID)).thenReturn(Optional.empty());
        when(fiscalProfileRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(fiscalProfile()));
        when(invoiceGeneratorService.generateFromReservation(reservation, ORG_ID)).thenReturn(draftInvoice());
        when(numberingService.generateNextNumber(ORG_ID)).thenReturn("FAC-001");
        when(documentGenerationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
            ReferenceType.RESERVATION, RES_ID)).thenReturn(List.of(devis));

        Invoice result = service.generateForReservation(reservation);

        assertThat(result.getDocumentGenerationId()).isNull();
    }

    @Test
    void generateForReservation_documentGenLookupThrows_swallowedAndInvoiceReturned() {
        Reservation reservation = reservation();
        when(invoiceRepository.findByReservationId(RES_ID)).thenReturn(Optional.empty());
        when(fiscalProfileRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(fiscalProfile()));
        when(invoiceGeneratorService.generateFromReservation(reservation, ORG_ID)).thenReturn(draftInvoice());
        when(numberingService.generateNextNumber(ORG_ID)).thenReturn("FAC-001");
        when(documentGenerationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
            eq(ReferenceType.RESERVATION), eq(RES_ID))).thenThrow(new RuntimeException("DB down"));

        Invoice result = service.generateForReservation(reservation);

        assertThat(result).isNotNull();
        assertThat(result.getDocumentGenerationId()).isNull();
    }

    // ----- generateForIntervention -----

    @Test
    void generateForIntervention_existingInvoice_skips() {
        when(invoiceRepository.findByInterventionId(INT_ID)).thenReturn(Optional.of(new Invoice()));

        Invoice result = service.generateForIntervention(intervention());

        assertThat(result).isNull();
        verifyNoInteractions(invoiceGeneratorService, numberingService);
    }

    @Test
    void generateForIntervention_noFiscalProfile_skips() {
        when(invoiceRepository.findByInterventionId(INT_ID)).thenReturn(Optional.empty());
        when(fiscalProfileRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

        Invoice result = service.generateForIntervention(intervention());

        assertThat(result).isNull();
        verifyNoInteractions(invoiceGeneratorService);
    }

    @Test
    void generateForIntervention_success_marksPaid() {
        Intervention intervention = intervention();
        when(invoiceRepository.findByInterventionId(INT_ID)).thenReturn(Optional.empty());
        when(fiscalProfileRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(fiscalProfile()));
        when(invoiceGeneratorService.generateFromIntervention(intervention, ORG_ID)).thenReturn(draftInvoice());
        when(numberingService.generateNextNumber(ORG_ID)).thenReturn("FAC-INT-001");
        when(documentGenerationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
            ReferenceType.INTERVENTION, INT_ID)).thenReturn(List.of());

        Invoice result = service.generateForIntervention(intervention);

        assertThat(result).isNotNull();
        assertThat(result.getInvoiceNumber()).isEqualTo("FAC-INT-001");
        assertThat(result.getStatus()).isEqualTo(InvoiceStatus.PAID);
        assertThat(result.getPaymentMethod()).isEqualTo("STRIPE");
    }

    @Test
    void generateForIntervention_linksDocumentGenerationIfPresent() {
        Intervention intervention = intervention();
        DocumentGeneration dg = new DocumentGeneration();
        dg.setId(88L);
        dg.setDocumentType(DocumentType.FACTURE);

        when(invoiceRepository.findByInterventionId(INT_ID)).thenReturn(Optional.empty());
        when(fiscalProfileRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(fiscalProfile()));
        when(invoiceGeneratorService.generateFromIntervention(intervention, ORG_ID)).thenReturn(draftInvoice());
        when(numberingService.generateNextNumber(ORG_ID)).thenReturn("FAC-INT-001");
        when(documentGenerationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
            ReferenceType.INTERVENTION, INT_ID)).thenReturn(List.of(dg));

        Invoice result = service.generateForIntervention(intervention);

        assertThat(result.getDocumentGenerationId()).isEqualTo(88L);
    }
}
