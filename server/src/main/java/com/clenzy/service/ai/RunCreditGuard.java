package com.clenzy.service.ai;

import com.clenzy.tenant.TenantContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.util.UUID;

/** Garde Baitly par exécution. Le thread ne porte que l'identité de la réserve, jamais le solde. */
@Component
public class RunCreditGuard {
    private static final class RunBudget {
        final Long org;
        final UUID id = UUID.randomUUID();
        long remaining;
        boolean exhausted;
        RunBudget(Long org, long remaining) { this.org = org; this.remaining = remaining; }
    }
    private final ThreadLocal<RunBudget> current = new ThreadLocal<>();
    private final CreditBalanceService balanceService;
    private final TenantContext tenantContext;
    private final AiCreditGrantService creditGrantService;
    private final long floorMillicredits;
    private final long chunkMillicredits;
    public RunCreditGuard(CreditBalanceService balanceService, TenantContext tenantContext, AiCreditGrantService creditGrantService,
                          @Value("${clenzy.ai.credits.enforcement.floor-millicredits:2000}") long floorMillicredits,
                          @Value("${clenzy.ai.credits.enforcement.chunk-millicredits:5000}") long chunkMillicredits) {
        if (floorMillicredits <= 0 || chunkMillicredits <= 0) throw new IllegalArgumentException("Réserves de crédits invalides");
        this.balanceService = balanceService; this.tenantContext = tenantContext; this.creditGrantService = creditGrantService;
        this.floorMillicredits = floorMillicredits; this.chunkMillicredits = chunkMillicredits;
    }
    public boolean beginRun(Long org) {
        endRun();
        if (isExempt()) return true;
        var budget = new RunBudget(org, floorMillicredits);
        if (balanceService.tryReserve(org, budget.id, floorMillicredits)
                || (creditGrantService.ensureCurrentMonthAllotment(org) && balanceService.tryReserve(org, budget.id, floorMillicredits))) {
            current.set(budget); return true;
        }
        return false;
    }
    public boolean isExempt() { return tenantContext.isSuperAdmin(); }
    public UUID reservation(Long org) {
        var budget = current.get();
        return budget != null && budget.org.equals(org) ? budget.id : null;
    }
    /** Appelé uniquement après le commit du débit. Une reprise idempotente ne repasse pas ici. */
    public void onDebit(Long org, long amount) {
        var budget = current.get();
        if (budget == null || !budget.org.equals(org) || amount <= 0) return;
        budget.remaining = Math.max(0, budget.remaining - amount);
        if (budget.remaining < floorMillicredits && !budget.exhausted) {
            if (balanceService.tryReserve(org, budget.id, chunkMillicredits)) budget.remaining += chunkMillicredits;
            else budget.exhausted = true;
        }
        if (!budget.exhausted && !balanceService.renew(org, budget.id)) budget.exhausted = true;
    }
    public boolean isExhausted() { var budget = current.get(); return budget != null && budget.exhausted; }
    public void endRun() {
        var budget = current.get(); current.remove();
        if (budget != null) balanceService.release(budget.org, budget.id);
    }
}
