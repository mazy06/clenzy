package com.clenzy.scheduler;

import com.clenzy.service.agent.AgentTrustRuleService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Evaluation quotidienne des Regles de Confiance (campagne X2) : detecte les
 * couples (org, outil) systematiquement confirmes et cree des suggestions —
 * INERTES tant qu'un humain ne les accepte pas.
 */
@Component
public class TrustRuleSuggestionScheduler {

    private static final Logger log = LoggerFactory.getLogger(TrustRuleSuggestionScheduler.class);

    private final AgentTrustRuleService trustRuleService;

    public TrustRuleSuggestionScheduler(AgentTrustRuleService trustRuleService) {
        this.trustRuleService = trustRuleService;
    }

    /** Tous les jours a 05h05 (apres les jobs de nuit et l'expiration des pauses). */
    @Scheduled(cron = "0 5 5 * * *")
    public void evaluateTrustRuleSuggestions() {
        try {
            int created = trustRuleService.evaluateSuggestions();
            if (created > 0) {
                log.info("[TRUST] {} Regle(s) de Confiance suggeree(s)", created);
            }
        } catch (Exception e) {
            log.warn("[TRUST] Evaluation en echec (retentera demain) : {}", e.getMessage(), e);
        }
    }
}
