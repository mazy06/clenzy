package com.clenzy.service.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Garde de credits d'un run d'agent (campagne T-06b, ADR-005 / levier L6) :
 * sequence pre-vol → reservation → re-check inter-tours → reconciliation.
 *
 * <p><b>Cycle</b> (porte par ThreadLocal, comme {@code AgentRunRecorder} — le
 * run s'execute dans le thread appelant) :</p>
 * <ol>
 *   <li>{@link #beginRun} : reserve un plancher conservateur. Refus = hard cap
 *       — le run ne demarre pas (le PMS classique continue, D-101) ;</li>
 *   <li>{@link #onDebit} (appele par le metering a chaque appel LLM) : cumule
 *       la consommation reelle, applique aux poches Postgres, et re-reserve un
 *       chunk quand le consomme depasse le reserve. Chunk refuse →
 *       {@link #isExhausted()} passe true, les boucles s'arretent proprement ;</li>
 *   <li>{@link #endRun} : reconciliation — release du reserve non consomme,
 *       ou debit force de l'overshoot (borne par la granularite d'un tour).</li>
 * </ol>
 *
 * <p><b>Enforcement toujours actif + auto-provisionnement</b> : plus de flag
 * d'activation. Si la reservation pre-vol echoue (solde a zero), le garde tente
 * une auto-dotation de la dotation du mois pour une org <b>eligible</b>
 * (abonnement actif — {@link AiCreditGrantService#ensureCurrentMonthAllotment})
 * puis re-reserve. Ainsi aucun abonne n'est coupe par erreur (self-heal), et une
 * org non eligible (sans abonnement) ou ayant deja consomme sa dotation du mois
 * est refusee — le PMS classique continue (D-101). Le staff plateforme
 * (SUPER_ADMIN / SUPER_MANAGER) est totalement exempte.</p>
 */
@Component
public class RunCreditGuard {

    private static final Logger log = LoggerFactory.getLogger(RunCreditGuard.class);

    private static final class RunBudget {
        final Long orgId;
        long reserved;
        long consumed;
        boolean exhausted;

        RunBudget(Long orgId, long reserved) {
            this.orgId = orgId;
            this.reserved = reserved;
        }
    }

    private final ThreadLocal<RunBudget> current = new ThreadLocal<>();

    private final CreditBalanceService balanceService;
    private final com.clenzy.tenant.TenantContext tenantContext;
    private final AiCreditGrantService creditGrantService;
    private final long floorMillicredits;
    private final long chunkMillicredits;

    public RunCreditGuard(CreditBalanceService balanceService,
                          com.clenzy.tenant.TenantContext tenantContext,
                          AiCreditGrantService creditGrantService,
                          @Value("${clenzy.ai.credits.enforcement.floor-millicredits:2000}") long floorMillicredits,
                          @Value("${clenzy.ai.credits.enforcement.chunk-millicredits:5000}") long chunkMillicredits) {
        this.balanceService = balanceService;
        this.tenantContext = tenantContext;
        this.creditGrantService = creditGrantService;
        this.floorMillicredits = floorMillicredits;
        this.chunkMillicredits = chunkMillicredits;
    }

    /**
     * Pre-vol : reserve le plancher. {@code true} = le run peut demarrer.
     * beginRun reinitialise l'etat du thread (meme robustesse que le recorder).
     *
     * <p>Sequence : exemption staff plateforme → reservation → si echec (solde a
     * zero), auto-dotation d'une org eligible (self-heal) puis re-reservation →
     * sinon refus (hard cap).</p>
     */
    public boolean beginRun(Long orgId) {
        // Exemption STAFF PLATEFORME (SUPER_ADMIN / SUPER_MANAGER) : exempts de
        // l'abonnement, donc exempts des credits IA — aucune reservation ni debit.
        if (tenantContext.isSuperAdmin()) {
            current.remove();
            return true;
        }
        if (balanceService.tryReserve(orgId, floorMillicredits)) {
            current.set(new RunBudget(orgId, floorMillicredits));
            return true;
        }
        // Solde a zero : self-heal — dote la dotation du mois si l'org est eligible
        // (abonnement actif, pas encore dotee ce mois), puis re-reserve. Evite de
        // couper un abonne dont la poche n'a pas encore ete creee (deploy, timing).
        if (creditGrantService.ensureCurrentMonthAllotment(orgId)
                && balanceService.tryReserve(orgId, floorMillicredits)) {
            current.set(new RunBudget(orgId, floorMillicredits));
            return true;
        }
        current.remove();
        log.info("[CREDITS] Hard cap : solde insuffisant (org={}, plancher={}mc)",
                orgId, floorMillicredits);
        return false;
    }

    /**
     * Consommation reelle d'un appel LLM (appele par le metering). Applique aux
     * poches Postgres, et re-reserve un chunk si le cumul depasse le reserve
     * (re-check inter-tours — protege du runaway).
     */
    public void onDebit(Long orgId, long millicredits) {
        if (millicredits <= 0) {
            return;
        }
        RunBudget budget = current.get();
        if (budget == null || !budget.orgId.equals(orgId)) {
            return; // pas de run garde sur ce thread (enforcement off, ou usage hors run)
        }
        budget.consumed += millicredits;
        balanceService.applyConsumptionToGrants(orgId, millicredits);
        while (budget.consumed > budget.reserved && !budget.exhausted) {
            if (balanceService.tryReserve(orgId, chunkMillicredits)) {
                budget.reserved += chunkMillicredits;
            } else {
                budget.exhausted = true;
                log.info("[CREDITS] Budget epuise en vol (org={}, consomme={}mc, reserve={}mc) "
                        + "— arret propre demande", orgId, budget.consumed, budget.reserved);
            }
        }
    }

    /** True si le run doit s'arreter proprement (solde epuise en vol). */
    public boolean isExhausted() {
        RunBudget budget = current.get();
        return budget != null && budget.exhausted;
    }

    /**
     * Reconciliation de fin de run : release du reserve non consomme, ou debit
     * force de l'overshoot (le solde peut passer negatif — le pre-vol suivant
     * refusera). Detache le ThreadLocal. No-op sans run garde.
     */
    public void endRun() {
        RunBudget budget = current.get();
        if (budget == null) {
            return;
        }
        current.remove();
        long delta = budget.reserved - budget.consumed;
        if (delta > 0) {
            balanceService.release(budget.orgId, delta);
        } else if (delta < 0) {
            balanceService.forceDebit(budget.orgId, -delta);
        }
    }
}
