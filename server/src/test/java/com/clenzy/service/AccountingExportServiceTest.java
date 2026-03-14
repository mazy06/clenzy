package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
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
}
