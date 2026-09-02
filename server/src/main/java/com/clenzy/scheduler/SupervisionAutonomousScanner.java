package com.clenzy.scheduler;

import com.clenzy.model.AiAutonomyBudget;
import com.clenzy.model.SupervisionSettings;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SupervisionSettingsRepository;
import com.clenzy.service.ai.AutonomyBudgetService;
import com.clenzy.service.ai.AutonomyRunScope;
import com.clenzy.service.agent.supervision.SupervisionConfigService;
import com.clenzy.service.agent.supervision.SupervisionScanQuota;
import com.clenzy.service.agent.supervision.SupervisionScanRotation;
import com.clenzy.service.agent.supervision.SupervisionScanService;
import com.clenzy.service.agent.supervision.SupervisionTriggerService;
import com.clenzy.tenant.TenantScopedExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Boucle de scan AUTONOME de la constellation (Phase 3-B.2 étape 2).
 *
 * <p>À chaque cadence, pour chaque org qui n'a pas désactivé l'observation
 * (défaut ON, cf. {@link SupervisionConfigService#DEFAULT_ENABLED}) et n'est pas
 * en pause, lance des scans automatiques des logements — DANS un contexte tenant posé par
 * {@link TenantScopedExecutor} — dans la limite du <b>budget configurable</b>
 * (scans/jour/org, cf. Settings &gt; IA), garanti atomiquement par
 * {@link SupervisionScanQuota}.</p>
 *
 * <p><b>Deux sources, dans cet ordre</b> :</p>
 * <ol>
 *   <li>les logements « dirty » — ceux qu'un événement métier vient de toucher
 *       ({@link SupervisionTriggerService}). Ils passent toujours d'abord :
 *       c'est là que l'information est fraîche ;</li>
 *   <li>en complément, les logements <b>ACTIFS</b> dont c'est le tour
 *       ({@link SupervisionScanRotation}) : les plus anciennement vus, ceux
 *       jamais scannés en tête. Sans ce complément, un logement calme — aucune
 *       réservation, aucune intervention — n'était jamais passé en revue, et
 *       aucune carte ne pouvait naître de lui.</li>
 * </ol>
 *
 * <p>Le complément est borné deux fois : par {@code max-periodic-per-cycle}
 * (pour qu'un cycle n'avale pas le budget du jour et laisse de la place aux
 * événements des heures suivantes) et par le budget quotidien de l'org.</p>
 *
 * <p><b>Kill-switch serveur</b> : {@code clenzy.supervision.autonomous.enabled}.
 * Le scan consomme des tokens et tourne sans opérateur.</p>
 *
 * <p><b>Gate premium (X8-b, ADR-007)</b> : le scan LLM autonome est un
 * comportement premium — chaque scan passe par
 * {@link AutonomyRunScope#runPremium} (comportement
 * {@code supervision_scan} activé + plafond de cycle). Au plafond en
 * NOTIFY_ONLY, <b>comme lorsque l'autonomie n'a jamais été activée</b> : mode
 * dégradé déterministe (0 LLM, scénario S4 D-105) — le réglage borne la dépense,
 * pas l'observation. PAUSE seul ne fait rien : c'est une suspension demandée.</p>
 */
@Component
public class SupervisionAutonomousScanner {

    private static final Logger log = LoggerFactory.getLogger(SupervisionAutonomousScanner.class);

    private final boolean enabled;
    private final Duration periodicInterval;
    private final int maxPeriodicPerCycle;
    private final OrganizationRepository organizationRepository;
    private final SupervisionSettingsRepository settingsRepository;
    private final SupervisionTriggerService triggerService;
    private final SupervisionScanQuota quota;
    private final SupervisionScanRotation rotation;
    private final SupervisionScanService scanService;
    private final PropertyRepository propertyRepository;
    private final TenantScopedExecutor tenantScopedExecutor;
    private final AutonomyRunScope autonomyRunScope;

    public SupervisionAutonomousScanner(
            @Value("${clenzy.supervision.autonomous.enabled:false}") boolean enabled,
            @Value("${clenzy.supervision.autonomous.periodic-interval-ms:21600000}") long periodicIntervalMs,
            @Value("${clenzy.supervision.autonomous.max-periodic-per-cycle:5}") int maxPeriodicPerCycle,
            OrganizationRepository organizationRepository,
            SupervisionSettingsRepository settingsRepository,
            SupervisionTriggerService triggerService,
            SupervisionScanQuota quota,
            SupervisionScanRotation rotation,
            SupervisionScanService scanService,
            PropertyRepository propertyRepository,
            TenantScopedExecutor tenantScopedExecutor,
            AutonomyRunScope autonomyRunScope) {
        this.enabled = enabled;
        this.periodicInterval = Duration.ofMillis(Math.max(0L, periodicIntervalMs));
        this.maxPeriodicPerCycle = maxPeriodicPerCycle;
        this.organizationRepository = organizationRepository;
        this.settingsRepository = settingsRepository;
        this.triggerService = triggerService;
        this.quota = quota;
        this.rotation = rotation;
        this.scanService = scanService;
        this.propertyRepository = propertyRepository;
        this.tenantScopedExecutor = tenantScopedExecutor;
        this.autonomyRunScope = autonomyRunScope;
    }

    @Scheduled(fixedDelayString = "${clenzy.supervision.autonomous.interval-ms:3600000}",
            initialDelayString = "${clenzy.supervision.autonomous.initial-delay-ms:120000}")
    @SchedulerLock(name = "supervision-autonomous-sweep", lockAtMostFor = "PT55M")
    public void sweep() {
        if (!enabled) {
            return; // kill-switch serveur : rien tant que non activé explicitement
        }
        List<Long> orgIds = organizationRepository.findAllIds();
        if (orgIds.isEmpty()) {
            return;
        }
        // Une seule lecture de la table de réglages : ce sont les EXCEPTIONS au
        // défaut produit (org qui a désactivé, mise en pause, ou changé son
        // budget). Les orgs sans ligne sont la règle, pas l'oubli.
        Map<Long, SupervisionSettings> byOrg = settingsRepository.findAll().stream()
                .filter(settings -> settings.getOrganizationId() != null)
                .collect(Collectors.toMap(SupervisionSettings::getOrganizationId,
                        Function.identity(), (first, duplicate) -> first));

        for (Long orgId : orgIds) {
            SupervisionSettings settings = byOrg.get(orgId);
            if (settings != null && (!settings.isEnabled() || settings.isPaused())) {
                continue; // opt-out explicite de l'organisation
            }
            int budget = settings != null
                    ? settings.getDailyScanBudget()
                    : SupervisionConfigService.DEFAULT_DAILY_SCAN_BUDGET;
            if (budget <= 0) {
                continue; // budget nul → pas de scan automatique
            }
            try {
                tenantScopedExecutor.runAsOrganization(orgId, () -> sweepOrganization(orgId, budget));
            } catch (Exception e) {
                log.error("Supervision sweep failed for org {}: {}", orgId, e.getMessage());
            }
        }
    }

    /**
     * Scanne les logements de l'org — événementiels d'abord, complément
     * périodique ensuite — contexte tenant déjà posé, borné par le budget.
     */
    private void sweepOrganization(Long orgId, int budget) {
        Set<Long> queue = new LinkedHashSet<>(triggerService.drainDirty(orgId));
        queue.addAll(periodicBacklog(orgId, queue));
        if (queue.isEmpty()) {
            return; // rien de neuf, rien dont ce soit le tour
        }

        int scanned = 0;
        for (Long propertyId : queue) {
            if (!quota.tryConsume(orgId, budget)) {
                break; // budget du jour épuisé
            }
            try {
                AutonomyBudgetService.Decision decision = autonomyRunScope.runPremium(
                        orgId, AiAutonomyBudget.BEHAVIOR_SUPERVISION_SCAN,
                        () -> scanService.autonomousScan(orgId, propertyId));
                switch (decision.outcome()) {
                    case ALLOWED -> scanned++;
                    case CAPPED_NOTIFY_ONLY, DISABLED ->
                        scanService.deterministicScanOnly(orgId, propertyId);
                    case CAPPED_PAUSE -> {
                        // Suspension demandée : elle vaut pour toute l'org, pas
                        // pour ce seul logement. Poursuivre la file consommerait
                        // le budget du jour sans rien produire.
                        return;
                    }
                }
            } catch (Exception e) {
                log.warn("Autonomous scan failed org={} property={}: {}",
                        orgId, propertyId, e.getMessage());
            }
            // Le budget a été consommé, en succès comme en échec : le tour de
            // rôle avance, sinon un logement en échec bloquerait tous les autres.
            rotation.markScanned(orgId, propertyId);
        }
        if (scanned > 0) {
            log.info("Supervision autonomous sweep org={} → {} logement(s) scanné(s)", orgId, scanned);
        }
    }

    /**
     * Complément périodique : les logements ACTIFS de l'org dont c'est le tour,
     * hors de ceux que la file événementielle traite déjà ce cycle.
     */
    private List<Long> periodicBacklog(Long orgId, Collection<Long> alreadyQueued) {
        if (maxPeriodicPerCycle <= 0) {
            return List.of(); // complément désactivé par configuration
        }
        List<Long> candidates = new ArrayList<>(propertyRepository.findActiveIdsByOrganizationId(orgId));
        candidates.removeAll(alreadyQueued);
        return rotation.dueForScan(orgId, candidates, periodicInterval, maxPeriodicPerCycle);
    }
}
