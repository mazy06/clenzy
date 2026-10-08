package com.clenzy.service.voucher;

import com.clenzy.model.Reservation;
import com.clenzy.repository.BookingVoucherRepository;
import com.clenzy.repository.VoucherUsageRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Objects;

/** Le quota est réservé pendant le paiement, consommé à sa confirmation, libéré à expiration. */
@Service
public class BaitlyVoucherClaims {
    private final BookingVoucherRepository vouchers;
    private final VoucherUsageRepository usages;
    private final EntityManager em;

    public BaitlyVoucherClaims(BookingVoucherRepository vouchers, VoucherUsageRepository usages, EntityManager em) {
        this.vouchers = vouchers;
        this.usages = usages;
        this.em = em;
    }

    /** Le séjour doit déjà être verrouillé et son encaissement vérifié par le caller. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void consume(Reservation stay) { transition(stay, false); }

    /** Seulement après expiration PSP confirmée et annulation du séjour sous verrou. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void releaseExpired(Reservation stay) { transition(stay, true); }

    private void transition(Reservation stay, boolean release) {
        if (stay.getBookingVoucherId() == null) return;
        var voucher = vouchers.lockForClaim(stay.getBookingVoucherId(), stay.getOrganizationId())
            .orElseThrow(() -> new IllegalStateException("Promotion du séjour à rapprocher"));
        em.refresh(voucher, LockModeType.PESSIMISTIC_WRITE);
        var usage = usages.findByReservationId(stay.getId())
            .orElseThrow(() -> new IllegalStateException("Preuve de promotion absente"));
        em.refresh(usage, LockModeType.PESSIMISTIC_WRITE);
        if (!Objects.equals(usage.getOrganizationId(), stay.getOrganizationId())
                || !Objects.equals(usage.getVoucherId(), voucher.getId())
                || stay.getProperty() == null || !Objects.equals(usage.getPropertyId(), stay.getProperty().getId())
                || !Objects.equals(usage.getCurrency(), stay.getCurrency())
                || stay.getDiscountAmount() == null || usage.getDiscountApplied().compareTo(stay.getDiscountAmount()) != 0
                || stay.getTotalPrice() == null || usage.getFinalTotal().compareTo(stay.getTotalPrice()) != 0)
            throw new IllegalStateException("Montants de promotion à rapprocher");
        if (release) {
            // Les anciens usages consommés ne sont jamais réécrits sans preuve historique.
            if (!"HELD".equals(usage.getClaimStatus())) return;
            if (!"cancelled".equalsIgnoreCase(stay.getStatus())
                    || stay.getPaidAt() != null || stay.getAmountPaid() != null && stay.getAmountPaid().signum() > 0)
                throw new IllegalStateException("La promotion d'un séjour payé ne peut pas être libérée");
            if (voucher.getUsageCount() <= 0) throw new IllegalStateException("Compteur de promotion incohérent");
            voucher.setUsageCount(voucher.getUsageCount() - 1);
            usage.setClaimStatus("RELEASED");
            usage.setReleasedAt(Instant.now());
        } else {
            if ("RELEASED".equals(usage.getClaimStatus()))
                throw new IllegalStateException("Paiement après libération de la promotion : rapprochement requis");
            if (!"HELD".equals(usage.getClaimStatus()) && !"CONSUMED".equals(usage.getClaimStatus()))
                throw new IllegalStateException("État de promotion inconnu");
            usage.setClaimStatus("CONSUMED");
        }
    }
}
