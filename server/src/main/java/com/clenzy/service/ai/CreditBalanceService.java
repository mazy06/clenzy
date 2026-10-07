package com.clenzy.service.ai;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.util.UUID;

/** Les crédits Baitly et leurs réservations vivent en base ; Redis est seulement un cache de lecture. */
@Service
public class CreditBalanceService {
    private final StringRedisTemplate redis;
    private final BaitlyCreditWallet wallet;
    public CreditBalanceService(StringRedisTemplate redis, BaitlyCreditWallet wallet) {
        this.redis = redis; this.wallet = wallet;
    }
    public boolean tryReserve(Long org, UUID execution, long amount) { return wallet.reserve(org, execution, amount); }
    public boolean renew(Long org, UUID execution) { return wallet.renew(org, execution); }
    public void release(Long org, UUID execution) { wallet.release(org, execution); invalidate(org); }
    public long coldBalance(Long org) { return wallet.available(org); }
    public BaitlyCreditWallet.Balance snapshot(Long org) { return wallet.snapshot(org); }
    public void lock(Long org) { wallet.lock(org); }
    public java.time.Instant recordCoverage(com.clenzy.model.User payer,com.stripe.model.Invoice invoice) { return wallet.recordCoverage(payer,invoice); }
    public java.time.Instant paidUntil(Long org,String subscription) { return wallet.paidUntil(org,subscription); }
    public String fundingInvoice(Long org,String subscription) { return wallet.fundingInvoice(org,subscription); }
    public void applyFunding(com.clenzy.model.AiCreditGrant grant) { wallet.applyFunding(grant); }
    public Long readHotBalance(Long org) {
        try { String value = redis.opsForValue().get(key(org)); return value == null ? null : Long.parseLong(value); }
        catch (RuntimeException ignored) { return null; }
    }
    public void invalidate(Long org) {
        if (org == null) return;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { evict(org); }
            });
        } else evict(org);
    }
    private void evict(Long org) {
        try { redis.delete(key(org)); } catch (RuntimeException ignored) { /* Cache facultatif. */ }
    }
    private static String key(Long org) { return "ai:credits:balance:" + org; }
}
