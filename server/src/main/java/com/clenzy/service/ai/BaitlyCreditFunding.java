package com.clenzy.service.ai;

import com.clenzy.model.*;
import com.clenzy.service.BaitlyExternalRefundStore;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.*;
import java.util.*;

/** Droits proportionnels au financement du pack, y compris remboursements tardifs et litiges. */
@Service
public class BaitlyCreditFunding {
    private final EntityManager em;
    private final BaitlyCreditWallet wallet;
    private final AiCreditGrantService grants;
    private final CreditBalanceService balance;
    public BaitlyCreditFunding(EntityManager em, BaitlyCreditWallet wallet, AiCreditGrantService grants, CreditBalanceService balance) {
        this.em = em; this.wallet = wallet; this.grants = grants; this.balance = balance;
    }
    @Transactional
    public void completeTopUp(String ref) {
        var payment = em.createQuery("from PaymentTransaction where transactionRef=:ref", PaymentTransaction.class)
                .setParameter("ref", ref).setLockMode(LockModeType.PESSIMISTIC_WRITE).getSingleResult();
        em.refresh(payment);
        grants.grantTopUp(payment.getOrganizationId(), AiCreditPurchaseService.purchasedMillicredits(payment), payment.getProviderTxId());
        sync(payment);
    }

    @Transactional
    public void sync(PaymentTransaction payment) {
        if (!AiCreditPurchaseService.SOURCE_TYPE.equals(payment.getSourceType())) return;
        long purchased = AiCreditPurchaseService.purchasedMillicredits(payment);
        wallet.lock(payment.getOrganizationId());
        var pockets = em.createQuery("from AiCreditGrant where stripeRef=:ref and organizationId=:org", AiCreditGrant.class)
                .setParameter("ref", payment.getProviderTxId()).setParameter("org", payment.getOrganizationId()).getResultList();
        if (pockets.isEmpty()) return; // L'encaissement sera crédité avec ce même contrôle lors de sa reprise.
        if (pockets.size() != 1 || pockets.getFirst().getMillicreditsGranted() != purchased)
            throw new IllegalStateException("Pack de crédits incohérent");
        var refunds = em.createQuery("from PaymentTransaction where organizationId=:org and paymentType=com.clenzy.model.TransactionType.REFUND", PaymentTransaction.class)
                .setParameter("org", payment.getOrganizationId()).getResultList();
        BigDecimal held = BigDecimal.ZERO;
        for (var refund : refunds) {
            if (refund.getMetadata() == null || !payment.getTransactionRef().equals(refund.getMetadata().get("originalTransactionRef"))) continue;
            if (BaitlyExternalRefundStore.rejectedBeforeAccounting(refund) || refund.getStatus() == TransactionStatus.CANCELLED) continue;
            if (!Objects.equals(payment.getCurrency(), refund.getCurrency()) || refund.getAmount() == null || refund.getAmount().signum() <= 0)
                throw new IllegalStateException("Restitution de crédits à rapprocher");
            held = held.add(refund.getAmount());
        }
        if (held.compareTo(payment.getAmount()) > 0) throw new IllegalStateException("Restitutions supérieures au pack");
        long revoked = payment.hasDisputeRisk() ? purchased : BigDecimal.valueOf(purchased).multiply(held)
                .divide(payment.getAmount(), 0, RoundingMode.CEILING).longValueExact();
        var grant = pockets.getFirst();
        long previous = grant.getMillicreditsRevoked();
        if (previous == revoked) return;
        grant.setMillicreditsRevoked(revoked);
        em.persist(new AiUsageLedgerEntry(payment.getOrganizationId(), null, null, null, "billing", "CREDITS",
                AiUsageLedgerEntry.TYPE_ADJUSTMENT, AiUsageLedgerEntry.BUCKET_INTERACTIVE, null, null,
                0, 0, 0, null, null, previous - revoked, 0, "funding:" + payment.getId() + ":" + UUID.randomUUID()));
        balance.invalidate(payment.getOrganizationId());
    }
}
