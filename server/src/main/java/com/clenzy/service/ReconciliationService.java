package com.clenzy.service;

import com.clenzy.config.SyncMetrics;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.integration.channel.model.ChannelCalendarDay;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.model.AuditAction;
import com.clenzy.model.AuditSource;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.ReconciliationRun;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.ReconciliationRunRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service de reconciliation calendrier.
 * Compare periodiquement le calendrier PMS (source de verite) avec
 * les calendriers cote channels, detecte les divergences et les corrige.
 *
 * PMS est toujours le master : en cas de divergence, on pousse
 * l'etat PMS vers le channel via pushCalendarUpdate().
 *
 * Planification : toutes les heures via @Scheduled(cron).
 * Peut aussi etre declenche manuellement pour une propriete via reconcileProperty().
 */
@Service
public class ReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(ReconciliationService.class);

    /** Nombre de jours a reconcilier a partir d'aujourd'hui */
    private static final int RECONCILIATION_WINDOW_DAYS = 30;

    /** Seuil de divergence (%) au-dessus duquel on alerte */
    private static final double DIVERGENCE_ALERT_THRESHOLD = 5.0;

    private final ChannelMappingRepository mappingRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final ChannelConnectorRegistry connectorRegistry;
    private final ReconciliationRunRepository reconciliationRunRepository;
    private final SyncMetrics syncMetrics;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    public ReconciliationService(ChannelMappingRepository mappingRepository,
                                  CalendarDayRepository calendarDayRepository,
                                  ChannelConnectorRegistry connectorRegistry,
                                  ReconciliationRunRepository reconciliationRunRepository,
                                  SyncMetrics syncMetrics,
                                  NotificationService notificationService,
                                  AuditLogService auditLogService,
                                  ObjectMapper objectMapper) {
        this.mappingRepository = mappingRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.connectorRegistry = connectorRegistry;
        this.reconciliationRunRepository = reconciliationRunRepository;
        this.syncMetrics = syncMetrics;
        this.notificationService = notificationService;
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
    }

    // ── Scheduled reconciliation (toutes les heures) ─────────────────────────

    /**
     * Reconciliation automatique horaire de tous les mappings actifs.
     */
    @Scheduled(cron = "0 0 * * * *")
    public void scheduledReconciliation() {
        log.info("[Reconciliation] Demarrage reconciliation horaire");
        long start = System.currentTimeMillis();

        List<ChannelMapping> activeMappings = mappingRepository.findAllActiveCrossOrg();
        log.info("[Reconciliation] {} mappings actifs a reconcilier", activeMappings.size());

        int totalRuns = 0;
        int totalDiscrepancies = 0;
        int totalFixes = 0;

        for (ChannelMapping mapping : activeMappings) {
            try {
                ReconciliationRun run = reconcileMapping(mapping);
                totalRuns++;
                totalDiscrepancies += run.getDiscrepanciesFound();
                totalFixes += run.getDiscrepanciesFixed();
            } catch (Exception e) {
                log.error("[Reconciliation] Erreur pour mapping {} (property={}, channel={}): {}",
                        mapping.getId(), mapping.getInternalId(),
                        mapping.getConnection().getChannel().name(), e.getMessage(), e);
            }
        }

        long duration = System.currentTimeMillis() - start;
        log.info("[Reconciliation] Termine en {}ms — runs={}, divergences={}, fixes={}",
                duration, totalRuns, totalDiscrepancies, totalFixes);
    }

    // ── Manual trigger ───────────────────────────────────────────────────────

    /**
     * Declenche une reconciliation manuelle pour une propriete.
     * Reconcilie tous les mappings actifs de cette propriete.
     *
     * @param propertyId propriete a reconcilier
     */
    @Async
    @Transactional
    public void reconcileProperty(Long propertyId) {
        log.info("[Reconciliation] Reconciliation manuelle pour property {}", propertyId);

        List<ChannelMapping> mappings = mappingRepository.findAllActiveCrossOrg().stream()
                .filter(m -> m.getInternalId().equals(propertyId))
                .collect(Collectors.toList());

        if (mappings.isEmpty()) {
            log.warn("[Reconciliation] Aucun mapping actif pour property {}", propertyId);
            return;
        }

        for (ChannelMapping mapping : mappings) {
            try {
                reconcileMapping(mapping);
            } catch (Exception e) {
                log.error("[Reconciliation] Erreur manuelle pour mapping {} (property={}): {}",
                        mapping.getId(), propertyId, e.getMessage(), e);
            }
        }
    }

    // ── Core reconciliation logic ────────────────────────────────────────────

    /**
     * Reconcilie un mapping individuel : compare PMS vs channel,
     * detecte et corrige les divergences.
     */
    @Transactional
    public ReconciliationRun reconcileMapping(ChannelMapping mapping) {
        String channelName = mapping.getConnection().getChannel().name();
        Long propertyId = mapping.getInternalId();
        Long orgId = mapping.getOrganizationId();

        ReconciliationRun run = new ReconciliationRun(channelName, propertyId, orgId);
        run = reconciliationRunRepository.save(run);

        syncMetrics.incrementReconciliationRuns();

        try {
            // 1. Recuperer le connecteur channel
            Optional<ChannelConnector> connectorOpt = connectorRegistry.getConnector(
                    mapping.getConnection().getChannel());

            if (connectorOpt.isEmpty()) {
                completeRun(run, "FAILED", "Connector not found for " + channelName);
                return run;
            }

            ChannelConnector connector = connectorOpt.get();
            LocalDate from = LocalDate.now();
            LocalDate to = from.plusDays(RECONCILIATION_WINDOW_DAYS);

            // 2. Lire le calendrier cote channel
            List<ChannelCalendarDay> channelDays = connector.getChannelCalendar(mapping, from, to);

            if (channelDays.isEmpty()) {
                // Le channel ne supporte pas la lecture — run SUCCESS sans comparaison
                run.setChannelDaysChecked(0);
                run.setPmsDaysChecked(0);
                completeRun(run, "SUCCESS", null);
                return run;
            }

            run.setChannelDaysChecked(channelDays.size());

            // 3. Lire le calendrier PMS
            List<CalendarDay> pmsDays = calendarDayRepository.findByPropertyAndDateRange(
                    propertyId, from, to, orgId);

            run.setPmsDaysChecked(pmsDays.size());

            // 4. Comparer jour par jour
            Map<LocalDate, String> pmsStatusByDate = pmsDays.stream()
                    .collect(Collectors.toMap(
                            CalendarDay::getDate,
                            cd -> cd.getStatus().name(),
                            (a, b) -> a // en cas de doublons, prendre le premier
                    ));

            List<Map<String, String>> discrepancyDetails = new ArrayList<>();
            int discrepanciesFound = 0;
            int discrepanciesFixed = 0;

            LocalDate fixFrom = null;
            LocalDate fixTo = null;

            for (ChannelCalendarDay channelDay : channelDays) {
                String pmsStatus = pmsStatusByDate.getOrDefault(channelDay.date(), "AVAILABLE");
                String channelStatus = normalizeStatus(channelDay.status());

                if (!pmsStatus.equals(channelStatus)) {
                    discrepanciesFound++;

                    Map<String, String> detail = new HashMap<>();
                    detail.put("date", channelDay.date().toString());
                    detail.put("pmsStatus", pmsStatus);
                    detail.put("channelStatus", channelStatus);
                    discrepancyDetails.add(detail);

                    // Track the range to fix
                    if (fixFrom == null || channelDay.date().isBefore(fixFrom)) {
                        fixFrom = channelDay.date();
                    }
                    if (fixTo == null || channelDay.date().isAfter(fixTo)) {
                        fixTo = channelDay.date();
                    }
                }
            }

            run.setDiscrepanciesFound(discrepanciesFound);

            // 5. Auto-fix : PMS est master, pousser vers channel
            if (discrepanciesFound > 0 && fixFrom != null && fixTo != null) {
                try {
                    SyncResult fixResult = connector.pushCalendarUpdate(
                            propertyId, fixFrom, fixTo.plusDays(1), orgId);

                    if (fixResult.getStatus() == SyncResult.Status.SUCCESS) {
                        discrepanciesFixed = discrepanciesFound;
                        log.info("[Reconciliation] {} divergences corrigees pour property={}, channel={}",
                                discrepanciesFixed, propertyId, channelName);
                    } else {
                        log.warn("[Reconciliation] Push fix echoue pour property={}, channel={}: {}",
                                propertyId, channelName, fixResult.getMessage());
                    }
                } catch (Exception e) {
                    log.warn("[Reconciliation] Erreur push fix pour property={}, channel={}: {}",
                            propertyId, channelName, e.getMessage());
                }
            }

            run.setDiscrepanciesFixed(discrepanciesFixed);

            // 6. Calculer le pourcentage de divergence
            int totalDaysChecked = Math.max(channelDays.size(), 1);
            BigDecimal divergencePct = BigDecimal.valueOf(discrepanciesFound * 100.0 / totalDaysChecked)
                    .setScale(2, RoundingMode.HALF_UP);
            run.setDivergencePct(divergencePct);

            // 7. Persister les details JSON
            if (!discrepancyDetails.isEmpty()) {
                try {
                    run.setDetails(objectMapper.writeValueAsString(discrepancyDetails));
                } catch (JsonProcessingException e) {
                    log.warn("[Reconciliation] Erreur serialisation details: {}", e.getMessage());
                }
            }

            // 8. Metriques
            if (discrepanciesFound > 0) {
                syncMetrics.incrementReconciliationDiscrepancies(discrepanciesFound);
            }
            if (discrepanciesFixed > 0) {
                syncMetrics.incrementReconciliationFixes(discrepanciesFixed);
            }

            // 9. Determiner le statut final
            String status;
            if (discrepanciesFound == 0) {
                status = "SUCCESS";
            } else if (divergencePct.doubleValue() > DIVERGENCE_ALERT_THRESHOLD) {
                status = "DIVERGENCE";
            } else {
                status = "SUCCESS";
            }

            completeRun(run, status, null);

            // 10. Alerte si divergence elevee
            if ("DIVERGENCE".equals(status)) {
                alertHighDivergence(run);
            }

            // 11. Audit trail
            auditLogService.logAction(
                    AuditAction.RECONCILIATION,
                    "PROPERTY",
                    propertyId.toString(),
                    null,
                    status,
                    String.format("channel=%s, checked=%d, discrepancies=%d, fixed=%d, divergence=%.2f%%",
                            channelName, totalDaysChecked, discrepanciesFound, discrepanciesFixed,
                            divergencePct.doubleValue()),
                    AuditSource.CRON
            );

            return run;

        } catch (Exception e) {
            log.error("[Reconciliation] Erreur reconciliation mapping {} : {}",
                    mapping.getId(), e.getMessage(), e);
            completeRun(run, "FAILED", e.getMessage());

            try {
                notificationService.notifyAdminsAndManagers(
                        NotificationKey.RECONCILIATION_FAILED,
                        "Reconciliation echouee",
                        String.format("Erreur reconciliation property %d (%s): %s",
                                propertyId, channelName, e.getMessage()),
                        "/admin/sync"
                );
            } catch (Exception ne) {
                log.warn("[Reconciliation] Erreur notification echec: {}", ne.getMessage());
            }

            return run;
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private void completeRun(ReconciliationRun run, String status, String errorMessage) {
        run.setStatus(status);
        run.setCompletedAt(LocalDateTime.now());
        if (errorMessage != null) {
            run.setErrorMessage(errorMessage);
        }
        reconciliationRunRepository.save(run);
    }

    private void alertHighDivergence(ReconciliationRun run) {
        try {
            notificationService.notifyAdminsAndManagers(
                    NotificationKey.RECONCILIATION_DIVERGENCE_HIGH,
                    "Divergence calendrier elevee detectee",
                    String.format("Property %d (%s): %.2f%% divergence (%d divergences sur %d jours verifies)",
                            run.getPropertyId(), run.getChannel(),
                            run.getDivergencePct().doubleValue(),
                            run.getDiscrepanciesFound(), run.getChannelDaysChecked()),
                    "/admin/sync"
            );
        } catch (Exception e) {
            log.warn("[Reconciliation] Erreur notification divergence elevee: {}", e.getMessage());
        }
    }

    /**
     * Normalise le statut channel vers les statuts PMS.
     * Les channels peuvent utiliser des noms differents.
     */
    private String normalizeStatus(String channelStatus) {
        if (channelStatus == null) return "AVAILABLE";
        return switch (channelStatus.toUpperCase()) {
            case "AVAILABLE", "FREE", "OPEN" -> "AVAILABLE";
            case "BOOKED", "RESERVED", "OCCUPIED" -> "BOOKED";
            case "BLOCKED", "CLOSED", "UNAVAILABLE" -> "BLOCKED";
            case "MAINTENANCE" -> "MAINTENANCE";
            default -> "AVAILABLE";
        };
    }
}
