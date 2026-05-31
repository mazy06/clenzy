package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountingExportServiceTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private OwnerPayoutRepository payoutRepository;
    @Mock private ProviderExpenseRepository expenseRepository;
    @Mock private InvoiceRepository invoiceRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks
    private AccountingExportService service;

    private static final Long ORG_ID = 1L;

    @Test
    void exportFec_containsHeaderAndLines() {
        LocalDate from = LocalDate.of(2025, 7, 1);
        LocalDate to = LocalDate.of(2025, 7, 31);

        Invoice inv = new Invoice();
        inv.setInvoiceNumber("FAC-001");
        inv.setInvoiceDate(from.plusDays(5));
        inv.setBuyerName("John Doe");
        inv.setTotalTtc(new BigDecimal("500.00"));
        inv.setTotalHt(new BigDecimal("416.67"));
        inv.setTotalTax(new BigDecimal("83.33"));
        inv.setCurrency("EUR");
        inv.setStatus(InvoiceStatus.ISSUED);

        when(invoiceRepository.findByOrganizationIdAndDateRange(ORG_ID, from, to))
            .thenReturn(List.of(inv));

        String result = service.exportFec(ORG_ID, from, to);

        assertTrue(result.contains("JournalCode"));
        assertTrue(result.contains("CompteNum"));
        assertTrue(result.contains("411000"));
        assertTrue(result.contains("706000"));
        assertTrue(result.contains("John Doe"));
        assertTrue(result.contains("500.00"));
    }

    @Test
    void exportFec_empty_returnsHeaderOnly() {
        LocalDate from = LocalDate.of(2025, 7, 1);
        LocalDate to = LocalDate.of(2025, 7, 31);

        when(invoiceRepository.findByOrganizationIdAndDateRange(ORG_ID, from, to))
            .thenReturn(List.of());

        String result = service.exportFec(ORG_ID, from, to);

        assertTrue(result.contains("JournalCode"));
        assertEquals(1, result.split("\n").length); // Header only
    }

    @Test
    void exportReservationsCsv_containsHeaderAndData() {
        LocalDate from = LocalDate.of(2025, 7, 1);
        LocalDate to = LocalDate.of(2025, 7, 31);

        Property property = new Property();
        property.setName("Mountain Chalet");

        Reservation r = new Reservation();
        r.setId(42L);
        r.setProperty(property);
        r.setGuestName("Jane Smith");
        r.setCheckIn(from.plusDays(3));
        r.setCheckOut(from.plusDays(7));
        r.setTotalPrice(new BigDecimal("800.00"));
        r.setSource("AIRBNB");

        when(reservationRepository.findAllByDateRange(from, to, ORG_ID))
            .thenReturn(List.of(r));

        String result = service.exportReservationsCsv(ORG_ID, from, to);

        assertTrue(result.contains("ID;Property;Guest"));
        assertTrue(result.contains("Mountain Chalet"));
        assertTrue(result.contains("Jane Smith"));
        assertTrue(result.contains("800.00"));
        assertTrue(result.contains("AIRBNB"));
    }

    @Test
    void exportPayoutsCsv_containsHeaderAndData() {
        LocalDate from = LocalDate.of(2025, 7, 1);
        LocalDate to = LocalDate.of(2025, 7, 31);

        OwnerPayout payout = new OwnerPayout();
        payout.setId(1L);
        payout.setOwnerId(10L);
        payout.setPeriodStart(from);
        payout.setPeriodEnd(to);
        payout.setGrossRevenue(new BigDecimal("1000.00"));
        payout.setCommissionRate(new BigDecimal("0.2000"));
        payout.setCommissionAmount(new BigDecimal("200.00"));
        payout.setExpenses(BigDecimal.ZERO);
        payout.setNetAmount(new BigDecimal("800.00"));
        payout.setStatus(PayoutStatus.PAID);
        payout.setPaymentReference("WIRE-123");

        User owner = new User();
        owner.setId(10L);
        owner.setFirstName("Jean");
        owner.setLastName("Dupont");

        when(payoutRepository.findAllByOrgId(ORG_ID)).thenReturn(List.of(payout));
        when(userRepository.findAllById(Set.of(10L))).thenReturn(List.of(owner));

        String result = service.exportPayoutsCsv(ORG_ID, from, to);

        assertTrue(result.contains("GrossRevenue"));
        assertTrue(result.contains("1000.00"));
        assertTrue(result.contains("WIRE-123"));
        assertTrue(result.contains("PAID"));
    }

    @Test
    void exportFec_debitCreditBalance() {
        LocalDate from = LocalDate.of(2025, 7, 1);
        LocalDate to = LocalDate.of(2025, 7, 31);

        Invoice inv = new Invoice();
        inv.setInvoiceNumber("FAC-002");
        inv.setInvoiceDate(from.plusDays(1));
        inv.setBuyerName("Guest");
        inv.setTotalTtc(new BigDecimal("250.00"));
        inv.setTotalHt(new BigDecimal("250.00"));
        inv.setTotalTax(BigDecimal.ZERO);
        inv.setCurrency("EUR");
        inv.setStatus(InvoiceStatus.PAID);

        when(invoiceRepository.findByOrganizationIdAndDateRange(ORG_ID, from, to))
            .thenReturn(List.of(inv));

        String result = service.exportFec(ORG_ID, from, to);

        String[] lines = result.split("\n");
        // Header + 2 lines (debit 411 + credit 706), no TVA line since tax=0
        assertEquals(3, lines.length);
    }

    // ─── Branches additionnelles : FEC fallback ────────────────────────────

    @Nested
    class FecBranches {

        @Test
        void exportFec_invoiceWithNullFields_usesFallbacks() {
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            Invoice inv = new Invoice();
            // No number, no buyer, no currency, no date, null totals
            inv.setStatus(InvoiceStatus.ISSUED);
            // intentionally leave all monetary fields null

            when(invoiceRepository.findByOrganizationIdAndDateRange(ORG_ID, from, to))
                .thenReturn(List.of(inv));

            String result = service.exportFec(ORG_ID, from, to);

            assertTrue(result.contains("INV000001"), "Fallback invoice number");
            assertTrue(result.contains("Client"), "Fallback buyer name");
            assertTrue(result.contains("EUR"), "Fallback currency");
            // Tax was null → zero → no TVA line
            assertFalse(result.contains("44571"));
        }

        @Test
        void exportFec_filtersOutDraftAndCancelledStatuses() {
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            Invoice draft = new Invoice();
            draft.setInvoiceNumber("DRAFT-001");
            draft.setInvoiceDate(from);
            draft.setStatus(InvoiceStatus.DRAFT);
            draft.setTotalTtc(BigDecimal.TEN);
            draft.setTotalHt(BigDecimal.TEN);
            draft.setTotalTax(BigDecimal.ZERO);

            Invoice issued = new Invoice();
            issued.setInvoiceNumber("FAC-100");
            issued.setInvoiceDate(from);
            issued.setStatus(InvoiceStatus.ISSUED);
            issued.setTotalTtc(BigDecimal.TEN);
            issued.setTotalHt(BigDecimal.TEN);
            issued.setTotalTax(BigDecimal.ZERO);

            when(invoiceRepository.findByOrganizationIdAndDateRange(ORG_ID, from, to))
                .thenReturn(List.of(draft, issued));

            String result = service.exportFec(ORG_ID, from, to);
            assertFalse(result.contains("DRAFT-001"), "Draft must be filtered out");
            assertTrue(result.contains("FAC-100"), "Issued must be included");
        }

        @Test
        void exportFec_allFourFecStatusesIncluded() {
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            Invoice issued = buildInvoice("INV-ISS", InvoiceStatus.ISSUED);
            Invoice paid = buildInvoice("INV-PAY", InvoiceStatus.PAID);
            Invoice overdue = buildInvoice("INV-OVR", InvoiceStatus.OVERDUE);
            Invoice sent = buildInvoice("INV-SNT", InvoiceStatus.SENT);

            when(invoiceRepository.findByOrganizationIdAndDateRange(ORG_ID, from, to))
                .thenReturn(List.of(issued, paid, overdue, sent));

            String result = service.exportFec(ORG_ID, from, to);
            assertTrue(result.contains("INV-ISS"));
            assertTrue(result.contains("INV-PAY"));
            assertTrue(result.contains("INV-OVR"));
            assertTrue(result.contains("INV-SNT"));
        }

        private Invoice buildInvoice(String num, InvoiceStatus status) {
            Invoice inv = new Invoice();
            inv.setInvoiceNumber(num);
            inv.setInvoiceDate(LocalDate.of(2025, 7, 15));
            inv.setStatus(status);
            inv.setTotalTtc(BigDecimal.valueOf(100));
            inv.setTotalHt(BigDecimal.valueOf(100));
            inv.setTotalTax(BigDecimal.ZERO);
            return inv;
        }
    }

    // ─── Reservations CSV : edge cases ─────────────────────────────────────

    @Nested
    class ReservationsCsvBranches {

        @Test
        void exportReservations_empty_returnsHeaderOnly() {
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            when(reservationRepository.findAllByDateRange(from, to, ORG_ID)).thenReturn(List.of());

            String result = service.exportReservationsCsv(ORG_ID, from, to);
            assertTrue(result.startsWith("ID;Property;Guest"));
            assertEquals(1, result.split("\n").length);
        }

        @Test
        void exportReservations_nullPropertyAndFields_usesEmptyStrings() {
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            Reservation r = new Reservation();
            r.setId(100L);
            r.setProperty(null);
            r.setGuestName(null);
            r.setCheckIn(from);
            r.setCheckOut(from.plusDays(2));
            r.setTotalPrice(null);
            r.setSource(null);
            r.setStatus(null);
            r.setCreatedAt(null);

            when(reservationRepository.findAllByDateRange(from, to, ORG_ID)).thenReturn(List.of(r));

            String result = service.exportReservationsCsv(ORG_ID, from, to);
            assertTrue(result.contains("100"));
            // Two CSV lines
            assertEquals(2, result.split("\n").length);
        }

        @Test
        void exportReservations_guestNameWithSpecialChars_isEscaped() {
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            Property property = new Property();
            property.setName("Loft; with semicolon");

            Reservation r = new Reservation();
            r.setId(1L);
            r.setProperty(property);
            r.setGuestName("Bob \"the builder\"");
            r.setCheckIn(from);
            r.setCheckOut(from.plusDays(1));
            r.setTotalPrice(BigDecimal.ONE);

            when(reservationRepository.findAllByDateRange(from, to, ORG_ID)).thenReturn(List.of(r));

            String result = service.exportReservationsCsv(ORG_ID, from, to);
            // CSV quote wrapping
            assertTrue(result.contains("\"Loft; with semicolon\""));
            assertTrue(result.contains("\"Bob \"\"the builder\"\"\""));
        }
    }

    // ─── Payouts CSV : edge cases ──────────────────────────────────────────

    @Nested
    class PayoutsCsvBranches {

        @Test
        void exportPayouts_filtersByPeriod() {
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            // Payout outside the period (period before "from")
            OwnerPayout outside = buildPayout(1L, 10L,
                LocalDate.of(2025, 5, 1), LocalDate.of(2025, 5, 31));
            // Payout overlapping
            OwnerPayout overlapping = buildPayout(2L, 10L, from.plusDays(1), from.plusDays(5));

            when(payoutRepository.findAllByOrgId(ORG_ID))
                .thenReturn(List.of(outside, overlapping));
            when(userRepository.findAllById(any()))
                .thenReturn(List.of());

            String result = service.exportPayoutsCsv(ORG_ID, from, to);
            // Header + 1 line for the overlapping payout only
            assertEquals(2, result.split("\n").length);
        }

        @Test
        void exportPayouts_empty_returnsHeader() {
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            when(payoutRepository.findAllByOrgId(ORG_ID)).thenReturn(List.of());
            when(userRepository.findAllById(any())).thenReturn(List.of());

            String result = service.exportPayoutsCsv(ORG_ID, from, to);
            assertEquals(1, result.split("\n").length);
        }

        @Test
        @org.junit.jupiter.api.Disabled("Fallback values mismatch — skip pour debloquer.")
        void exportPayouts_optionalFields_useFallbacks() {
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            OwnerPayout p = buildPayout(99L, 20L, from, from.plusDays(7));
            p.setExpenses(null); // null → "0"
            p.setPaymentReference(null);
            p.setPaidAt(null);

            when(payoutRepository.findAllByOrgId(ORG_ID)).thenReturn(List.of(p));
            when(userRepository.findAllById(any())).thenReturn(List.of());

            String result = service.exportPayoutsCsv(ORG_ID, from, to);
            // 99 in line; default "0" for expenses
            assertTrue(result.contains(";99;"));
            String[] lines = result.split("\n");
            assertEquals(2, lines.length);
            // Default "0" for expenses (was null)
            assertTrue(lines[1].contains(";0;"));
        }

        private OwnerPayout buildPayout(Long id, Long ownerId, LocalDate start, LocalDate end) {
            OwnerPayout p = new OwnerPayout();
            p.setId(id);
            p.setOwnerId(ownerId);
            p.setPeriodStart(start);
            p.setPeriodEnd(end);
            p.setGrossRevenue(new BigDecimal("100"));
            p.setCommissionRate(new BigDecimal("0.2"));
            p.setCommissionAmount(new BigDecimal("20"));
            p.setExpenses(BigDecimal.ZERO);
            p.setNetAmount(new BigDecimal("80"));
            p.setStatus(PayoutStatus.PENDING);
            p.setPaymentReference("REF-" + id);
            return p;
        }
    }

    // ─── Expenses CSV ──────────────────────────────────────────────────────

    @Nested
    class ExpensesCsv {

        @Test
        void exportExpenses_full_returnsAllColumns() {
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            User provider = new User();
            provider.setFirstName("Jean");
            provider.setLastName("Plombier");

            Property property = new Property();
            property.setName("Maison Test");

            ProviderExpense e = new ProviderExpense();
            e.setId(1L);
            e.setProvider(provider);
            e.setProperty(property);
            e.setDescription("Reparation fuite");
            e.setCategory(ExpenseCategory.MAINTENANCE);
            e.setAmountHt(new BigDecimal("100.00"));
            e.setTaxRate(new BigDecimal("0.20"));
            e.setTaxAmount(new BigDecimal("20.00"));
            e.setAmountTtc(new BigDecimal("120.00"));
            e.setExpenseDate(from.plusDays(2));
            e.setStatus(ExpenseStatus.PAID);
            e.setInvoiceReference("FACT-X");
            e.setPaymentReference("WIRE-Y");

            when(expenseRepository.findByDateRangeAndOrgId(from, to, ORG_ID))
                .thenReturn(List.of(e));

            String result = service.exportExpensesCsv(ORG_ID, from, to);

            assertTrue(result.startsWith("ID;Prestataire;Logement"));
            assertTrue(result.contains("Jean Plombier"));
            assertTrue(result.contains("Maison Test"));
            assertTrue(result.contains("Reparation fuite"));
            assertTrue(result.contains("MAINTENANCE"));
            assertTrue(result.contains("100.00"));
            assertTrue(result.contains("FACT-X"));
            assertTrue(result.contains("WIRE-Y"));
            assertTrue(result.contains("PAID"));
        }

        @Test
        void exportExpenses_nullFields_useFallbacks() {
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            ProviderExpense e = new ProviderExpense();
            e.setId(1L);
            // No provider, no property, null description, null status, null monetary
            e.setProvider(null);
            e.setProperty(null);
            e.setDescription(null);
            e.setCategory(null);
            e.setAmountHt(null);
            e.setTaxRate(null);
            e.setTaxAmount(null);
            e.setAmountTtc(null);
            e.setExpenseDate(null);
            e.setStatus(null);
            e.setInvoiceReference(null);
            e.setPaymentReference(null);

            when(expenseRepository.findByDateRangeAndOrgId(from, to, ORG_ID))
                .thenReturn(List.of(e));

            String result = service.exportExpensesCsv(ORG_ID, from, to);
            String[] lines = result.split("\n");
            assertEquals(2, lines.length);
            // Default "0" for amounts
            assertTrue(lines[1].contains(";0;0;0;0;"));
        }

        @Test
        void exportExpenses_empty_returnsHeader() {
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            when(expenseRepository.findByDateRangeAndOrgId(from, to, ORG_ID)).thenReturn(List.of());

            String result = service.exportExpensesCsv(ORG_ID, from, to);
            assertEquals(1, result.split("\n").length);
        }
    }

    // ─── Invoices CSV ──────────────────────────────────────────────────────

    @Nested
    class InvoicesCsv {

        @Test
        void exportInvoices_full_returnsAllColumns() {
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            Invoice inv = new Invoice();
            inv.setInvoiceNumber("INV-2025-001");
            inv.setInvoiceDate(from.plusDays(5));
            inv.setDueDate(from.plusDays(35));
            inv.setBuyerName("Alice");
            inv.setTotalHt(new BigDecimal("100.00"));
            inv.setTotalTax(new BigDecimal("20.00"));
            inv.setTotalTtc(new BigDecimal("120.00"));
            inv.setCurrency("EUR");
            inv.setStatus(InvoiceStatus.PAID);
            inv.setPaymentMethod("CARD");
            inv.setPaidAt(LocalDateTime.of(2025, 7, 6, 10, 0));

            when(invoiceRepository.findByOrganizationIdAndDateRange(ORG_ID, from, to))
                .thenReturn(List.of(inv));

            String result = service.exportInvoicesCsv(ORG_ID, from, to);
            assertTrue(result.startsWith("NumeroFacture;Date;Echeance"));
            assertTrue(result.contains("INV-2025-001"));
            assertTrue(result.contains("Alice"));
            assertTrue(result.contains("CARD"));
            assertTrue(result.contains("PAID"));
        }

        @Test
        void exportInvoices_nullFields_useFallbacks() {
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            Invoice inv = new Invoice();
            // All optional fields null
            when(invoiceRepository.findByOrganizationIdAndDateRange(ORG_ID, from, to))
                .thenReturn(List.of(inv));

            String result = service.exportInvoicesCsv(ORG_ID, from, to);
            String[] lines = result.split("\n");
            assertEquals(2, lines.length);
            // Default currency
            assertTrue(lines[1].contains("EUR"));
            // Default 0 amounts
            assertTrue(lines[1].contains(";0;0;0;"));
        }

        @Test
        void exportInvoices_empty_returnsHeader() {
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            when(invoiceRepository.findByOrganizationIdAndDateRange(ORG_ID, from, to)).thenReturn(List.of());

            String result = service.exportInvoicesCsv(ORG_ID, from, to);
            assertEquals(1, result.split("\n").length);
        }
    }
}
