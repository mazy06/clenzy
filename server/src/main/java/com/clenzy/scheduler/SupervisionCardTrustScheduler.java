package com.clenzy.scheduler;

import com.clenzy.service.agent.supervision.SupervisionCardTrustService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Évaluation quotidienne des Règles de Confiance des CARTES (Vague 3 autonomie
 * constellation, miroir de {@link TrustRuleSuggestionScheduler}) : détecte les
 * (org, type d'action) approuvés N fois de suite par un humain et pose des
 * suggestions « automatiser ce type ? » — INERTES tant qu'un humain ne les
 * accepte pas dans le menu Automatisation.
 */
@Component
public class SupervisionCardTrustScheduler {

    private static final Logger log = LoggerFactory.getLogger(SupervisionCardTrustScheduler.class);

    private final SupervisionCardTrustService cardTrustService;

    public SupervisionCardTrustScheduler(SupervisionCardTrustService cardTrustService) {
        this.cardTrustService = cardTrustService;
    }

    /** Tous les jours à 05h15 (après l'évaluation des Règles de Confiance outils, 05h05). */
    @Scheduled(cron = "0 15 5 * * *")
    public void evaluateCardTrustSuggestions() {
        try {
            int suggested = cardTrustService.evaluateSuggestions();
            if (suggested > 0) {
                log.info("[CARD-TRUST] {} suggestion(s) d'automatisation posee(s)", suggested);
            }
        } catch (Exception e) {
            log.warn("[CARD-TRUST] Evaluation en echec (retentera demain) : {}", e.getMessage(), e);
        }
    }
}
