package com.clenzy.service;

import com.clenzy.dto.noise.NoiseAlertDto;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.NoiseAlert;
import com.clenzy.model.NoiseAlert.AlertSeverity;
import com.clenzy.model.NoiseAlert.AlertSource;
import com.clenzy.model.NoiseAlertConfig;
import com.clenzy.model.NoiseAlertTimeWindow;
import com.clenzy.repository.NoiseAlertConfigRepository;
import com.clenzy.repository.NoiseAlertRepository;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class NoiseAlertService {

    private static final Logger log = LoggerFactory.getLogger(NoiseAlertService.class);

    private final NoiseAlertConfigRepository configRepository;
    private final NoiseAlertRepository alertRepository;
    private final NoiseAlertNotificationService notificationService;
    private final AutomationEngine automationEngine;
    private final org.springframework.transaction.support.TransactionTemplate requiresNewTx;

    public NoiseAlertService(NoiseAlertConfigRepository configRepository,
                             NoiseAlertRepository alertRepository,
                             NoiseAlertNotificationService notificationService,
                             AutomationEngine automationEngine,
                             org.springframework.transaction.PlatformTransactionManager transactionManager) {
        this.configRepository = configRepository;
        this.alertRepository = alertRepository;
        this.notificationService = notificationService;
        this.automationEngine = automationEngine;
        // REQUIRES_NEW : le fireTrigger post-commit doit avoir SA transaction
        // (cf. commentaire dans fireAutomationTrigger).
        this.requiresNewTx = new org.springframework.transaction.support.TransactionTemplate(transactionManager);
        this.requiresNewTx.setPropagationBehavior(
                org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * Evalue un niveau de bruit et cree une alerte si un seuil est depasse.
     *
     * @return l'alerte creee, ou null si aucun depassement ou cooldown actif
     */
    public NoiseAlert evaluateNoiseLevel(Long orgId, Long propertyId, Long deviceId,
                                          double measuredDb, AlertSource source) {
        NoiseAlertConfig config = configRepository
            .findByOrgAndPropertyWithTimeWindows(orgId, propertyId)
            .orElse(null);

        if (config == null || !config.isEnabled()) {
            return null;
        }

        LocalTime now = LocalTime.now();
        NoiseAlertTimeWindow matchingWindow = findMatchingWindow(config.getTimeWindows(), now);
        if (matchingWindow == null) {
            log.debug("Aucun creneau horaire actif pour property {} a {}", propertyId, now);
            return null;
        }

        // Determiner la severite
        AlertSeverity severity = determineSeverity(measuredDb, matchingWindow);
        if (severity == null) {
            return null; // Sous le seuil warning
        }

        int thresholdDb = severity == AlertSeverity.CRITICAL
            ? matchingWindow.getCriticalThresholdDb()
            : matchingWindow.getWarningThresholdDb();

        // Verifier le cooldown
        if (isCooldownActive(propertyId, severity, config.getCooldownMinutes())) {
            log.debug("Cooldown actif pour property {} severity {}", propertyId, severity);
            return null;
        }

        // Creer l'alerte
        NoiseAlert alert = new NoiseAlert();
        alert.setOrganizationId(orgId);
        alert.setPropertyId(propertyId);
        alert.setDeviceId(deviceId);
        alert.setSeverity(severity);
        alert.setMeasuredDb(measuredDb);
        alert.setThresholdDb(thresholdDb);
        alert.setTimeWindowLabel(matchingWindow.getLabel());
        alert.setSource(source);
        alert = alertRepository.save(alert);

        log.warn("Alerte bruit {} creee : property={}, device={}, {}dB > {}dB ({})",
            severity, propertyId, deviceId, measuredDb, thresholdDb, matchingWindow.getLabel());

        // Dispatcher les notifications (en best-effort)
        try {
            notificationService.dispatch(alert, config);
        } catch (Exception e) {
            log.error("Erreur dispatch notifications pour alerte {}: {}", alert.getId(), e.getMessage());
        }

        // Moteur AutomationRule (fiche 08) : trigger NOISE_ALERT — F6a message
        // voyageur (SEND_NOISE_WARNING), F6b escalade (NOTIFY_STAFF /
        // CREATE_MAINTENANCE_INTERVENTION selon les regles de l'org).
        fireNoiseAlertTrigger(alert);

        return alert;
    }

    /**
     * Tire le trigger NOISE_ALERT vers le moteur d'automatisation, APRES commit
     * de la transaction courante (les executeurs font des envois externes —
     * jamais d'appel HTTP dans une transaction DB ; et l'alerte doit etre
     * visible en base quand l'executeur la recharge).
     *
     * <p>Best-effort assume (deviation justifiee a la regle « pas de catch
     * avaleur ») : l'alerte et ses notifications directes existent deja — un
     * rate du fan-out moteur est logue en erreur mais n'annule pas l'alerte.</p>
     */
    private void fireNoiseAlertTrigger(NoiseAlert alert) {
        // Pas de valeur null dans data : le contexte moteur copie la map via Map.copyOf.
        Map<String, Object> data = new HashMap<>();
        data.put(AutomationSubject.DATA_PROPERTY_ID, alert.getPropertyId());
        if (alert.getSeverity() != null) {
            data.put(AutomationSubject.DATA_SEVERITY, alert.getSeverity().name());
        }
        data.put(AutomationSubject.DATA_MEASURED_DB, alert.getMeasuredDb());
        data.put(AutomationSubject.DATA_THRESHOLD_DB, alert.getThresholdDb());
        // Compteur d'escalade F6b : alertes (toutes severites) sur 24 h glissantes,
        // exploitable par les conditions JSON des regles NOISE_ALERT.
        data.put(AutomationSubject.DATA_ALERTS_LAST_24H,
            alertRepository.countByPropertyIdAndCreatedAtAfter(
                alert.getPropertyId(), LocalDateTime.now().minusHours(24)));

        Long orgId = alert.getOrganizationId();
        Long alertId = alert.getId();
        Runnable fire = () -> {
            try {
                // BUG REEL revele par ScenarioNoiseIncidentIT (vague T2, 2026-07) :
                // dans un callback afterCommit, la transaction d'origine est deja
                // commitee mais reste liee au thread. Un @Transactional REQUIRED
                // (AutomationEvaluationService.fireTrigger) REJOINT cette transaction
                // morte : ses ecritures (automation_execution, notified_guest,
                // suggestions) etaient flushees mais JAMAIS commitees — effets
                // externes partis (email guest), zero trace en base. REQUIRES_NEW
                // force une transaction reelle pour les effets DB du moteur
                // (pattern documente Spring : le travail post-commit doit ouvrir
                // sa propre transaction).
                requiresNewTx.executeWithoutResult(tx ->
                    automationEngine.fireTrigger(AutomationTrigger.NOISE_ALERT, orgId,
                        new AutomationSubject(AutomationSubject.TYPE_NOISE_ALERT, alertId, data)));
            } catch (Exception e) {
                log.error("Erreur fireTrigger NOISE_ALERT pour alerte {}: {}", alertId, e.getMessage());
            }
        };

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    fire.run();
                }
            });
        } else {
            fire.run();
        }
    }

    // ─── Lecture historique ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<NoiseAlertDto> getAlerts(Long orgId, Long propertyId,
                                          String severity, Pageable pageable) {
        Page<NoiseAlert> page;

        if (propertyId != null && severity != null) {
            AlertSeverity sev = AlertSeverity.valueOf(severity);
            page = alertRepository.findByOrganizationIdAndPropertyIdAndSeverity(orgId, propertyId, sev, pageable);
        } else if (propertyId != null) {
            page = alertRepository.findByOrganizationIdAndPropertyId(orgId, propertyId, pageable);
        } else if (severity != null) {
            AlertSeverity sev = AlertSeverity.valueOf(severity);
            page = alertRepository.findByOrganizationIdAndSeverity(orgId, sev, pageable);
        } else {
            page = alertRepository.findByOrganizationId(orgId, pageable);
        }

        return page.map(NoiseAlertDto::from);
    }

    @Transactional(readOnly = true)
    public long getUnacknowledgedCount(Long orgId) {
        return alertRepository.countByOrganizationIdAndAcknowledgedFalse(orgId);
    }

    public NoiseAlertDto acknowledge(Long alertId, Long orgId, String acknowledgedBy, String notes) {
        NoiseAlert alert = alertRepository.findById(alertId)
            .filter(a -> a.getOrganizationId().equals(orgId))
            .orElseThrow(() -> new IllegalArgumentException("Alerte introuvable: " + alertId));

        alert.setAcknowledged(true);
        alert.setAcknowledgedBy(acknowledgedBy);
        alert.setAcknowledgedAt(LocalDateTime.now());
        alert.setNotes(notes);
        alert = alertRepository.save(alert);

        log.info("Alerte {} acquittee par {}", alertId, acknowledgedBy);
        return NoiseAlertDto.from(alert);
    }

    // ─── Helpers internes ──────────────────────────────────────────────────────

    NoiseAlertTimeWindow findMatchingWindow(List<NoiseAlertTimeWindow> windows, LocalTime time) {
        return windows.stream()
            .filter(tw -> tw.contains(time))
            .findFirst()
            .orElse(null);
    }

    AlertSeverity determineSeverity(double measuredDb, NoiseAlertTimeWindow window) {
        if (measuredDb >= window.getCriticalThresholdDb()) {
            return AlertSeverity.CRITICAL;
        }
        if (measuredDb >= window.getWarningThresholdDb()) {
            return AlertSeverity.WARNING;
        }
        return null;
    }

    boolean isCooldownActive(Long propertyId, AlertSeverity severity, int cooldownMinutes) {
        LocalDateTime since = LocalDateTime.now().minusMinutes(cooldownMinutes);
        return alertRepository.existsRecentAlert(propertyId, severity, since);
    }
}
