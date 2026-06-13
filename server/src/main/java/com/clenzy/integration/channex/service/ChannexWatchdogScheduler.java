package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.dto.ChannexHealthSummary;
import com.clenzy.integration.channex.dto.ChannexHealthSummary.AttentionItem;
import com.clenzy.integration.channex.dto.ChannexHealthSummary.Severity;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.model.NotificationKey;
import com.clenzy.service.NotificationService;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Watchdog Channex — Phase 2 (proactivite).
 *
 * <p>Scan cross-tenant periodique de tous les mappings Channex pour :</p>
 * <ul>
 *   <li>Logger les anomalies (ERROR persistant, PENDING bloque, ACTIVE stale)</li>
 *   <li>Exposer des gauges Prometheus consommees par Grafana / alerting</li>
 * </ul>
 *
 * <p><b>Pourquoi un watchdog</b> : sans lui, les mappings en erreur restent
 * silencieusement bloques jusqu'a ce qu'un humain ouvre la page Channex. Le
 * watchdog rend l'echec visible cote ops (Prometheus + logs) et prepare le
 * terrain pour des notifications proactives (future).</p>
 *
 * <p>Multi-tenant : tourne hors contexte HTTP → utilise
 * {@link com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository#findAllAcrossOrgs}
 * qui bypass le filtre d'organisation Hibernate.</p>
 *
 * <p><b>Frequence</b> : par defaut toutes les 15 min. Override via la propriete
 * {@code clenzy.channex.watchdog.interval-minutes} (en minutes).</p>
 */
@Service
public class ChannexWatchdogScheduler {

    private static final Logger log = LoggerFactory.getLogger(ChannexWatchdogScheduler.class);

    private final ChannexConnectService connectService;
    private final NotificationService notificationService;
    private final com.clenzy.integration.channex.config.ChannexProperties channexProperties;
    private final MeterRegistry registry;

    /** Gauges Prometheus : nb de mappings par etat + nb d'items meritant attention. */
    private final Map<ChannexSyncStatus, AtomicInteger> statusGauges;
    private final AtomicInteger attentionGauge = new AtomicInteger(0);
    private final AtomicLong lastScanTimestamp = new AtomicLong(0L);

    /**
     * Dedup notifications : on memorise les propertyIds deja notifies en ERROR.
     * - Quand un nouveau passe en ERROR (pas dans le set) : on notifie + on ajoute.
     * - Quand un revient en ACTIVE (etait dans le set, plus en ERROR) : on
     *   notifie "recovered" + on retire.
     * En-memoire : reset au reboot (acceptable — au pire on re-notifie 1x apres
     * un restart, vs DB-backed qui complexifie sans gain net).
     */
    private final Set<Long> notifiedErrorPropertyIds = ConcurrentHashMap.newKeySet();

    public ChannexWatchdogScheduler(ChannexConnectService connectService,
                                     NotificationService notificationService,
                                     com.clenzy.integration.channex.config.ChannexProperties channexProperties,
                                     MeterRegistry registry) {
        this.connectService = connectService;
        this.notificationService = notificationService;
        this.channexProperties = channexProperties;
        this.registry = registry;
        // Pre-initialise les gauges (une par statut). On bind chacune au registry
        // pour exposer channex.watchdog.mappings{status="ACTIVE|PENDING|ERROR|DISABLED"}
        this.statusGauges = new java.util.EnumMap<>(ChannexSyncStatus.class);
        for (ChannexSyncStatus st : ChannexSyncStatus.values()) {
            AtomicInteger gauge = new AtomicInteger(0);
            statusGauges.put(st, gauge);
            registry.gauge("channex.watchdog.mappings",
                io.micrometer.core.instrument.Tags.of("status", st.name()), gauge);
        }
        registry.gauge("channex.watchdog.attention_items", attentionGauge);
        registry.gauge("channex.watchdog.last_scan_epoch_seconds", lastScanTimestamp);
    }

    /**
     * Scan periodique de la sante de tous les mappings.
     *
     * <p>Best-effort : un echec sur une org / un mapping n'arrete pas le scan.
     * Erreurs loggees mais ne propagent pas (un scheduler doit etre tolerant).</p>
     */
    @Scheduled(fixedRateString = "#{${clenzy.channex.watchdog.interval-minutes:15} * 60000}",
               initialDelayString = "${clenzy.channex.watchdog.initial-delay-ms:60000}")
    public void scan() {
        // Phase 5 audit fix O5 : skip si l'API key Channex n'est pas configuree.
        // Evite d'inonder les logs en dev/staging sans clef + de polluer les gauges
        // Prometheus avec des valeurs eronnees.
        if (!channexProperties.isConfigured()) {
            log.debug("ChannexWatchdog: scan skip (CHANNEX_API_KEY non configuree)");
            return;
        }
        long start = System.currentTimeMillis();
        try {
            // null = cross-tenant (tous les orgs)
            ChannexHealthSummary summary = connectService.computeHealthSummary(null);
            updateGauges(summary);
            logFindings(summary);
            emitNotifications(summary);
            long elapsed = System.currentTimeMillis() - start;
            log.info("ChannexWatchdog: scan termine en {}ms — total={} attention={}",
                elapsed, summary.totalMappings(), summary.attentionItems().size());
        } catch (Exception e) {
            log.error("ChannexWatchdog: scan KO — {} (next attempt dans 15 min)", e.getMessage(), e);
        }
    }

    /**
     * Emission de notifications avec dedup par transition d'etat :
     * <ul>
     *   <li>Property entre en ERROR (n'etait pas notifiee) → push CHANNEX_SYNC_ERROR
     *       aux admins/managers de l'org concernee + memorise</li>
     *   <li>Property notifiee precedemment, sort de ERROR → push CHANNEX_SYNC_RECOVERED
     *       + retire de la memoire</li>
     * </ul>
     *
     * <p>Pas de notification pour WARNING/INFO (trop bruyant) — l'admin les voit
     * dans le Health Summary Panel au moment ou il ouvre les settings Channex.</p>
     */
    private void emitNotifications(ChannexHealthSummary summary) {
        // Set des properties actuellement en ERROR (avec leur orgId pour le routing)
        Map<Long, AttentionItem> currentErrors = new java.util.HashMap<>();
        for (AttentionItem item : summary.attentionItems()) {
            if (item.severity() == Severity.ERROR) {
                currentErrors.put(item.clenzyPropertyId(), item);
            }
        }

        // Transitions IN : nouveaux passages en ERROR
        Set<Long> newlyInError = new HashSet<>(currentErrors.keySet());
        newlyInError.removeAll(notifiedErrorPropertyIds);
        for (Long propertyId : newlyInError) {
            AttentionItem item = currentErrors.get(propertyId);
            try {
                notificationService.notifyAdminsAndManagers(
                    NotificationKey.CHANNEX_SYNC_ERROR,
                    "Sync Channex en erreur",
                    "« " + item.propertyName() + " » : " + item.reason()
                        + (item.lastSyncError() != null ? " — " + truncate(item.lastSyncError(), 120) : ""),
                    "/channels",
                    item.organizationId()
                );
                log.warn("ChannexWatchdog: notification ERROR envoyee property={} org={}",
                    propertyId, item.organizationId());
            } catch (Exception e) {
                log.error("ChannexWatchdog: echec notif ERROR property={}: {}",
                    propertyId, e.getMessage());
            }
        }

        // Transitions OUT : recoveries (etait notifie, n'est plus en ERROR)
        Set<Long> recovered = new HashSet<>(notifiedErrorPropertyIds);
        recovered.removeAll(currentErrors.keySet());
        for (Long propertyId : recovered) {
            // Pour la recovery on a perdu l'orgId (la property n'est plus dans
            // attentionItems). On recharge le summary mapping pour le retrouver,
            // ou on stocke (propertyId → orgId) dans la memoire. Solution simple :
            // changer le set en Map<Long, Long> propertyId → orgId.
            Long orgId = orgIdByPropertyCache.get(propertyId);
            if (orgId == null) {
                log.warn("ChannexWatchdog: recovery property={} mais orgId perdu — skip notif",
                    propertyId);
                continue;
            }
            try {
                notificationService.notifyAdminsAndManagers(
                    NotificationKey.CHANNEX_SYNC_RECOVERED,
                    "Sync Channex retablie",
                    "La synchronisation pour la propriete #" + propertyId
                        + " fonctionne a nouveau.",
                    "/channels",
                    orgId
                );
                log.info("ChannexWatchdog: notification RECOVERED envoyee property={} org={}",
                    propertyId, orgId);
            } catch (Exception e) {
                log.error("ChannexWatchdog: echec notif RECOVERED property={}: {}",
                    propertyId, e.getMessage());
            }
        }

        // Met a jour la memoire pour le prochain scan
        notifiedErrorPropertyIds.removeAll(recovered);
        notifiedErrorPropertyIds.addAll(newlyInError);
        // Et le cache propertyId → orgId pour les futures recoveries
        for (Map.Entry<Long, AttentionItem> e : currentErrors.entrySet()) {
            orgIdByPropertyCache.put(e.getKey(), e.getValue().organizationId());
        }
        orgIdByPropertyCache.keySet().retainAll(notifiedErrorPropertyIds);
    }

    /** Cache propertyId → orgId pour retrouver l'org lors d'une recovery. */
    private final Map<Long, Long> orgIdByPropertyCache = new ConcurrentHashMap<>();

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    /** Met a jour les gauges Prometheus avec les valeurs courantes. */
    private void updateGauges(ChannexHealthSummary summary) {
        for (Map.Entry<ChannexSyncStatus, Integer> e : summary.countsByStatus().entrySet()) {
            statusGauges.get(e.getKey()).set(e.getValue());
        }
        attentionGauge.set(summary.attentionItems().size());
        lastScanTimestamp.set(summary.computedAt().getEpochSecond());
    }

    /** Log les findings au niveau approprie (ERROR pour Severity.ERROR, etc). */
    private void logFindings(ChannexHealthSummary summary) {
        if (summary.attentionItems().isEmpty()) {
            log.debug("ChannexWatchdog: aucun mapping a surveiller (total={})",
                summary.totalMappings());
            return;
        }
        for (AttentionItem item : summary.attentionItems()) {
            switch (item.severity()) {
                case ERROR -> log.error("ChannexWatchdog[ERROR] property={} ({}) — {} (last_error={})",
                    item.clenzyPropertyId(), item.propertyName(), item.reason(),
                    item.lastSyncError() != null ? item.lastSyncError() : "n/a");
                case WARNING -> log.warn("ChannexWatchdog[WARN] property={} ({}) — {}",
                    item.clenzyPropertyId(), item.propertyName(), item.reason());
                case INFO -> log.info("ChannexWatchdog[INFO] property={} ({}) — {}",
                    item.clenzyPropertyId(), item.propertyName(), item.reason());
            }
        }
    }
}
