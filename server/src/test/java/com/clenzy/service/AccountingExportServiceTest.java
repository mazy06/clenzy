package com.clenzy.service;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountingExportServiceTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private OwnerPayoutRepository payoutRepository;

    @InjectMocks
    private AccountingExportService service;

    private static final Long ORG_ID = 1L;

    @Test
    void exportFec_containsHeaderAndLines() {
        LocalDate from = LocalDate.of(2025, 7, 1);
        LocalDate to = LocalDate.of(2025, 7, 31);

        Property property = new Property();
        property.setName("Beach House");

        Reservation r = new Reservation();
        r.setProperty(property);
        r.setGuestName("John Doe");
        r.setCheckIn(from.plusDays(5));
        r.setCheckOut(from.plusDays(10));
        r.setTotalPrice(new BigDecimal("500.00"));

        when(reservationRepository.findAllByDateRange(from, to, ORG_ID))
            .thenReturn(List.of(r));

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

        when(reservationRepository.findAllByDateRange(from, to, ORG_ID))
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

        when(payoutRepository.findAllByOrgId(ORG_ID)).thenReturn(List.of(payout));

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

        Property property = new Property();
        property.setName("Apt");

        Reservation r = new Reservation();
        r.setProperty(property);
        r.setGuestName("Guest");
        r.setCheckIn(from.plusDays(1));
        r.setCheckOut(from.plusDays(3));
        r.setTotalPrice(new BigDecimal("250.00"));

        when(reservationRepository.findAllByDateRange(from, to, ORG_ID))
            .thenReturn(List.of(r));

        String result = service.exportFec(ORG_ID, from, to);

        String[] lines = result.split("\n");
        // Header + 2 lines (debit + credit) per reservation
        assertEquals(3, lines.length);
    }
}
