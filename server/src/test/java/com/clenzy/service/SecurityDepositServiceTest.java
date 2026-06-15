package com.clenzy.service;

import com.clenzy.dto.SecurityDepositDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cycle de vie des cautions (Phase 4) : création idempotente, transitions CAS, ownership, validation.
 */
class SecurityDepositServiceTest {

    private final SecurityDepositRepository repository = mock(SecurityDepositRepository.class);
    private final ReservationRepository reservationRepository = mock(ReservationRepository.class);
    private final OrganizationAccessGuard accessGuard = mock(OrganizationAccessGuard.class);

    private final SecurityDepositService service =
        new SecurityDepositService(repository, reservationRepository, accessGuard);

    private Reservation reservation(Long orgId) {
        Reservation r = new Reservation();
        r.setOrganizationId(orgId);
        r.setCurrency("EUR");
        return r;
    }

    private SecurityDeposit deposit(Long id, Long orgId, SecurityDepositStatus status) {
        SecurityDeposit d = new SecurityDeposit();
        d.setId(id);
        d.setOrganizationId(orgId);
        d.setReservationId(50L);
        d.setAmount(new BigDecimal("300.00"));
        d.setStatus(status);
        return d;
    }

    @Test
    void createPersistsPendingDepositWithReservationCurrency() {
        when(reservationRepository.findById(50L)).thenReturn(Optional.of(reservation(1L)));
        when(repository.findByOrganizationIdAndReservationId(1L, 50L)).thenReturn(Optional.empty());
        when(repository.save(any(SecurityDeposit.class))).thenAnswer(inv -> inv.getArgument(0));

        SecurityDepositDto dto = service.create(1L, 50L, new BigDecimal("300.00"), null);

        assertThat(dto.status()).isEqualTo(SecurityDepositStatus.PENDING);
        assertThat(dto.amount()).isEqualByComparingTo("300.00");
        assertThat(dto.currency()).isEqualTo("EUR");
    }

    @Test
    void createIsIdempotentPerReservation() {
        when(reservationRepository.findById(50L)).thenReturn(Optional.of(reservation(1L)));
        when(repository.findByOrganizationIdAndReservationId(1L, 50L))
            .thenReturn(Optional.of(deposit(7L, 1L, SecurityDepositStatus.HELD)));

        SecurityDepositDto dto = service.create(1L, 50L, new BigDecimal("300.00"), null);

        assertThat(dto.id()).isEqualTo(7L);
        verify(repository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void createRejectsNonPositiveAmount() {
        assertThatThrownBy(() -> service.create(1L, 50L, BigDecimal.ZERO, null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createDeniedForReservationOfAnotherOrg() {
        when(reservationRepository.findById(50L)).thenReturn(Optional.of(reservation(2L)));
        doThrow(new AccessDeniedException("denied"))
            .when(accessGuard).requireSameOrganization(eq(2L), any(String.class));

        assertThatThrownBy(() -> service.create(1L, 50L, new BigDecimal("300.00"), null))
            .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void markHeldTransitionsPendingToHeldWithExternalRef() {
        when(repository.findById(7L)).thenReturn(Optional.of(deposit(7L, 1L, SecurityDepositStatus.PENDING)));
        when(repository.transitionStatus(7L, 1L,
            SecurityDepositStatus.PENDING, SecurityDepositStatus.HELD, "pi_123")).thenReturn(1);

        service.markHeld(1L, 7L, "pi_123");

        verify(repository).transitionStatus(7L, 1L,
            SecurityDepositStatus.PENDING, SecurityDepositStatus.HELD, "pi_123");
    }

    @Test
    void releaseThrowsWhenCasLosesRace() {
        when(repository.findById(7L)).thenReturn(Optional.of(deposit(7L, 1L, SecurityDepositStatus.HELD)));
        when(repository.transitionStatus(eq(7L), eq(1L),
            eq(SecurityDepositStatus.HELD), eq(SecurityDepositStatus.RELEASED), isNull())).thenReturn(0);

        assertThatThrownBy(() -> service.release(1L, 7L))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void captureRejectsAmountExceedingDeposit() {
        when(repository.findById(7L)).thenReturn(Optional.of(deposit(7L, 1L, SecurityDepositStatus.HELD)));

        assertThatThrownBy(() -> service.capture(1L, 7L, new BigDecimal("999.00"), "dégâts"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void captureTransitionsHeldToCaptured() {
        when(repository.findById(7L)).thenReturn(Optional.of(deposit(7L, 1L, SecurityDepositStatus.HELD)));
        when(repository.capture(7L, 1L, new BigDecimal("120.00"), "dégâts")).thenReturn(1);

        service.capture(1L, 7L, new BigDecimal("120.00"), "dégâts");

        verify(repository).capture(7L, 1L, new BigDecimal("120.00"), "dégâts");
    }

    @Test
    void loadThrowsNotFoundWhenMissing() {
        when(repository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.release(1L, 404L))
            .isInstanceOf(NotFoundException.class);
    }
}
