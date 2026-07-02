package com.clenzy.service.ai;

import com.clenzy.repository.AiCreditGrantRepository;
import com.clenzy.repository.AiTokenUsageRepository;
import com.clenzy.repository.AiUsageLedgerRepository;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reconciliation double du systeme de credits (campagne X10, Phase 2 §7).
 *
 * <ol>
 *   <li><b>Marge (ledger ↔ factures providers)</b> : rapport mensuel par
 *       provider — cout reel absorbe (micro-USD, cache deduit), debit client
 *       (millicredits), tokens — a rapprocher MANUELLEMENT des factures
 *       Anthropic/OpenAI (pas d'API de facturation cote providers). Le
 *       cross-check automatique interne compare le ledger a {@code ai_token_usage}
 *       (les deux comptabilites de transition) : une derive > 5 % = fuite de
 *       comptage quelque part.</li>
 *   <li><b>Revenu (poches ↔ Stripe)</b> : total accorde par source sur le mois ;
 *       toute poche TOPUP sans {@code stripe_ref} est une anomalie.</li>
 *   <li><b>Solde chaud (Redis ↔ Postgres)</b> : verification quotidienne — une
 *       derive au-dela de la tolerance est corrigee (invalidate → recharge DB)
 *       et comptee ({@code assistant.credits.balance_drift}).</li>
 * </ol>
 */
@Service
public class CreditReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(CreditReconciliationService.class);

    /** Tolerance de derive du solde chaud : 1 credit (reservations en vol legitimes). */
    static final long DRIFT_TOLERANCE_MILLICREDITS = 1000L;

    public static final String DRIFT_COUNTER = "assistant.credits.balance_drift";

    private final AiUsageLedgerRepository ledgerRepository;
    private final AiCreditGrantRepository grantRepository;
    private final AiTokenUsageRepository tokenUsageRepository;
    private final CreditBalanceService balanceService;
    private final MeterRegistry meterRegistry;

    public CreditReconciliationService(AiUsageLedgerRepository ledgerRepository,
                                       AiCreditGrantRepository grantRepository,
                                       AiTokenUsageRepository tokenUsageRepository,
                                       CreditBalanceService balanceService,
                                       MeterRegistry meterRegistry) {
        this.ledgerRepository = ledgerRepository;
        this.grantRepository = grantRepository;
        this.tokenUsageRepository = tokenUsageRepository;
        this.balanceService = balanceService;
        this.meterRegistry = meterRegistry;
    }

    /**
     * Verification quotidienne du solde chaud : compare Redis a la somme des
     * poches pour chaque org active. Derive au-dela de la tolerance → correction
     * (invalidate, la prochaine reservation rechargera depuis Postgres) + compteur.
     *
     * @return nombre de derives corrigees
     */
    public int reconcileHotBalances() {
        int drifts = 0;
        for (Long orgId : grantRepository.findOrganizationsWithActiveGrants(Instant.now())) {
            Long hot = balanceService.readHotBalance(orgId);
            if (hot == null) {
                continue; // cache froid / Redis KO : rien a comparer
            }
            long cold = balanceService.coldBalance(orgId);
            long drift = Math.abs(hot - cold);
            if (drift > DRIFT_TOLERANCE_MILLICREDITS) {
                drifts++;
                meterRegistry.counter(DRIFT_COUNTER).increment();
                log.warn("[RECONCILIATION] Derive solde chaud org={} : redis={}mc, poches={}mc "
                        + "(delta {}mc) → invalidation (recharge au prochain pre-vol)",
                        orgId, hot, cold, drift);
                balanceService.invalidate(orgId);
            }
        }
        return drifts;
    }

    /**
     * Rapport mensuel de reconciliation : marge par provider (a rapprocher des
     * factures), revenu par source de poche, et cross-check interne
     * ledger ↔ ai_token_usage (tokens).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> monthlyReport(YearMonth month) {
        Instant from = month.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant to = month.plusMonths(1).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);

        // 1. Marge par provider (ledger).
        List<Map<String, Object>> providers = new ArrayList<>();
        Map<String, Long> ledgerTokensByProvider = new LinkedHashMap<>();
        for (Object[] row : ledgerRepository.aggregateUsageByProvider(from, to)) {
            String provider = (String) row[0];
            long costMicroUsd = ((Number) row[1]).longValue();
            long debitMillicredits = ((Number) row[2]).longValue();
            long tokens = ((Number) row[3]).longValue();
            ledgerTokensByProvider.put(provider, tokens);
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("provider", provider);
            p.put("realCostMicroUsd", costMicroUsd);
            p.put("clientDebitMillicredits", debitMillicredits);
            p.put("tokens", tokens);
            providers.add(p);
        }

        // 2. Cross-check interne : ai_token_usage (comptabilite historique) vs ledger.
        List<Map<String, Object>> crossCheck = new ArrayList<>();
        for (Object[] row : tokenUsageRepository.sumTokensByProviderForMonth(month.toString())) {
            String provider = (String) row[0];
            long legacyTokens = ((Number) row[1]).longValue();
            long ledgerTokens = ledgerTokensByProvider.getOrDefault(provider, 0L);
            double divergence = legacyTokens == 0 ? 0d
                    : Math.abs(legacyTokens - ledgerTokens) / (double) legacyTokens;
            if (divergence > 0.05) {
                log.warn("[RECONCILIATION] Divergence ledger↔ai_token_usage provider={} : "
                        + "legacy={} tokens, ledger={} tokens ({}%)",
                        provider, legacyTokens, ledgerTokens, Math.round(divergence * 100));
            }
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("provider", provider);
            c.put("legacyTokens", legacyTokens);
            c.put("ledgerTokens", ledgerTokens);
            c.put("divergencePct", Math.round(divergence * 1000) / 10.0);
            crossCheck.add(c);
        }

        // 3. Revenu : poches accordees par source sur le mois.
        List<Map<String, Object>> grants = new ArrayList<>();
        for (Object[] row : grantRepository.sumGrantedBySource(from, to)) {
            Map<String, Object> g = new LinkedHashMap<>();
            g.put("source", row[0]);
            g.put("grantedMillicredits", ((Number) row[1]).longValue());
            g.put("count", ((Number) row[2]).longValue());
            grants.add(g);
        }

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("month", month.toString());
        report.put("providers", providers);
        report.put("tokenCrossCheck", crossCheck);
        report.put("grantsBySource", grants);
        return report;
    }
}
