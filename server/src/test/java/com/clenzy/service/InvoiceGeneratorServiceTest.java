package com.clenzy.service;

import com.clenzy.dto.GenerateInvoiceRequest;
import com.clenzy.dto.InvoiceDto;
import com.clenzy.fiscal.FiscalEngine;
import com.clenzy.fiscal.TaxResult;
import com.clenzy.fiscal.TouristTaxResult;
import com.clenzy.model.*;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvoiceGeneratorServiceTest {

    @Mock
    private InvoiceRepository invoiceRepository;

    @Mock
    private ReservationRepository reservationRepository;

    @Mock
    private com.clenzy.repository.InterventionRepository interventionRepository;

    @Mock
    private FiscalProfileRepository fiscalProfileRepository;

    @Mock
    private FiscalEngine fiscalEngine;

    @Mock
    private InvoiceNumberingService numberingService;

    @Mock
    private TenantContext tenantContext;

    @Mock
    private EntityManager entityManager;

    @Mock
    private TypedQuery<Invoice> invoicesByInterventionQuery;

    private InvoiceGeneratorService service;

    @BeforeEach
    void setUp() {
        service = new InvoiceGeneratorService(
            invoiceRepository, reservationRepository, interventionRepository,
            fiscalProfileRepository, fiscalEngine, numberingService, tenantContext,
            entityManager);
    }

    /**
     * Stub du chargement JPQL des factures d'une intervention (reliquat A2 :
     * le repository ne propose qu'un Optional fragile, le service charge la
     * liste via EntityManager puis filtre sur la semantique « active »).
     */
    private void stubInvoicesByIntervention(Long interventionId, List<Invoice> invoices) {
        when(entityManager.createQuery(anyString(), eq(Invoice.class)))
            .thenReturn(invoicesByInterventionQuery);
        when(invoicesByInterventionQuery.setParameter("interventionId", interventionId))
            .thenReturn(invoicesByInterventionQuery);
        when(invoicesByInterventionQuery.getResultList()).thenReturn(invoices);
    }

    private Reservation createTestReservation() {
        Reservation res = new Reservation();
        res.setId(100L);
        res.setGuestName("John Doe");
        res.setGuestCount(2);
        res.setCheckIn(LocalDate.of(2026, 3, 1));
        res.setCheckOut(LocalDate.of(2026, 3, 4));
        res.setTotalPrice(new BigDecimal("300.00"));
        res.setRoomRevenue(new BigDecimal("250.00"));
        res.setCleaningFee(new BigDecimal("50.00"));
        return res;
    }

    private FiscalProfile createTestFiscalProfile() {
        FiscalProfile fp = new FiscalProfile();
        fp.setOrganizationId(1L);
        fp.setLegalEntityName("SARL Test");
        fp.setLegalAddress("1 rue Test, 75001 Paris");
        fp.setVatNumber("FR12345678901");
        fp.setLegalMentions("SARL au capital de 10000 EUR");
        return fp;
    }

    @Nested
    class GenerateFromReservation {

        @Test
        void shouldCreateDraftInvoiceWithAccommodationAndCleaningLines() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");


            when(invoiceRepository.findAllByReservationId(100L)).thenReturn(List.of());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(createTestReservation()));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));

            // Tax calculations
            TaxResult accommodationTax = new TaxResult(
                new BigDecimal("250.00"), new BigDecimal("25.00"), new BigDecimal("275.00"),
                new BigDecimal("0.1000"), "TVA 10%", "ACCOMMODATION");
            TaxResult cleaningTax = new TaxResult(
                new BigDecimal("50.00"), new BigDecimal("10.00"), new BigDecimal("60.00"),
                new BigDecimal("0.2000"), "TVA 20%", "CLEANING");

            when(fiscalEngine.calculateTax(eq("FR"), any(), any()))
                .thenReturn(accommodationTax, cleaningTax);

            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(invocation -> {
                    Invoice inv = invocation.getArgument(0);
                    inv.setId(1L);
                    return inv;
                });

            GenerateInvoiceRequest request = new GenerateInvoiceRequest(
                100L, "Client Test", "2 rue Client", null, null);

            InvoiceDto result = service.generateFromReservation(request);

            assertThat(result.status()).isEqualTo(InvoiceStatus.DRAFT);
            assertThat(result.invoiceNumber()).isEqualTo("DRAFT");
            assertThat(result.sellerName()).isEqualTo("SARL Test");
            assertThat(result.buyerName()).isEqualTo("Client Test");
            assertThat(result.currency()).isEqualTo("EUR");
            assertThat(result.lines()).hasSize(2);
        }

        @Test
        void shouldThrowIfInvoiceAlreadyExistsForReservation() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");


            Invoice existing = new Invoice();
            existing.setInvoiceNumber("FA2026-00001");
            when(invoiceRepository.findAllByReservationId(100L)).thenReturn(List.of(existing));

            GenerateInvoiceRequest request = new GenerateInvoiceRequest(
                100L, null, null, null, null);

            assertThatThrownBy(() -> service.generateFromReservation(request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("facture existe deja");
        }

        @Test
        void shouldThrowIfReservationNotFound() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            when(invoiceRepository.findAllByReservationId(999L)).thenReturn(List.of());
            when(reservationRepository.findById(999L)).thenReturn(Optional.empty());

            GenerateInvoiceRequest request = new GenerateInvoiceRequest(
                999L, null, null, null, null);

            assertThatThrownBy(() -> service.generateFromReservation(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Reservation introuvable");
        }

        @Test
        void shouldIncludeTouristTaxLineWhenRateProvided() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");


            when(invoiceRepository.findAllByReservationId(100L)).thenReturn(List.of());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(createTestReservation()));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));

            TaxResult accommodationTax = new TaxResult(
                new BigDecimal("250.00"), new BigDecimal("25.00"), new BigDecimal("275.00"),
                new BigDecimal("0.1000"), "TVA 10%", "ACCOMMODATION");
            TaxResult cleaningTax = new TaxResult(
                new BigDecimal("50.00"), new BigDecimal("10.00"), new BigDecimal("60.00"),
                new BigDecimal("0.2000"), "TVA 20%", "CLEANING");
            TouristTaxResult touristTax = new TouristTaxResult(
                new BigDecimal("9.00"), "Taxe de sejour: 2 pers x 3 nuits x 1.50 EUR",
                new BigDecimal("1.50"));

            when(fiscalEngine.calculateTax(eq("FR"), any(), any()))
                .thenReturn(accommodationTax, cleaningTax);
            when(fiscalEngine.calculateTouristTax(eq("FR"), any()))
                .thenReturn(touristTax);

            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(invocation -> {
                    Invoice inv = invocation.getArgument(0);
                    inv.setId(1L);
                    return inv;
                });

            GenerateInvoiceRequest request = new GenerateInvoiceRequest(
                100L, null, null, null, new BigDecimal("1.50"));

            InvoiceDto result = service.generateFromReservation(request);

            // 3 lines: accommodation + cleaning + tourist tax
            assertThat(result.lines()).hasSize(3);
        }

        @Test
        void shouldUseGuestNameWhenBuyerNameNotProvided() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");


            when(invoiceRepository.findAllByReservationId(100L)).thenReturn(List.of());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(createTestReservation()));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));

            TaxResult accommodationTax = new TaxResult(
                new BigDecimal("250.00"), new BigDecimal("25.00"), new BigDecimal("275.00"),
                new BigDecimal("0.1000"), "TVA 10%", "ACCOMMODATION");
            TaxResult cleaningTax = new TaxResult(
                new BigDecimal("50.00"), new BigDecimal("10.00"), new BigDecimal("60.00"),
                new BigDecimal("0.2000"), "TVA 20%", "CLEANING");

            when(fiscalEngine.calculateTax(eq("FR"), any(), any()))
                .thenReturn(accommodationTax, cleaningTax);

            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(invocation -> {
                    Invoice inv = invocation.getArgument(0);
                    inv.setId(1L);
                    return inv;
                });

            // buyerName = null → should use guestName
            GenerateInvoiceRequest request = new GenerateInvoiceRequest(
                100L, null, null, null, null);

            InvoiceDto result = service.generateFromReservation(request);

            assertThat(result.buyerName()).isEqualTo("John Doe");
        }

        @Test
        void shouldUseReservationCurrencyInsteadOfTenantDefault() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("MA");

            Reservation res = createTestReservation();
            res.setCurrency("MAD");

            when(invoiceRepository.findAllByReservationId(100L)).thenReturn(List.of());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(res));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));

            TaxResult accommodationTax = new TaxResult(
                new BigDecimal("250.00"), new BigDecimal("25.00"), new BigDecimal("275.00"),
                new BigDecimal("0.1000"), "TVA 10%", "ACCOMMODATION");
            TaxResult cleaningTax = new TaxResult(
                new BigDecimal("50.00"), new BigDecimal("10.00"), new BigDecimal("60.00"),
                new BigDecimal("0.2000"), "TVA 20%", "CLEANING");

            when(fiscalEngine.calculateTax(eq("MA"), any(), any()))
                .thenReturn(accommodationTax, cleaningTax);

            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(invocation -> {
                    Invoice inv = invocation.getArgument(0);
                    inv.setId(1L);
                    return inv;
                });

            GenerateInvoiceRequest request = new GenerateInvoiceRequest(
                100L, "Client", null, null, null);

            InvoiceDto result = service.generateFromReservation(request);

            assertThat(result.currency()).isEqualTo("MAD");
        }

        @Test
        void shouldFallbackToTenantCurrencyWhenReservationCurrencyIsNull() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");
            when(tenantContext.getDefaultCurrency()).thenReturn("EUR");

            Reservation res = createTestReservation();
            res.setCurrency(null);

            when(invoiceRepository.findAllByReservationId(100L)).thenReturn(List.of());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(res));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));

            TaxResult accommodationTax = new TaxResult(
                new BigDecimal("250.00"), new BigDecimal("25.00"), new BigDecimal("275.00"),
                new BigDecimal("0.1000"), "TVA 10%", "ACCOMMODATION");
            TaxResult cleaningTax = new TaxResult(
                new BigDecimal("50.00"), new BigDecimal("10.00"), new BigDecimal("60.00"),
                new BigDecimal("0.2000"), "TVA 20%", "CLEANING");

            when(fiscalEngine.calculateTax(eq("FR"), any(), any()))
                .thenReturn(accommodationTax, cleaningTax);

            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(invocation -> {
                    Invoice inv = invocation.getArgument(0);
                    inv.setId(1L);
                    return inv;
                });

            GenerateInvoiceRequest request = new GenerateInvoiceRequest(
                100L, "Client", null, null, null);

            InvoiceDto result = service.generateFromReservation(request);

            assertThat(result.currency()).isEqualTo("EUR");
        }
    }

    @Nested
    class IssueInvoice {

        @Test
        void shouldIssueDraftInvoice() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Invoice draft = new Invoice();
            draft.setId(10L);
            draft.setOrganizationId(1L);
            draft.setInvoiceNumber("DRAFT");
            draft.setInvoiceDate(LocalDate.now());
            draft.setCurrency("EUR");
            draft.setCountryCode("FR");
            draft.setStatus(InvoiceStatus.DRAFT);
            draft.setTotalHt(BigDecimal.ZERO);
            draft.setTotalTax(BigDecimal.ZERO);
            draft.setTotalTtc(BigDecimal.ZERO);

            when(invoiceRepository.findById(10L)).thenReturn(Optional.of(draft));
            when(numberingService.generateNextNumber()).thenReturn("FA2026-00001");
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            InvoiceDto result = service.issueInvoice(10L);

            assertThat(result.status()).isEqualTo(InvoiceStatus.ISSUED);
            assertThat(result.invoiceNumber()).isEqualTo("FA2026-00001");
        }

        @Test
        void shouldThrowIfInvoiceNotDraft() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Invoice issued = new Invoice();
            issued.setId(10L);
            issued.setOrganizationId(1L);
            issued.setStatus(InvoiceStatus.ISSUED);

            when(invoiceRepository.findById(10L)).thenReturn(Optional.of(issued));

            assertThatThrownBy(() -> service.issueInvoice(10L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DRAFT");
        }

        @Test
        void shouldThrowIfInvoiceNotFound() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(invoiceRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.issueInvoice(999L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("introuvable");
        }

        @Test
        void shouldThrowIfInvoiceBelongsToDifferentOrg() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Invoice otherOrg = new Invoice();
            otherOrg.setId(10L);
            otherOrg.setOrganizationId(2L); // different org
            otherOrg.setStatus(InvoiceStatus.DRAFT);

            when(invoiceRepository.findById(10L)).thenReturn(Optional.of(otherOrg));

            assertThatThrownBy(() -> service.issueInvoice(10L))
                .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    class CancelInvoice {

        @Test
        void shouldCancelIssuedInvoiceAndCreateCreditNote() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            // Create an issued invoice with lines
            Invoice issued = new Invoice();
            issued.setId(10L);
            issued.setOrganizationId(1L);
            issued.setInvoiceNumber("FA2026-00001");
            issued.setInvoiceDate(LocalDate.now());
            issued.setCurrency("EUR");
            issued.setCountryCode("FR");
            issued.setStatus(InvoiceStatus.ISSUED);
            issued.setSellerName("SARL Test");
            issued.setBuyerName("Client Test");
            issued.setTotalHt(new BigDecimal("100.00"));
            issued.setTotalTax(new BigDecimal("10.00"));
            issued.setTotalTtc(new BigDecimal("110.00"));

            InvoiceLine line = new InvoiceLine();
            line.setLineNumber(1);
            line.setDescription("Hebergement");
            line.setQuantity(BigDecimal.ONE);
            line.setUnitPriceHt(new BigDecimal("100.00"));
            line.setTaxCategory("ACCOMMODATION");
            line.setTaxRate(new BigDecimal("0.1000"));
            line.setTaxAmount(new BigDecimal("10.00"));
            line.setTotalHt(new BigDecimal("100.00"));
            line.setTotalTtc(new BigDecimal("110.00"));
            issued.addLine(line);

            when(invoiceRepository.findById(10L)).thenReturn(Optional.of(issued));
            when(numberingService.generateNextNumber()).thenReturn("FA2026-00002");
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(invocation -> {
                    Invoice inv = invocation.getArgument(0);
                    if (inv.getStatus() == InvoiceStatus.CREDIT_NOTE) {
                        inv.setId(11L);
                    }
                    return inv;
                });

            InvoiceDto result = service.cancelInvoice(10L, "Erreur de facturation");

            assertThat(result.status()).isEqualTo(InvoiceStatus.CREDIT_NOTE);
            assertThat(result.invoiceNumber()).isEqualTo("FA2026-00002");
            assertThat(result.legalMentions()).contains("FA2026-00001");
            assertThat(result.legalMentions()).contains("Erreur de facturation");

            // Original should be marked CANCELLED
            assertThat(issued.getStatus()).isEqualTo(InvoiceStatus.CANCELLED);
        }

        @Test
        void shouldThrowIfInvoiceIsDraft() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Invoice draft = new Invoice();
            draft.setId(10L);
            draft.setOrganizationId(1L);
            draft.setStatus(InvoiceStatus.DRAFT);

            when(invoiceRepository.findById(10L)).thenReturn(Optional.of(draft));

            assertThatThrownBy(() -> service.cancelInvoice(10L, "test"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ISSUED/PAID");
        }
    }

    @Nested
    class ListInvoices {

        @Test
        void shouldReturnInvoicesForCurrentOrg() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Invoice inv1 = new Invoice();
            inv1.setId(1L);
            inv1.setOrganizationId(1L);
            inv1.setInvoiceNumber("FA2026-00001");
            inv1.setInvoiceDate(LocalDate.now());
            inv1.setCurrency("EUR");
            inv1.setCountryCode("FR");
            inv1.setStatus(InvoiceStatus.ISSUED);
            inv1.setTotalHt(BigDecimal.ZERO);
            inv1.setTotalTax(BigDecimal.ZERO);
            inv1.setTotalTtc(BigDecimal.ZERO);

            when(invoiceRepository.findByOrganizationId(1L)).thenReturn(List.of(inv1));

            List<InvoiceDto> result = service.listInvoices();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).invoiceNumber()).isEqualTo("FA2026-00001");
        }
    }

    @Nested
    class GetInvoice {

        @Test
        void shouldReturnInvoiceById() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Invoice inv = new Invoice();
            inv.setId(1L);
            inv.setOrganizationId(1L);
            inv.setInvoiceNumber("FA2026-00001");
            inv.setInvoiceDate(LocalDate.now());
            inv.setCurrency("EUR");
            inv.setCountryCode("FR");
            inv.setStatus(InvoiceStatus.ISSUED);
            inv.setTotalHt(BigDecimal.ZERO);
            inv.setTotalTax(BigDecimal.ZERO);
            inv.setTotalTtc(BigDecimal.ZERO);

            when(invoiceRepository.findById(1L)).thenReturn(Optional.of(inv));

            InvoiceDto result = service.getInvoice(1L);

            assertThat(result.invoiceNumber()).isEqualTo("FA2026-00001");
        }

        @Test
        void shouldThrowIfInvoiceBelongsToDifferentOrg() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Invoice inv = new Invoice();
            inv.setId(1L);
            inv.setOrganizationId(2L); // different org
            inv.setStatus(InvoiceStatus.ISSUED);

            when(invoiceRepository.findById(1L)).thenReturn(Optional.of(inv));

            assertThatThrownBy(() -> service.getInvoice(1L))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void shouldThrowIfInvoiceNotFound() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(invoiceRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getInvoice(999L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("introuvable");
        }
    }

    @Nested
    class GenerateFromReservationExtra {

        @Test
        void shouldUseTotalPriceWhenRoomRevenueIsNull() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            Reservation res = createTestReservation();
            res.setRoomRevenue(null); // fallback to totalPrice
            res.setTotalPrice(new BigDecimal("400.00"));

            when(invoiceRepository.findAllByReservationId(100L)).thenReturn(List.of());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(res));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));

            TaxResult accommodation = new TaxResult(
                new BigDecimal("400.00"), new BigDecimal("40.00"), new BigDecimal("440.00"),
                new BigDecimal("0.1000"), "TVA 10%", "ACCOMMODATION");
            TaxResult cleaning = new TaxResult(
                new BigDecimal("50.00"), new BigDecimal("10.00"), new BigDecimal("60.00"),
                new BigDecimal("0.2000"), "TVA 20%", "CLEANING");

            when(fiscalEngine.calculateTax(eq("FR"), any(), any()))
                .thenReturn(accommodation, cleaning);
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(1L); return i; });

            GenerateInvoiceRequest req = new GenerateInvoiceRequest(100L, "Client", null, null, null);
            InvoiceDto result = service.generateFromReservation(req);

            assertThat(result.lines()).hasSize(2);
        }

        @Test
        void shouldSkipAccommodationLineWhenRoomRevenueIsZero() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            Reservation res = createTestReservation();
            res.setRoomRevenue(BigDecimal.ZERO);
            res.setTotalPrice(BigDecimal.ZERO);

            when(invoiceRepository.findAllByReservationId(100L)).thenReturn(List.of());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(res));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));

            TaxResult cleaning = new TaxResult(
                new BigDecimal("50.00"), new BigDecimal("10.00"), new BigDecimal("60.00"),
                new BigDecimal("0.2000"), "TVA 20%", "CLEANING");
            when(fiscalEngine.calculateTax(eq("FR"), any(), any()))
                .thenReturn(cleaning);

            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(1L); return i; });

            GenerateInvoiceRequest req = new GenerateInvoiceRequest(100L, "Client", null, null, null);
            InvoiceDto result = service.generateFromReservation(req);

            // Only cleaning line
            assertThat(result.lines()).hasSize(1);
            assertThat(result.lines().get(0).description()).isEqualTo("Frais de menage");
        }

        @Test
        void shouldSkipCleaningLineWhenCleaningFeeIsNull() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            Reservation res = createTestReservation();
            res.setCleaningFee(null);

            when(invoiceRepository.findAllByReservationId(100L)).thenReturn(List.of());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(res));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));

            TaxResult accommodation = new TaxResult(
                new BigDecimal("250.00"), new BigDecimal("25.00"), new BigDecimal("275.00"),
                new BigDecimal("0.1000"), "TVA 10%", "ACCOMMODATION");
            when(fiscalEngine.calculateTax(eq("FR"), any(), any()))
                .thenReturn(accommodation);

            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(1L); return i; });

            GenerateInvoiceRequest req = new GenerateInvoiceRequest(100L, "Client", null, null, null);
            InvoiceDto result = service.generateFromReservation(req);

            assertThat(result.lines()).hasSize(1);
            assertThat(result.lines().get(0).description()).startsWith("Hebergement");
        }

        @Test
        void shouldHandleSameDayCheckInOut_thenForcesAtLeastOneNight() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            Reservation res = createTestReservation();
            res.setCheckIn(LocalDate.of(2026, 5, 10));
            res.setCheckOut(LocalDate.of(2026, 5, 10)); // 0 nights → forced to 1

            when(invoiceRepository.findAllByReservationId(100L)).thenReturn(List.of());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(res));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));

            TaxResult accommodation = new TaxResult(
                new BigDecimal("250.00"), new BigDecimal("25.00"), new BigDecimal("275.00"),
                new BigDecimal("0.1000"), "TVA 10%", "ACCOMMODATION");
            TaxResult cleaning = new TaxResult(
                new BigDecimal("50.00"), new BigDecimal("10.00"), new BigDecimal("60.00"),
                new BigDecimal("0.2000"), "TVA 20%", "CLEANING");
            when(fiscalEngine.calculateTax(eq("FR"), any(), any()))
                .thenReturn(accommodation, cleaning);

            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(1L); return i; });

            GenerateInvoiceRequest req = new GenerateInvoiceRequest(100L, "Client", null, null, null);
            InvoiceDto result = service.generateFromReservation(req);

            assertThat(result.lines().get(0).description()).contains("(1 nuits)");
        }

        @Test
        void shouldUseTaxIdNumberAsFallbackWhenVatNumberIsNull() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            FiscalProfile fp = createTestFiscalProfile();
            fp.setVatNumber(null);
            fp.setTaxIdNumber("SIRET-12345");

            when(invoiceRepository.findAllByReservationId(100L)).thenReturn(List.of());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(createTestReservation()));
            when(fiscalProfileRepository.findByOrganizationId(1L)).thenReturn(Optional.of(fp));

            TaxResult acc = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "ACCOMMODATION");
            TaxResult cln = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "CLEANING");
            when(fiscalEngine.calculateTax(eq("FR"), any(), any())).thenReturn(acc, cln);
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(1L); return i; });

            GenerateInvoiceRequest req = new GenerateInvoiceRequest(100L, "Client", null, null, null);
            InvoiceDto result = service.generateFromReservation(req);

            assertThat(result.sellerTaxId()).isEqualTo("SIRET-12345");
        }

        @Test
        void shouldThrowIfFiscalProfileNotConfigured() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            when(invoiceRepository.findAllByReservationId(100L)).thenReturn(List.of());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(createTestReservation()));
            when(fiscalProfileRepository.findByOrganizationId(1L)).thenReturn(Optional.empty());

            GenerateInvoiceRequest req = new GenerateInvoiceRequest(100L, "Client", null, null, null);

            assertThatThrownBy(() -> service.generateFromReservation(req))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Profil fiscal");
        }

        @Test
        void shouldSkipTouristTaxWhenComputedAmountIsZero() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            when(invoiceRepository.findAllByReservationId(100L)).thenReturn(List.of());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(createTestReservation()));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));

            TaxResult acc = new TaxResult(
                new BigDecimal("250.00"), new BigDecimal("25.00"), new BigDecimal("275.00"),
                new BigDecimal("0.1000"), "TVA 10%", "ACCOMMODATION");
            TaxResult cln = new TaxResult(
                new BigDecimal("50.00"), new BigDecimal("10.00"), new BigDecimal("60.00"),
                new BigDecimal("0.2000"), "TVA 20%", "CLEANING");
            when(fiscalEngine.calculateTax(eq("FR"), any(), any())).thenReturn(acc, cln);
            // Tourist tax computed to zero — should not add a line
            when(fiscalEngine.calculateTouristTax(eq("FR"), any()))
                .thenReturn(new TouristTaxResult(BigDecimal.ZERO, "Exonere", BigDecimal.ZERO));

            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(1L); return i; });

            GenerateInvoiceRequest req = new GenerateInvoiceRequest(
                100L, null, null, null, new BigDecimal("1.50"));
            InvoiceDto result = service.generateFromReservation(req);

            // No tourist tax line added — only accommodation + cleaning
            assertThat(result.lines()).hasSize(2);
        }

        @Test
        void shouldSetDueDate30DaysAfterInvoiceDate() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            when(invoiceRepository.findAllByReservationId(100L)).thenReturn(List.of());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(createTestReservation()));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));

            TaxResult acc = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "ACCOMMODATION");
            TaxResult cln = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "CLEANING");
            when(fiscalEngine.calculateTax(eq("FR"), any(), any())).thenReturn(acc, cln);
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(1L); return i; });

            GenerateInvoiceRequest req = new GenerateInvoiceRequest(100L, "C", null, null, null);
            InvoiceDto dto = service.generateFromReservation(req);

            assertThat(dto.dueDate()).isEqualTo(dto.invoiceDate().plusDays(30));
        }
    }

    @Nested
    class GenerateFromReservationKafkaOverload {

        @Test
        void shouldGenerateUsingFiscalProfileWhenNoTenantContext() {
            FiscalProfile fp = createTestFiscalProfile();
            fp.setCountryCode("MA");
            fp.setDefaultCurrency("MAD");

            when(fiscalProfileRepository.findByOrganizationId(42L)).thenReturn(Optional.of(fp));

            TaxResult acc = new TaxResult(
                new BigDecimal("250.00"), new BigDecimal("25.00"), new BigDecimal("275.00"),
                new BigDecimal("0.1000"), "TVA 10%", "ACCOMMODATION");
            TaxResult cln = new TaxResult(
                new BigDecimal("50.00"), new BigDecimal("10.00"), new BigDecimal("60.00"),
                new BigDecimal("0.2000"), "TVA 20%", "CLEANING");
            when(fiscalEngine.calculateTax(eq("MA"), any(), any()))
                .thenReturn(acc, cln);

            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(99L); return i; });

            // Reservation has default currency=EUR; null it so fallback to FiscalProfile MAD
            Reservation res = createTestReservation();
            res.setCurrency(null);

            Invoice result = service.generateFromReservation(res, 42L);

            assertThat(result.getCountryCode()).isEqualTo("MA");
            assertThat(result.getCurrency()).isEqualTo("MAD");
            assertThat(result.getOrganizationId()).isEqualTo(42L);
            assertThat(result.getStatus()).isEqualTo(InvoiceStatus.DRAFT);
        }

        @Test
        void shouldUseReservationCurrencyOverFiscalProfileDefault() {
            FiscalProfile fp = createTestFiscalProfile();
            fp.setDefaultCurrency("EUR");

            Reservation res = createTestReservation();
            res.setCurrency("USD");

            when(fiscalProfileRepository.findByOrganizationId(1L)).thenReturn(Optional.of(fp));

            TaxResult acc = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "ACCOMMODATION");
            TaxResult cln = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "CLEANING");
            when(fiscalEngine.calculateTax(eq("FR"), any(), any())).thenReturn(acc, cln);

            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(99L); return i; });

            Invoice result = service.generateFromReservation(res, 1L);

            assertThat(result.getCurrency()).isEqualTo("USD");
        }

        @Test
        void shouldDefaultToEurWhenFiscalProfileHasNoCurrency() {
            FiscalProfile fp = createTestFiscalProfile();
            fp.setDefaultCurrency(null);
            fp.setCountryCode(null);

            Reservation res = createTestReservation();
            res.setCurrency(null);

            when(fiscalProfileRepository.findByOrganizationId(1L)).thenReturn(Optional.of(fp));

            TaxResult acc = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "ACCOMMODATION");
            TaxResult cln = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "CLEANING");
            when(fiscalEngine.calculateTax(eq("FR"), any(), any())).thenReturn(acc, cln);

            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(99L); return i; });

            Invoice result = service.generateFromReservation(res, 1L);

            assertThat(result.getCurrency()).isEqualTo("EUR");
            assertThat(result.getCountryCode()).isEqualTo("FR");
        }

        @Test
        void shouldDefaultBuyerNameToClientWhenGuestNameNull() {
            FiscalProfile fp = createTestFiscalProfile();

            Reservation res = createTestReservation();
            res.setGuestName(null);

            when(fiscalProfileRepository.findByOrganizationId(1L)).thenReturn(Optional.of(fp));

            TaxResult acc = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "ACCOMMODATION");
            TaxResult cln = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "CLEANING");
            when(fiscalEngine.calculateTax(eq("FR"), any(), any())).thenReturn(acc, cln);

            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(99L); return i; });

            Invoice result = service.generateFromReservation(res, 1L);

            assertThat(result.getBuyerName()).isEqualTo("Client");
        }

        @Test
        void shouldThrowWhenFiscalProfileMissing() {
            when(fiscalProfileRepository.findByOrganizationId(1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.generateFromReservation(createTestReservation(), 1L))
                .isInstanceOf(IllegalStateException.class);
        }
    }

    /**
     * Regression Z3-BUGS-04 : les montants de la reservation (roomRevenue, cleaningFee)
     * sont les montants ENCAISSES aupres du guest (TTC via Stripe/OTA). Le service doit
     * en deduire HT et TVA (HT = TTC / (1 + taux)) — et non ajouter la TVA par-dessus,
     * ce qui produisait une facture totalTtc > montant reellement paye.
     */
    @Nested
    class TtcDecomposition {

        private void stubRates() {
            // Le moteur fiscal ne sert qu'a resoudre le taux applicable :
            // 10% hebergement puis 20% menage (les montants retournes sont ignores).
            TaxResult accommodationRate = new TaxResult(
                new BigDecimal("250.00"), new BigDecimal("25.00"), new BigDecimal("275.00"),
                new BigDecimal("0.1000"), "TVA 10%", "ACCOMMODATION");
            TaxResult cleaningRate = new TaxResult(
                new BigDecimal("50.00"), new BigDecimal("10.00"), new BigDecimal("60.00"),
                new BigDecimal("0.2000"), "TVA 20%", "CLEANING");
            when(fiscalEngine.calculateTax(eq("FR"), any(), any()))
                .thenReturn(accommodationRate, cleaningRate);
        }

        @Test
        void whenAutoInvoicingPaidReservation_thenTotalTtcEqualsAmountCharged() {
            // Arrange — roomRevenue 250.00 et cleaningFee 50.00 = montants payes par le guest
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));
            stubRates();
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(1L); return i; });

            // Act — surcharge webhook (auto-facture marquee PAID par AutoInvoiceService)
            Invoice result = service.generateFromReservation(createTestReservation(), 1L);

            // Assert — la facture affiche exactement ce qui a ete encaisse : 300.00
            assertThat(result.getTotalTtc()).isEqualByComparingTo("300.00");

            InvoiceLine accommodation = result.getLines().get(0);
            assertThat(accommodation.getTotalTtc()).isEqualByComparingTo("250.00");
            assertThat(accommodation.getTotalHt()).isEqualByComparingTo("227.27");   // 250 / 1.10
            assertThat(accommodation.getTaxAmount()).isEqualByComparingTo("22.73");  // 250 - 227.27
            assertThat(accommodation.getUnitPriceHt()).isEqualByComparingTo("227.27");

            InvoiceLine cleaning = result.getLines().get(1);
            assertThat(cleaning.getTotalTtc()).isEqualByComparingTo("50.00");
            assertThat(cleaning.getTotalHt()).isEqualByComparingTo("41.67");         // 50 / 1.20
            assertThat(cleaning.getTaxAmount()).isEqualByComparingTo("8.33");

            assertThat(result.getTotalHt()).isEqualByComparingTo("268.94");
            assertThat(result.getTotalTax()).isEqualByComparingTo("31.06");
        }

        @Test
        void whenGeneratingManualDraftFromReservation_thenLineAmountsDerivedFromTtc() {
            // Arrange — meme regle pour le chemin manuel (InvoiceController)
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");
            when(invoiceRepository.findAllByReservationId(100L))
                .thenReturn(List.of());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(createTestReservation()));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));
            stubRates();
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(1L); return i; });

            // Act
            GenerateInvoiceRequest request = new GenerateInvoiceRequest(100L, "Client", null, null, null);
            InvoiceDto result = service.generateFromReservation(request);

            // Assert — totalTtc == roomRevenue + cleaningFee == montant encaisse
            assertThat(result.totalTtc()).isEqualByComparingTo("300.00");
            assertThat(result.lines().get(0).totalHt()).isEqualByComparingTo("227.27");
            assertThat(result.lines().get(0).taxAmount()).isEqualByComparingTo("22.73");
            assertThat(result.lines().get(1).totalHt()).isEqualByComparingTo("41.67");
            assertThat(result.lines().get(1).taxAmount()).isEqualByComparingTo("8.33");
        }

        @Test
        void whenTaxRateIsZero_thenHtEqualsTtcAndNoTax() {
            // Arrange — taux nul (ex: regime exonere) : pas de division, pas de TVA
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));
            TaxResult zeroRate = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "ACCOMMODATION");
            when(fiscalEngine.calculateTax(eq("FR"), any(), any())).thenReturn(zeroRate);
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(1L); return i; });

            Reservation res = createTestReservation();
            res.setCleaningFee(null); // une seule ligne

            // Act
            Invoice result = service.generateFromReservation(res, 1L);

            // Assert
            assertThat(result.getTotalTtc()).isEqualByComparingTo("250.00");
            assertThat(result.getTotalHt()).isEqualByComparingTo("250.00");
            assertThat(result.getTotalTax()).isEqualByComparingTo("0.00");
        }
    }

    @Nested
    class GenerateFromInterventionAuto {

        private Intervention buildIntervention(Long id, String title, BigDecimal cost) {
            Intervention intervention = new Intervention();
            intervention.setId(id);
            intervention.setTitle(title);
            intervention.setEstimatedCost(cost);
            return intervention;
        }

        @Test
        void shouldGenerateDraftFromInterventionWithStandardTaxLine() {
            FiscalProfile fp = createTestFiscalProfile();
            when(fiscalProfileRepository.findByOrganizationId(1L)).thenReturn(Optional.of(fp));

            TaxResult tax = new TaxResult(
                new BigDecimal("200.00"), new BigDecimal("40.00"), new BigDecimal("240.00"),
                new BigDecimal("0.2000"), "TVA 20%", "STANDARD");
            when(fiscalEngine.calculateTax(eq("FR"), any(), any())).thenReturn(tax);
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(50L); return i; });

            Invoice result = service.generateFromIntervention(
                buildIntervention(7L, "Plomberie urgente", new BigDecimal("200.00")), 1L);

            assertThat(result.getInterventionId()).isEqualTo(7L);
            assertThat(result.getStatus()).isEqualTo(InvoiceStatus.DRAFT);
            assertThat(result.getLines()).hasSize(1);
            assertThat(result.getLines().get(0).getDescription()).contains("Plomberie urgente");
        }

        @Test
        void shouldUseClientAsBuyerWhenOwnerHasNoName() {
            FiscalProfile fp = createTestFiscalProfile();
            when(fiscalProfileRepository.findByOrganizationId(1L)).thenReturn(Optional.of(fp));

            // No owner attached → "Client"
            Intervention i = buildIntervention(7L, "Test", BigDecimal.ZERO);
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice iv = inv.getArgument(0); iv.setId(50L); return iv; });

            Invoice result = service.generateFromIntervention(i, 1L);

            assertThat(result.getBuyerName()).isEqualTo("Client");
            // No tax line because cost = 0
            assertThat(result.getLines()).isEmpty();
        }

        @Test
        void shouldHandleNullEstimatedCost() {
            FiscalProfile fp = createTestFiscalProfile();
            when(fiscalProfileRepository.findByOrganizationId(1L)).thenReturn(Optional.of(fp));

            Intervention i = buildIntervention(7L, "Test", null);
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice iv = inv.getArgument(0); iv.setId(50L); return iv; });

            Invoice result = service.generateFromIntervention(i, 1L);
            assertThat(result.getLines()).isEmpty();
        }

        @Test
        void shouldThrowWhenFiscalProfileMissing() {
            when(fiscalProfileRepository.findByOrganizationId(1L)).thenReturn(Optional.empty());

            Intervention i = buildIntervention(7L, "Test", BigDecimal.TEN);

            assertThatThrownBy(() -> service.generateFromIntervention(i, 1L))
                .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    class GenerateDuplicate {

        private Invoice buildIssuedInvoice() {
            Invoice inv = new Invoice();
            inv.setId(10L);
            inv.setOrganizationId(1L);
            inv.setInvoiceNumber("FA-2026-00001");
            inv.setInvoiceDate(LocalDate.now());
            inv.setDueDate(LocalDate.now().plusDays(30));
            inv.setCurrency("EUR");
            inv.setCountryCode("FR");
            inv.setStatus(InvoiceStatus.ISSUED);
            inv.setSellerName("SARL Test");
            inv.setBuyerName("Client Test");
            inv.setReservationId(99L);
            inv.setTotalHt(new BigDecimal("100.00"));
            inv.setTotalTax(new BigDecimal("10.00"));
            inv.setTotalTtc(new BigDecimal("110.00"));

            InvoiceLine line = new InvoiceLine();
            line.setLineNumber(1);
            line.setDescription("Hebergement");
            line.setQuantity(BigDecimal.ONE);
            line.setUnitPriceHt(new BigDecimal("100.00"));
            line.setTaxCategory("ACCOMMODATION");
            line.setTaxRate(new BigDecimal("0.1000"));
            line.setTaxAmount(new BigDecimal("10.00"));
            line.setTotalHt(new BigDecimal("100.00"));
            line.setTotalTtc(new BigDecimal("110.00"));
            inv.addLine(line);
            return inv;
        }

        @Test
        void shouldCreateFirstDuplicateWithSuffix1() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Invoice original = buildIssuedInvoice();
            when(invoiceRepository.findById(10L)).thenReturn(Optional.of(original));
            when(invoiceRepository.findByDuplicateOfId(10L)).thenReturn(List.of());
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(20L); return i; });

            InvoiceDto dup = service.generateDuplicate(10L);

            assertThat(dup.invoiceNumber()).isEqualTo("FA-2026-00001-DUP-1");
            assertThat(dup.duplicateOfId()).isEqualTo(10L);
            assertThat(dup.status()).isEqualTo(InvoiceStatus.ISSUED);
            assertThat(dup.legalMentions()).contains("DUPLICATA");
            assertThat(dup.lines()).hasSize(1);
        }

        @Test
        void shouldIncrementDuplicateCounter() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Invoice original = buildIssuedInvoice();
            // Existing 2 dups → next should be -DUP-3
            when(invoiceRepository.findById(10L)).thenReturn(Optional.of(original));
            when(invoiceRepository.findByDuplicateOfId(10L))
                .thenReturn(List.of(new Invoice(), new Invoice()));
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(22L); return i; });

            InvoiceDto dup = service.generateDuplicate(10L);

            assertThat(dup.invoiceNumber()).endsWith("-DUP-3");
        }

        @Test
        void shouldCopyPaymentInfoWhenOriginalIsPaid() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Invoice original = buildIssuedInvoice();
            original.setStatus(InvoiceStatus.PAID);
            original.setPaymentMethod("STRIPE");
            original.setPaidAt(java.time.LocalDateTime.now());

            when(invoiceRepository.findById(10L)).thenReturn(Optional.of(original));
            when(invoiceRepository.findByDuplicateOfId(10L)).thenReturn(List.of());
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(20L); return i; });

            InvoiceDto dup = service.generateDuplicate(10L);

            assertThat(dup.paymentMethod()).isEqualTo("STRIPE");
            assertThat(dup.paidAt()).isNotNull();
        }

        @Test
        void shouldThrowIfDuplicatedInvoiceBelongsToDifferentOrg() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Invoice original = buildIssuedInvoice();
            original.setOrganizationId(2L); // different

            when(invoiceRepository.findById(10L)).thenReturn(Optional.of(original));

            assertThatThrownBy(() -> service.generateDuplicate(10L))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void shouldThrowIfInvoiceNotFound() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(invoiceRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.generateDuplicate(99L))
                .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    class CreateIssuedFromDocumentGeneration {

        @Test
        void shouldReturnExistingInvoiceWhenAlreadyExistsForReservation() {
            Invoice existing = new Invoice();
            existing.setId(100L);
            existing.setInvoiceNumber("FA-2026-00001");
            existing.setStatus(InvoiceStatus.ISSUED);
            // Already linked → linkDocumentGeneration short-circuits
            existing.setDocumentGenerationId(999L);

            when(invoiceRepository.findAllByReservationId(50L)).thenReturn(List.of(existing));

            Invoice result = service.createIssuedFromDocumentGeneration(
                ReferenceType.RESERVATION, 50L, 1L, "FA-2026-00001", 999L);

            assertThat(result).isSameAs(existing);
        }

        @Test
        void shouldLinkDocumentGenerationIfMissingOnExistingInvoice() {
            Invoice existing = new Invoice();
            existing.setId(100L);
            existing.setInvoiceNumber("FA-2026-00001");
            existing.setStatus(InvoiceStatus.ISSUED);
            existing.setDocumentGenerationId(null);

            when(invoiceRepository.findAllByReservationId(50L)).thenReturn(List.of(existing));
            when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

            Invoice result = service.createIssuedFromDocumentGeneration(
                ReferenceType.RESERVATION, 50L, 1L, "FA-2026-00001", 999L);

            assertThat(result.getDocumentGenerationId()).isEqualTo(999L);
        }

        @Test
        void shouldNotReSaveWhenDocumentGenerationIdAlreadySet() {
            Invoice existing = new Invoice();
            existing.setId(100L);
            existing.setInvoiceNumber("FA-2026-00001");
            existing.setStatus(InvoiceStatus.ISSUED);
            existing.setDocumentGenerationId(888L);

            when(invoiceRepository.findAllByReservationId(50L)).thenReturn(List.of(existing));

            Invoice result = service.createIssuedFromDocumentGeneration(
                ReferenceType.RESERVATION, 50L, 1L, "FA-2026-00001", 999L);

            assertThat(result.getDocumentGenerationId()).isEqualTo(888L);
            verify(invoiceRepository, never()).save(any());
        }

        @Test
        void shouldCreateIssuedInvoiceForReservationWhenNotExisting() {
            // No existing Invoice
            when(invoiceRepository.findAllByReservationId(50L)).thenReturn(List.of());
            when(reservationRepository.findById(50L)).thenReturn(Optional.of(createTestReservation()));

            FiscalProfile fp = createTestFiscalProfile();
            when(fiscalProfileRepository.findByOrganizationId(1L)).thenReturn(Optional.of(fp));

            TaxResult acc = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "ACCOMMODATION");
            TaxResult cln = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "CLEANING");
            when(fiscalEngine.calculateTax(eq("FR"), any(), any())).thenReturn(acc, cln);

            when(numberingService.generateNextNumber(1L)).thenReturn("FA2026-00042");
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(70L); return i; });

            Invoice result = service.createIssuedFromDocumentGeneration(
                ReferenceType.RESERVATION, 50L, 1L, "FAC-2026-00007", 999L);

            assertThat(result.getStatus()).isEqualTo(InvoiceStatus.ISSUED);
            assertThat(result.getDocumentGenerationId()).isEqualTo(999L);
            // Z3-BUGS-07 : la facture est numerotee par l'UNIQUE sequence Invoice,
            // pas par le numero du document PDF (double sequence = doublons NF).
            assertThat(result.getInvoiceNumber()).isEqualTo("FA2026-00042");
            assertThat(result.getInvoiceNumber()).isNotEqualTo("FAC-2026-00007");
        }

        @Test
        void shouldCreateIssuedInvoiceForInterventionWhenNotExisting() {
            stubInvoicesByIntervention(60L, List.of());

            Intervention i = new Intervention();
            i.setId(60L);
            i.setTitle("Test");
            i.setEstimatedCost(BigDecimal.ZERO);

            when(interventionRepository.findById(60L)).thenReturn(Optional.of(i));

            FiscalProfile fp = createTestFiscalProfile();
            when(fiscalProfileRepository.findByOrganizationId(1L)).thenReturn(Optional.of(fp));

            when(numberingService.generateNextNumber(1L)).thenReturn("FA2026-00043");
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice iv = inv.getArgument(0); iv.setId(70L); return iv; });

            Invoice result = service.createIssuedFromDocumentGeneration(
                ReferenceType.INTERVENTION, 60L, 1L, "FAC-2026-00008", 888L);

            assertThat(result.getStatus()).isEqualTo(InvoiceStatus.ISSUED);
            assertThat(result.getInvoiceNumber()).isEqualTo("FA2026-00043");
        }

        @Test
        void whenInvoiceCreatedFromDocumentGeneration_thenNumberingHappensViaInvoiceSequence() {
            when(invoiceRepository.findAllByReservationId(50L)).thenReturn(List.of());
            when(reservationRepository.findById(50L)).thenReturn(Optional.of(createTestReservation()));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));

            TaxResult acc = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "ACCOMMODATION");
            TaxResult cln = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "CLEANING");
            when(fiscalEngine.calculateTax(eq("FR"), any(), any())).thenReturn(acc, cln);

            when(numberingService.generateNextNumber(1L)).thenReturn("FA2026-00099");
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice iv = inv.getArgument(0); iv.setId(70L); return iv; });

            service.createIssuedFromDocumentGeneration(
                ReferenceType.RESERVATION, 50L, 1L, "FAC-2026-00100", 999L);

            // Un seul chemin de numerotation pour l'entite Invoice
            verify(numberingService).generateNextNumber(1L);
        }

        /**
         * Reliquat A2 : plusieurs factures peuvent coexister pour une meme
         * intervention (annulee + re-emission). L'idempotence retrouve la
         * facture ACTIVE sans IncorrectResultSizeDataAccessException et ne
         * re-numerote pas.
         */
        @Test
        void whenInterventionHasCancelledInvoiceAndActiveReissue_thenActiveInvoiceIsReturned() {
            Invoice cancelled = new Invoice();
            cancelled.setId(70L);
            cancelled.setInterventionId(60L);
            cancelled.setInvoiceNumber("FA2026-00010");
            cancelled.setStatus(InvoiceStatus.CANCELLED);

            Invoice active = new Invoice();
            active.setId(71L);
            active.setInterventionId(60L);
            active.setInvoiceNumber("FA2026-00011");
            active.setStatus(InvoiceStatus.ISSUED);
            active.setDocumentGenerationId(888L);

            stubInvoicesByIntervention(60L, List.of(cancelled, active));

            Invoice result = service.createIssuedFromDocumentGeneration(
                ReferenceType.INTERVENTION, 60L, 1L, "FAC-2026-00009", 888L);

            assertThat(result).isSameAs(active);
            verify(numberingService, never()).generateNextNumber(anyLong());
            verify(invoiceRepository, never()).save(any());
        }

        /**
         * Reliquat A2 : les duplicatas (-DUP, duplicateOfId renseigne) et les
         * factures annulees sont exclus de l'idempotence — meme semantique que
         * l'index unique partiel uq_invoices_intervention_active (0226) : une
         * nouvelle facture est creee.
         */
        @Test
        void whenInterventionHasOnlyCancelledAndDuplicataInvoices_thenNewInvoiceIsCreated() {
            Invoice cancelled = new Invoice();
            cancelled.setId(70L);
            cancelled.setInterventionId(60L);
            cancelled.setInvoiceNumber("FA2026-00010");
            cancelled.setStatus(InvoiceStatus.CANCELLED);

            Invoice duplicata = new Invoice();
            duplicata.setId(72L);
            duplicata.setInterventionId(60L);
            duplicata.setInvoiceNumber("FA2026-00010-DUP-1");
            duplicata.setStatus(InvoiceStatus.ISSUED);
            duplicata.setDuplicateOfId(70L);

            stubInvoicesByIntervention(60L, List.of(cancelled, duplicata));

            Intervention i = new Intervention();
            i.setId(60L);
            i.setTitle("Test");
            i.setEstimatedCost(BigDecimal.ZERO);
            when(interventionRepository.findById(60L)).thenReturn(Optional.of(i));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));
            when(numberingService.generateNextNumber(1L)).thenReturn("FA2026-00044");
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice iv = inv.getArgument(0); iv.setId(73L); return iv; });

            Invoice result = service.createIssuedFromDocumentGeneration(
                ReferenceType.INTERVENTION, 60L, 1L, "FAC-2026-00012", 889L);

            assertThat(result.getId()).isEqualTo(73L);
            assertThat(result.getStatus()).isEqualTo(InvoiceStatus.ISSUED);
            assertThat(result.getInvoiceNumber()).isEqualTo("FA2026-00044");
        }

        @Test
        void shouldThrowWhenReservationNotFound() {
            when(invoiceRepository.findAllByReservationId(99L)).thenReturn(List.of());
            when(reservationRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.createIssuedFromDocumentGeneration(
                ReferenceType.RESERVATION, 99L, 1L, "X", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Reservation");
        }

        @Test
        void shouldThrowWhenInterventionNotFound() {
            stubInvoicesByIntervention(99L, List.of());
            when(interventionRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.createIssuedFromDocumentGeneration(
                ReferenceType.INTERVENTION, 99L, 1L, "X", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Intervention");
        }

        @Test
        void shouldThrowForUnsupportedReferenceType() {
            // PROVIDER_EXPENSE is not supported by createIssuedFromDocumentGeneration
            // findExistingInvoice returns Optional.empty() for non-reservation/intervention types
            assertThatThrownBy(() -> service.createIssuedFromDocumentGeneration(
                ReferenceType.PROVIDER_EXPENSE, 1L, 1L, "X", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("non supporte");
        }
    }

    @Nested
    class CancelInvoiceExtra {

        @Test
        void shouldCancelPaidInvoice() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Invoice paid = new Invoice();
            paid.setId(10L);
            paid.setOrganizationId(1L);
            paid.setInvoiceNumber("FA-2026-00001");
            paid.setInvoiceDate(LocalDate.now());
            paid.setCurrency("EUR");
            paid.setCountryCode("FR");
            paid.setStatus(InvoiceStatus.PAID);
            paid.setTotalHt(BigDecimal.ZERO);
            paid.setTotalTax(BigDecimal.ZERO);
            paid.setTotalTtc(BigDecimal.ZERO);

            when(invoiceRepository.findById(10L)).thenReturn(Optional.of(paid));
            when(numberingService.generateNextNumber()).thenReturn("FA-2026-00002");
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); if (i.getStatus() == InvoiceStatus.CREDIT_NOTE) i.setId(11L); return i; });

            InvoiceDto creditNote = service.cancelInvoice(10L, null);

            assertThat(creditNote.status()).isEqualTo(InvoiceStatus.CREDIT_NOTE);
            // No reason → no " - Motif:" suffix
            assertThat(creditNote.legalMentions()).doesNotContain("Motif:");
        }

        @Test
        void shouldThrowWhenCancelInvoiceFromDifferentOrg() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Invoice other = new Invoice();
            other.setId(10L);
            other.setOrganizationId(2L); // different
            other.setStatus(InvoiceStatus.ISSUED);

            when(invoiceRepository.findById(10L)).thenReturn(Optional.of(other));

            assertThatThrownBy(() -> service.cancelInvoice(10L, "test"))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void shouldThrowWhenCancelNonexistentInvoice() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(invoiceRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.cancelInvoice(99L, "test"))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void shouldThrowWhenInvoiceIsCancelled() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Invoice cancelled = new Invoice();
            cancelled.setId(10L);
            cancelled.setOrganizationId(1L);
            cancelled.setStatus(InvoiceStatus.CANCELLED);

            when(invoiceRepository.findById(10L)).thenReturn(Optional.of(cancelled));

            assertThatThrownBy(() -> service.cancelInvoice(10L, "test"))
                .isInstanceOf(IllegalStateException.class);
        }
    }

    /**
     * T-SOLID-8 : les deux surcharges generateFromReservation (flux manuel et flux
     * webhook) passent par le meme chemin de construction buildReservationDraft —
     * les regles fiscales (en-tete, echeance, decomposition TTC→HT) ne peuvent
     * plus diverger silencieusement entre une facture manuelle et une auto-facture.
     */
    @Nested
    class SingleFiscalConstructionPath {

        @Test
        void whenManualAndWebhookFlowsInvoiceSameReservation_thenFiscalLinesAreIdentical() {
            // Arrange — meme reservation, meme profil fiscal, memes taux pour les deux flux
            Reservation res = createTestReservation();
            res.setCurrency("EUR");

            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");
            when(invoiceRepository.findAllByReservationId(100L)).thenReturn(List.of());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(res));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));

            TaxResult accommodationRate = new TaxResult(
                new BigDecimal("250.00"), new BigDecimal("25.00"), new BigDecimal("275.00"),
                new BigDecimal("0.1000"), "TVA 10%", "ACCOMMODATION");
            TaxResult cleaningRate = new TaxResult(
                new BigDecimal("50.00"), new BigDecimal("10.00"), new BigDecimal("60.00"),
                new BigDecimal("0.2000"), "TVA 20%", "CLEANING");
            // 4 resolutions de taux : 2 pour le flux manuel, 2 pour le flux webhook
            when(fiscalEngine.calculateTax(eq("FR"), any(), any()))
                .thenReturn(accommodationRate, cleaningRate, accommodationRate, cleaningRate);

            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(1L); return i; });

            // Act — flux manuel puis flux webhook sur la meme reservation
            GenerateInvoiceRequest request = new GenerateInvoiceRequest(
                100L, "John Doe", null, null, null);
            InvoiceDto manual = service.generateFromReservation(request);
            Invoice webhook = service.generateFromReservation(res, 1L);

            // Assert — lignes et en-tete fiscalement identiques
            assertThat(manual.lines()).hasSize(webhook.getLines().size());
            for (int i = 0; i < manual.lines().size(); i++) {
                assertThat(manual.lines().get(i).description())
                    .isEqualTo(webhook.getLines().get(i).getDescription());
                assertThat(manual.lines().get(i).totalHt())
                    .isEqualByComparingTo(webhook.getLines().get(i).getTotalHt());
                assertThat(manual.lines().get(i).taxAmount())
                    .isEqualByComparingTo(webhook.getLines().get(i).getTaxAmount());
                assertThat(manual.lines().get(i).totalTtc())
                    .isEqualByComparingTo(webhook.getLines().get(i).getTotalTtc());
                assertThat(manual.lines().get(i).taxRate())
                    .isEqualByComparingTo(webhook.getLines().get(i).getTaxRate());
            }
            assertThat(manual.totalTtc()).isEqualByComparingTo(webhook.getTotalTtc());
            assertThat(manual.totalHt()).isEqualByComparingTo(webhook.getTotalHt());
            assertThat(manual.totalTax()).isEqualByComparingTo(webhook.getTotalTax());
            assertThat(manual.dueDate()).isEqualTo(webhook.getDueDate());
            assertThat(manual.sellerName()).isEqualTo(webhook.getSellerName());
            assertThat(manual.sellerTaxId()).isEqualTo(webhook.getSellerTaxId());
            assertThat(manual.buyerName()).isEqualTo(webhook.getBuyerName());
        }
    }

    /**
     * Reliquat A2 : findByReservationIdAndInvoiceType retourne un Optional alors que
     * plusieurs factures GUEST peuvent coexister (annulee + avoir + re-emission).
     * Le service filtre desormais via findAllByReservationId sur la semantique de
     * l'index unique partiel uq_invoices_reservation_type_active (migration 0226).
     */
    @Nested
    class ActiveGuestInvoiceLookup {

        private Invoice guestInvoice(Long id, InvoiceStatus status) {
            Invoice invoice = new Invoice();
            invoice.setId(id);
            invoice.setOrganizationId(1L);
            invoice.setReservationId(100L);
            invoice.setInvoiceNumber("FA2026-0000" + id);
            invoice.setStatus(status);
            return invoice;
        }

        @Test
        void whenOnlyCancelledAndCreditNoteExist_thenRegenerationIsAllowed() {
            // Arrange — historique : facture annulee + avoir (plus aucune facture active)
            Invoice cancelled = guestInvoice(1L, InvoiceStatus.CANCELLED);
            Invoice creditNote = guestInvoice(2L, InvoiceStatus.CREDIT_NOTE);

            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");
            when(invoiceRepository.findAllByReservationId(100L))
                .thenReturn(List.of(cancelled, creditNote));
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(createTestReservation()));
            when(fiscalProfileRepository.findByOrganizationId(1L))
                .thenReturn(Optional.of(createTestFiscalProfile()));

            TaxResult acc = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "ACCOMMODATION");
            TaxResult cln = new TaxResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, "n/a", "CLEANING");
            when(fiscalEngine.calculateTax(eq("FR"), any(), any())).thenReturn(acc, cln);
            when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(inv -> { Invoice i = inv.getArgument(0); i.setId(3L); return i; });

            // Act — pas d'IncorrectResultSize, pas de blocage par la facture annulee
            GenerateInvoiceRequest request = new GenerateInvoiceRequest(100L, "Client", null, null, null);
            InvoiceDto result = service.generateFromReservation(request);

            // Assert
            assertThat(result.status()).isEqualTo(InvoiceStatus.DRAFT);
        }

        @Test
        void whenActiveInvoiceCoexistsWithCancelledOnes_thenDuplicateCheckBlocks() {
            // Arrange — 1 facture active + 1 annulee (etat post-dedoublonnage 0226)
            Invoice cancelled = guestInvoice(1L, InvoiceStatus.CANCELLED);
            Invoice active = guestInvoice(2L, InvoiceStatus.ISSUED);

            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");
            when(invoiceRepository.findAllByReservationId(100L))
                .thenReturn(List.of(cancelled, active));

            // Act & Assert — la facture active bloque toujours la regeneration
            GenerateInvoiceRequest request = new GenerateInvoiceRequest(100L, null, null, null, null);
            assertThatThrownBy(() -> service.generateFromReservation(request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("FA2026-00002");
        }

        @Test
        void whenDuplicateAndCommissionInvoicesExist_thenTheyAreIgnoredByIdempotenceLookup() {
            // Arrange — duplicata (duplicateOfId) + facture COMMISSION : hors perimetre GUEST actif
            Invoice duplicate = guestInvoice(5L, InvoiceStatus.ISSUED);
            duplicate.setDuplicateOfId(1L);
            Invoice commission = guestInvoice(6L, InvoiceStatus.ISSUED);
            commission.setInvoiceType(InvoiceType.COMMISSION);
            Invoice active = guestInvoice(7L, InvoiceStatus.ISSUED);
            active.setDocumentGenerationId(999L);

            when(invoiceRepository.findAllByReservationId(50L))
                .thenReturn(List.of(duplicate, commission, active));

            // Act — idempotence createIssuedFromDocumentGeneration : retrouve la facture active
            Invoice result = service.createIssuedFromDocumentGeneration(
                ReferenceType.RESERVATION, 50L, 1L, "FAC-2026-00001", 999L);

            // Assert
            assertThat(result).isSameAs(active);
        }
    }
}
