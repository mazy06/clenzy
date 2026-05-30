package com.clenzy.scheduler;

import com.clenzy.model.EscrowHold;
import com.clenzy.model.EscrowStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.EscrowHoldRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.EscrowService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EscrowReleaseSchedulerTest {

    @Mock private EscrowHoldRepository escrowHoldRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private EscrowService escrowService;

    private EscrowReleaseScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new EscrowReleaseScheduler(escrowHoldRepository,
                reservationRepository, escrowService);
    }

    private EscrowHold hold(Long id, Long reservationId) {
        EscrowHold h = new EscrowHold();
        h.setId(id);
        h.setReservationId(reservationId);
        return h;
    }

    private Reservation res(LocalDate checkIn) {
        Reservation r = new Reservation();
        r.setCheckIn(checkIn);
        return r;
    }

    @Test
    void releaseEscrow_emptyList_doesNothing() {
        when(escrowHoldRepository.findByStatus(EscrowStatus.HELD)).thenReturn(List.of());

        scheduler.releaseEscrowOnCheckIn();

        verifyNoInteractions(reservationRepository, escrowService);
    }

    @Test
    void releaseEscrow_pastCheckIn_releases() {
        EscrowHold h = hold(1L, 100L);
        when(escrowHoldRepository.findByStatus(EscrowStatus.HELD)).thenReturn(List.of(h));
        when(reservationRepository.findById(100L))
                .thenReturn(Optional.of(res(LocalDate.now().minusDays(1))));

        scheduler.releaseEscrowOnCheckIn();

        verify(escrowService).releaseFunds(1L, "CHECK_IN");
    }

    @Test
    void releaseEscrow_todayCheckIn_releases() {
        EscrowHold h = hold(1L, 100L);
        when(escrowHoldRepository.findByStatus(EscrowStatus.HELD)).thenReturn(List.of(h));
        when(reservationRepository.findById(100L))
                .thenReturn(Optional.of(res(LocalDate.now())));

        scheduler.releaseEscrowOnCheckIn();

        verify(escrowService).releaseFunds(1L, "CHECK_IN");
    }

    @Test
    void releaseEscrow_futureCheckIn_doesNotRelease() {
        EscrowHold h = hold(1L, 100L);
        when(escrowHoldRepository.findByStatus(EscrowStatus.HELD)).thenReturn(List.of(h));
        when(reservationRepository.findById(100L))
                .thenReturn(Optional.of(res(LocalDate.now().plusDays(5))));

        scheduler.releaseEscrowOnCheckIn();

        verify(escrowService, never()).releaseFunds(anyLong(), anyString());
    }

    @Test
    void releaseEscrow_nullReservationId_isSkipped() {
        EscrowHold h = hold(1L, null);
        when(escrowHoldRepository.findByStatus(EscrowStatus.HELD)).thenReturn(List.of(h));

        scheduler.releaseEscrowOnCheckIn();

        verifyNoInteractions(reservationRepository, escrowService);
    }

    @Test
    void releaseEscrow_missingReservation_skipsAndLogs() {
        EscrowHold h = hold(1L, 100L);
        when(escrowHoldRepository.findByStatus(EscrowStatus.HELD)).thenReturn(List.of(h));
        when(reservationRepository.findById(100L)).thenReturn(Optional.empty());

        scheduler.releaseEscrowOnCheckIn();

        verify(escrowService, never()).releaseFunds(anyLong(), anyString());
    }

    @Test
    void releaseEscrow_nullCheckIn_doesNotRelease() {
        EscrowHold h = hold(1L, 100L);
        when(escrowHoldRepository.findByStatus(EscrowStatus.HELD)).thenReturn(List.of(h));
        Reservation r = new Reservation();
        r.setCheckIn(null);
        when(reservationRepository.findById(100L)).thenReturn(Optional.of(r));

        scheduler.releaseEscrowOnCheckIn();

        verify(escrowService, never()).releaseFunds(anyLong(), anyString());
    }

    @Test
    void releaseEscrow_oneErrors_continuesWithOthers() {
        EscrowHold h1 = hold(1L, 100L);
        EscrowHold h2 = hold(2L, 200L);
        when(escrowHoldRepository.findByStatus(EscrowStatus.HELD)).thenReturn(List.of(h1, h2));
        when(reservationRepository.findById(100L))
                .thenReturn(Optional.of(res(LocalDate.now().minusDays(1))));
        when(reservationRepository.findById(200L))
                .thenReturn(Optional.of(res(LocalDate.now().minusDays(1))));
        when(escrowService.releaseFunds(1L, "CHECK_IN")).thenThrow(new RuntimeException("oops"));

        scheduler.releaseEscrowOnCheckIn();

        verify(escrowService).releaseFunds(1L, "CHECK_IN");
        verify(escrowService).releaseFunds(2L, "CHECK_IN");
    }

    @Test
    void releaseEscrow_multipleEligible_releasesAll() {
        EscrowHold h1 = hold(1L, 100L);
        EscrowHold h2 = hold(2L, 200L);
        EscrowHold h3 = hold(3L, 300L);
        when(escrowHoldRepository.findByStatus(EscrowStatus.HELD))
                .thenReturn(List.of(h1, h2, h3));
        when(reservationRepository.findById(anyLong()))
                .thenReturn(Optional.of(res(LocalDate.now())));

        scheduler.releaseEscrowOnCheckIn();

        verify(escrowService, times(3)).releaseFunds(anyLong(), anyString());
    }
}
