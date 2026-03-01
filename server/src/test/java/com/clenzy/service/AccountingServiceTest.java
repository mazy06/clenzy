package com.clenzy.service;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelCommission;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.Reservation;
import com.clenzy.model.Property;
import com.clenzy.repository.ChannelCommissionRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountingServiceTest {

    @Mock private OwnerPayoutRepository payoutRepository;
    @Mock private ChannelCommissionRepository commissionRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private PropertyRepository propertyRepository;

    @InjectMocks
    private AccountingService service;

    private static final Long ORG_ID = 1L;
    private static final Long OWNER_ID = 10L;

    @Test
    void generatePayout_calculatesCorrectly() {
        LocalDate from = LocalDate.of(2025, 7, 1);
        LocalDate to = LocalDate.of(2025, 7, 31);

        Property property = new Property();
        property.setId(100L);

        Reservation r1 = new Reservation();
        r1.setProperty(property);
        r1.setTotalPrice(new BigDecimal("500.00"));
        r1.setCheckIn(from.plusDays(1));
        r1.setCheckOut(from.plusDays(5));

        Reservation r2 = new Reservation();
        r2.setProperty(property);
        r2.setTotalPrice(new BigDecimal("300.00"));
        r2.setCheckIn(from.plusDays(10));
        r2.setCheckOut(from.plusDays(14));

        when(payoutRepository.findByOwnerAndPeriod(OWNER_ID, from, to, ORG_ID))
            .thenReturn(Optional.empty());
        when(reservationRepository.findByOwnerIdAndDateRange(OWNER_ID, from, to, ORG_ID))
            .thenReturn(List.of(r1, r2));
        when(payoutRepository.save(any(OwnerPayout.class))).thenAnswer(inv -> {
            OwnerPayout p = inv.getArgument(0);
            p.setId(1L);
            return p;
        });

        OwnerPayout result = service.generatePayout(OWNER_ID, ORG_ID, from, to);

        assertEquals(0, new BigDecimal("800.00").compareTo(result.getGrossRevenue()));
        // 20% of 800 = 160
        assertEquals(0, new BigDecimal("160.00").compareTo(result.getCommissionAmount()));
        // 800 - 160 = 640
        assertEquals(0, new BigDecimal("640.00").compareTo(result.getNetAmount()));
        assertEquals(PayoutStatus.PENDING, result.getStatus());
    }

    @Test
    void generatePayout_existingPayout_returnsExisting() {
        LocalDate from = LocalDate.of(2025, 7, 1);
        LocalDate to = LocalDate.of(2025, 7, 31);

        OwnerPayout existing = new OwnerPayout();
        existing.setId(99L);

        when(payoutRepository.findByOwnerAndPeriod(OWNER_ID, from, to, ORG_ID))
            .thenReturn(Optional.of(existing));

        OwnerPayout result = service.generatePayout(OWNER_ID, ORG_ID, from, to);

        assertEquals(99L, result.getId());
        verifyNoInteractions(reservationRepository);
    }

    @Test
    void approvePayout_setsStatusApproved() {
        OwnerPayout payout = new OwnerPayout();
        payout.setId(1L);
        payout.setStatus(PayoutStatus.PENDING);

        when(payoutRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(payout));
        when(payoutRepository.save(any(OwnerPayout.class))).thenAnswer(inv -> inv.getArgument(0));

        OwnerPayout result = service.approvePayout(1L, ORG_ID);

        assertEquals(PayoutStatus.APPROVED, result.getStatus());
    }

    @Test
    void markAsPaid_setsStatusAndReference() {
        OwnerPayout payout = new OwnerPayout();
        payout.setId(1L);
        payout.setStatus(PayoutStatus.APPROVED);

        when(payoutRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(payout));
        when(payoutRepository.save(any(OwnerPayout.class))).thenAnswer(inv -> inv.getArgument(0));

        OwnerPayout result = service.markAsPaid(1L, ORG_ID, "WIRE-123");

        assertEquals(PayoutStatus.PAID, result.getStatus());
        assertEquals("WIRE-123", result.getPaymentReference());
        assertNotNull(result.getPaidAt());
    }

    @Test
    void getPayoutById_notFound_throws() {
        when(payoutRepository.findByIdAndOrgId(999L, ORG_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.getPayoutById(999L, ORG_ID));
    }

    @Test
    void saveChannelCommission_savesAndReturns() {
        ChannelCommission commission = new ChannelCommission();
        commission.setOrganizationId(ORG_ID);
        commission.setChannelName(ChannelName.BOOKING);
        commission.setCommissionRate(new BigDecimal("0.1500"));

        when(commissionRepository.save(any(ChannelCommission.class))).thenAnswer(inv -> {
            ChannelCommission c = inv.getArgument(0);
            c.setId(1L);
            return c;
        });

        ChannelCommission result = service.saveChannelCommission(commission);

        assertNotNull(result.getId());
        assertEquals(ChannelName.BOOKING, result.getChannelName());
    }
}
