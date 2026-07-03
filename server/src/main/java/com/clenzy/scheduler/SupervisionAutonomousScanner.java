package com.clenzy.scheduler;

import com.clenzy.model.AiAutonomyBudget;
import com.clenzy.model.SupervisionSettings;
import com.clenzy.repository.SupervisionSettingsRepository;
import com.clenzy.service.ai.AutonomyBudgetService;
import com.clenzy.service.ai.AutonomyRunScope;
import com.clenzy.service.agent.supervision.SupervisionScanQuota;
import com.clenzy.service.agent.supervision.SupervisionScanService;
import com.clenzy.service.agent.supervision.SupervisionTriggerService;
import com.clenzy.tenant.TenantScopedExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Boucle de scan AUTONOME de la constellation (Phase 3-B.2 étape 2).
 *
 * <p>À chaque cadence, pour chaque org ayant activé la feature (non en pause),
 * lance des scans automatiques des logements — DANS un contexte tenant posé par
 * {@link TenantScopedExecutor} — dans la limite du <b>budget configurable</b>
 * (scans/jour/org, cf. Settings &gt; IA), garanti atomiquement par
 * {@link SupervisionScanQuota}.</p>
 *
 * <p><b>Kill-switch serveur</b> : désactivé par défaut
 * ({@code clenzy.supervision.autonomous.enabled=false}). À n'activer qu'après
 * vérification du chemin LLM autonome en environnement réel — le scan consomme
 * des tokens et tourne sans opérateur.</p>
 *
 * <p>v1 = balayage des logements de l'org borné par le budget. Le déclenchement
 * <i>event-driven</i> (Outbox/Kafka → marquage « dirty » par propriété) est
 * l'affinage suivant (prioriser les logements ayant reçu un événement).</p>
 *
 * <p><b>Gate premium (X8-b, ADR-007)</b> : le scan LLM autonome est un
 * comportement premium — chaque scan passe par
 * {@link AutonomyRunScope#runPremium} (comportement
 * {@code supervision_scan} activé + plafond de cycle). Au plafond en
 * NOTIFY_ONLY : mode dégradé déterministe (0 LLM, scénario S4 D-105) ;
 * PAUSE ou comportement désactivé : rien.</p>
 */
@Component
public class SupervisionAutonomousScanner {

    private static final Logger log = LoggerFactory.getLogger(SupervisionAutonomousScanner.class);

    private final boolean enabled;
    private final SupervisionSettingsRepository settingsRepository;
    private final SupervisionTriggerService triggerService;
    private final SupervisionScanQuota quota;
    private final SupervisionScanService scanService;
    private final TenantScopedExecutor tenantScopedExecutor;
    private final AutonomyRunScope autonomyRunScope;

    public SupervisionAutonomousScanner(
            @Value("${clenzy.supervision.autonomous.enabled:false}") boolean enabled,
            SupervisionSettingsRepository settingsRepository,
            SupervisionTriggerService triggerService,
            SupervisionScanQuota quota,
            SupervisionScanService scanService,
            TenantScopedExecutor tenantScopedExecutor,
            AutonomyRunScope autonomyRunScope) {
        this.enabled = enabled;
        this.settingsRepository = settingsRepository;
        this.triggerService = triggerService;
        this.quota = quota;
        this.scanService = scanService;
        this.tenantScopedExecutor = tenantScopedExecutor;
        this.autonomyRunScope = autonomyRunScope;
    }

    @Scheduled(fixedDelayString = "${clenzy.supervision.autonomous.interval-ms:3600000}",
            initialDelayString = "${clenzy.supervision.autonomous.initial-delay-ms:120000}")
    public void sweep() {
        if (!enabled) {
            return; // kill-switch serveur : rien tant que non activé explicitement
        }
        List<SupervisionSettings> active = settingsRepository.findByEnabledTrueAndPausedFalse();
        for (SupervisionSettings settings : active) {
            if (settings.getDailyScanBudget() <= 0) {
                continue; // budget nul → pas de scan automatique
            }
            try {
                tenantScopedExecutor.runAsOrganization(
                        settings.getOrganizationId(), () -> sweepOrganization(settings));
            } catch (Exception e) {
                log.error("Supervision sweep failed for org {}: {}",
                        settings.getOrganizationId(), e.getMessage());
            }
        }
    }

    /**
     * Scanne les logements « dirty » de l'org (event-driven), contexte tenant
     * déjà posé, borné par le budget. Aucun logement dirty → rien (on ne scanne
     * que ce qui a changé).
     */
    private void sweepOrganization(SupervisionSettings settings) {
        Long orgId = settings.getOrganizationId();
        int budget = settings.getDailyScanBudget();
        Set<Long> dirty = triggerService.drainDirty(orgId);
        if (dirty.isEmpty()) {
            return; // event-driven : rien à scanner ce cycle
        }
        int scanned = 0;
        for (Long propertyId : dirty) {
            if (!quota.tryConsume(orgId, budget)) {
                break; // budget du jour épuisé
            }
            try {
                // X8-b : scan LLM = comportement premium gated (bucket PREMIUM_AUTO au ledger).
                AutonomyBudgetService.Decision decision = autonomyRunScope.runPremium(
                        orgId, AiAutonomyBudget.BEHAVIOR_SUPERVISION_SCAN,
                        () -> scanService.autonomousScan(orgId, propertyId));
                switch (decision.outcome()) {
                    case ALLOWED -> scanned++;
                    case CAPPED_NOTIFY_ONLY ->
                        // Plafond atteint, mode notifier : heuristiques déterministes
                        // seules (0 LLM, 0 crédit) — les suggestions continuent d'arriver.
                        scanService.deterministicScanOnly(orgId, propertyId);
                    case CAPPED_PAUSE, DISABLED -> {
                        // PAUSE : autonomie suspendue jusqu'au cycle suivant.
                        // DISABLED : comportement non activé (panneau autonomie) ou plafond 0.
                    }
                }
            } catch (Exception e) {
                log.warn("Autonomous scan failed org={} property={}: {}",
                        orgId, propertyId, e.getMessage());
            }
        }
        if (scanned > 0) {
            log.info("Supervision autonomous sweep org={} → {} logement(s) scanné(s)", orgId, scanned);
        }
    }
}
