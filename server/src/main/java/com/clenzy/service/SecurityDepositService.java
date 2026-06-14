package com.clenzy.service;

import com.clenzy.dto.SecurityDepositDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * Cycle de vie des cautions / dépôts de garantie (Phase 4 différenciation).
 *
 * <p>Transitions de statut par <b>UPDATE conditionnel (CAS)</b> ({@link SecurityDepositRepository}),
 * jamais check-then-act (audit #8). Ownership validé après {@code findById}/réservation (audit #3) ;
 * la clause {@code orgId} du CAS est une défense en profondeur. Aucune entité JPA exposée (audit #5).</p>
 *
 * <p><b>Périmètre (HP)</b> : le hold / capture / release <b>réel côté Stripe</b> (pré-autorisation
 * manuelle, capture partielle) est l'effet externe différé — à appeler <b>hors transaction</b> +
 * {@code afterCommit} + idempotency (audit #2) ; ce service en est le journal d'états autoritatif.
 * Le montant provient du gestionnaire (manager authentifié, pas du voyageur) ; le sourcing depuis
 * une politique de caution par bien est un raffinement ultérieur.</p>
 */
@Service
public class SecurityDepositService {

    private final SecurityDepositRepository repository;
    private final ReservationRepository reservationRepository;
    private final OrganizationAccessGuard accessGuard;

    public SecurityDepositService(SecurityDepositRepository repository,
                                  ReservationRepository reservationRepository,
                                  OrganizationAccessGuard accessGuard) {
        this.repository = repository;
        this.reservationRepository = reservationRepository;
        this.accessGuard = accessGuard;
    }

    /**
     * Crée (idempotent) la caution PENDING d'une réservation.
     *
     * @throws NotFoundException si la réservation n'existe pas
     * @throws org.springframework.security.access.AccessDeniedException si la réservation est d'une autre org
     * @throws IllegalArgumentException si le montant est nul/négatif
     */
    @Transactional
    public SecurityDepositDto create(Long orgId, Long reservationId, BigDecimal amount, String currency) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("deposit amount must be > 0");
        }
        Reservation reservation = reservationRepository.findById(reservationId)
            .orElseThrow(() -> new NotFoundException("Reservation not found: " + reservationId));
        accessGuard.requireSameOrganization(reservation.getOrganizationId(), "Reservation " + reservationId);

        SecurityDeposit deposit = repository
            .findByOrganizationIdAndReservationId(orgId, reservationId)
            .orElseGet(() -> {
                SecurityDeposit d = new SecurityDeposit();
                d.setOrganizationId(orgId);
                d.setReservationId(reservationId);
                d.setAmount(amount);
                d.setCurrency(currency != null && !currency.isBlank()
                    ? currency : reservation.getCurrency());
                d.setStatus(SecurityDepositStatus.PENDING);
                return repository.save(d);
            });
        return SecurityDepositDto.from(deposit);
    }

    /** Enregistre un hold PSP placé : PENDING → HELD (CAS). */
    @Transactional
    public void markHeld(Long orgId, Long depositId, String externalRef) {
        transition(orgId, depositId, SecurityDepositStatus.PENDING, SecurityDepositStatus.HELD, externalRef);
    }

    /** Marque la pré-autorisation échouée : PENDING → FAILED (CAS). */
    @Transactional
    public void markFailed(Long orgId, Long depositId) {
        transition(orgId, depositId, SecurityDepositStatus.PENDING, SecurityDepositStatus.FAILED, null);
    }

    /** Relâche le hold (caution rendue) : HELD → RELEASED (CAS). */
    @Transactional
    public void release(Long orgId, Long depositId) {
        transition(orgId, depositId, SecurityDepositStatus.HELD, SecurityDepositStatus.RELEASED, null);
    }

    /**
     * Encaisse tout ou partie pour dommages : HELD → CAPTURED (CAS).
     *
     * @throws IllegalArgumentException si le montant est ≤ 0 ou supérieur à la caution
     * @throws IllegalStateException si la caution n'est plus HELD (course perdue)
     */
    @Transactional
    public void capture(Long orgId, Long depositId, BigDecimal capturedAmount, String reason) {
        SecurityDeposit deposit = load(orgId, depositId);
        if (capturedAmount == null || capturedAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("captured amount must be > 0");
        }
        if (capturedAmount.compareTo(deposit.getAmount()) > 0) {
            throw new IllegalArgumentException("captured amount exceeds deposit amount");
        }
        int updated = repository.capture(depositId, orgId, capturedAmount, reason);
        if (updated == 0) {
            throw new IllegalStateException(
                "Deposit " + depositId + " is not in HELD state (already processed)");
        }
    }

    @Transactional(readOnly = true)
    public SecurityDepositDto getByReservation(Long orgId, Long reservationId) {
        return repository.findByOrganizationIdAndReservationId(orgId, reservationId)
            .map(SecurityDepositDto::from)
            .orElseThrow(() -> new NotFoundException(
                "No security deposit for reservation " + reservationId));
    }

    private void transition(Long orgId, Long depositId,
                            SecurityDepositStatus expected, SecurityDepositStatus next, String externalRef) {
        load(orgId, depositId);
        int updated = repository.transitionStatus(depositId, orgId, expected, next, externalRef);
        if (updated == 0) {
            throw new IllegalStateException(
                "Deposit " + depositId + " is not in " + expected + " state (already processed)");
        }
    }

    private SecurityDeposit load(Long orgId, Long depositId) {
        SecurityDeposit deposit = repository.findById(depositId)
            .orElseThrow(() -> new NotFoundException("Security deposit not found: " + depositId));
        accessGuard.requireSameOrganization(deposit.getOrganizationId(), "SecurityDeposit " + depositId);
        return deposit;
    }
}
