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
    private FiscalProfileRepository fiscalProfileRepository;

    @Mock
    private FiscalEngine fiscalEngine;

    @Mock
    private InvoiceNumberingService numberingService;

    @Mock
    private TenantContext tenantContext;

    private InvoiceGeneratorService service;

    @BeforeEach
    void setUp() {
        service = new InvoiceGeneratorService(
            invoiceRepository, reservationRepository, fiscalProfileRepository,
            fiscalEngine, numberingService, tenantContext);
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
            when(tenantContext.getDefaultCurrency()).thenReturn("EUR");

            when(invoiceRepository.findByReservationId(100L)).thenReturn(Optional.empty());
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
            when(tenantContext.getDefaultCurrency()).thenReturn("EUR");

            Invoice existing = new Invoice();
            existing.setInvoiceNumber("FA2026-00001");
            when(invoiceRepository.findByReservationId(100L)).thenReturn(Optional.of(existing));

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
            when(tenantContext.getDefaultCurrency()).thenReturn("EUR");
            when(invoiceRepository.findByReservationId(999L)).thenReturn(Optional.empty());
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
            when(tenantContext.getDefaultCurrency()).thenReturn("EUR");

            when(invoiceRepository.findByReservationId(100L)).thenReturn(Optional.empty());
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
            when(tenantContext.getDefaultCurrency()).thenReturn("EUR");

            when(invoiceRepository.findByReservationId(100L)).thenReturn(Optional.empty());
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
    }
}
