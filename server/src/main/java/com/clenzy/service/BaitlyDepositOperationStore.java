package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.Objects;
import java.util.Optional;

/** Décisions financières courtes avant HTTP : capture, renouvellement et libération s'excluent. */
@Service
@Transactional
public class BaitlyDepositOperationStore {
    private final SecurityDepositRepository deposits;
    private final ReservationRepository reservations;
    private final BaitlyDepositReleasePolicy policy;
    private final EntityManager em;

    public BaitlyDepositOperationStore(SecurityDepositRepository deposits, ReservationRepository reservations,
            BaitlyDepositReleasePolicy policy, EntityManager em) {
        this.deposits = deposits; this.reservations = reservations; this.policy = policy; this.em = em;
    }

    public record Instruction(Long id, Long orgId, String authorization, BigDecimal amount, String currency) {}

    public Optional<Instruction> claimRelease(Long id, Long orgId) {
        var deposit = lock(id, orgId);
        if (deposit.getStatus() == SecurityDepositStatus.RELEASED) return Optional.empty();
        if (deposit.getStatus() != SecurityDepositStatus.HELD && deposit.getStatus() != SecurityDepositStatus.RELEASING)
            throw new IllegalStateException("Cette caution n'est plus disponible pour libération.");
        var reservation = reservations.findByIdWithGuestAndProperty(deposit.getReservationId())
                .filter(r -> orgId.equals(r.getOrganizationId())).orElseThrow(() -> new IllegalStateException("Séjour introuvable."));
        em.refresh(reservation, LockModeType.PESSIMISTIC_WRITE);
        if (!policy.eligible(reservation)) return Optional.empty();
        requireReference(deposit);
        deposit.setStatus(SecurityDepositStatus.RELEASING);
        deposits.saveAndFlush(deposit);
        return Optional.of(instruction(deposit));
    }

    public Instruction claimCapture(Long id, Long orgId, BigDecimal amount, String reason) {
        var deposit = lock(id, orgId);
        requireReference(deposit);
        if (amount == null || amount.signum() <= 0 || amount.stripTrailingZeros().scale() > 2
                || amount.compareTo(deposit.getAmount()) > 0)
            throw new IllegalArgumentException("Montant capturé invalide.");
        if (reason == null || reason.isBlank() || reason.length() > 512)
            throw new IllegalArgumentException("Un motif de capture de 1 à 512 caractères est requis.");
        if (deposit.getStatus() == SecurityDepositStatus.CAPTURING) {
            if (deposit.getOperationAmount() == null || amount.compareTo(deposit.getOperationAmount()) != 0
                    || !Objects.equals(reason, deposit.getOperationReason()))
                throw new IllegalStateException("Une capture différente est déjà en cours : rapprochement requis.");
        } else {
            if (deposit.getStatus() != SecurityDepositStatus.HELD)
                throw new IllegalStateException("La caution n'est plus disponible pour capture.");
            deposit.setStatus(SecurityDepositStatus.CAPTURING);
            deposit.setOperationAmount(amount); deposit.setOperationReason(reason);
            deposits.saveAndFlush(deposit);
        }
        return new Instruction(id, orgId, deposit.getExternalRef(), amount, deposit.getCurrency());
    }

    public void released(Instruction instruction) {
        finish(instruction, SecurityDepositStatus.RELEASING, SecurityDepositStatus.RELEASED);
    }

    public void captured(Instruction instruction) {
        finish(instruction, SecurityDepositStatus.CAPTURING, SecurityDepositStatus.CAPTURED);
    }

    public void expiredCapture(Instruction instruction) {
        finish(instruction, SecurityDepositStatus.CAPTURING, SecurityDepositStatus.EXPIRED);
    }

    private void finish(Instruction instruction, SecurityDepositStatus expected, SecurityDepositStatus target) {
        var deposit = lock(instruction.id(), instruction.orgId());
        if (!instruction.authorization().equals(deposit.getExternalRef())) throw new IllegalStateException("Autorisation modifiée : rapprochement requis.");
        if (deposit.getStatus() == target) return;
        if (deposit.getStatus() != expected) throw new IllegalStateException("Opération de caution modifiée : rapprochement requis.");
        if (target == SecurityDepositStatus.CAPTURED) {
            if (deposit.getOperationAmount() == null || instruction.amount().compareTo(deposit.getOperationAmount()) != 0)
                throw new IllegalStateException("Montant de capture modifié : rapprochement requis.");
            deposit.setCapturedAmount(instruction.amount()); deposit.setReason(deposit.getOperationReason());
        }
        deposit.setStatus(target); deposits.saveAndFlush(deposit);
    }

    private SecurityDeposit lock(Long id, Long orgId) {
        var deposit = deposits.lockOperation(id, orgId).orElseThrow(() -> new IllegalArgumentException("Caution introuvable."));
        em.refresh(deposit, LockModeType.PESSIMISTIC_WRITE);
        return deposit;
    }

    private static void requireReference(SecurityDeposit deposit) {
        if (deposit.getExternalRef() == null || !deposit.getExternalRef().startsWith("pi_"))
            throw new IllegalStateException("Préautorisation Stripe absente : rapprochement requis.");
    }

    private static Instruction instruction(SecurityDeposit deposit) {
        return new Instruction(deposit.getId(), deposit.getOrganizationId(), deposit.getExternalRef(), deposit.getAmount(), deposit.getCurrency());
    }
}
