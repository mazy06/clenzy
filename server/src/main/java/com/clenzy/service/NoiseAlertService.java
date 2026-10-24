package com.clenzy.service;

import com.clenzy.dto.noise.NoiseAlertDto;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.NoiseAlert;
import com.clenzy.model.NoiseAlert.AlertSeverity;
import com.clenzy.model.NoiseAlert.AlertSource;
import com.clenzy.model.NoiseAlertConfig;
import com.clenzy.model.NoiseAlertTimeWindow;
import com.clenzy.repository.NoiseAlertRepository;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class NoiseAlertService {

    private static final Logger log = LoggerFactory.getLogger(NoiseAlertService.class);

    private final BaitlyNoiseAlertAdmission admission;
    private final NoiseAlertRepository alertRepository;
    private final NoiseAlertNotificationService notificationService;
    private final AutomationEngine automationEngine;

    public NoiseAlertService(BaitlyNoiseAlertAdmission admission,
                             NoiseAlertRepository alertRepository,
                             NoiseAlertNotificationService notificationService,
                             AutomationEngine automationEngine,
                             org.springframework.transaction.PlatformTransactionManager transactionManager) {
        this.admission = admission;
        this.alertRepository = alertRepository;
        this.notificationService = notificationService;
        this.automationEngine = automationEngine;

    }

    /**
     * Evalue un niveau de bruit et cree une alerte si un seuil est depasse.
     *
     * @return l'alerte creee, ou null si aucun depassement ou cooldown actif
     */
    @Transactional(timeout = 10)
    public NoiseAlert evaluateNoiseLevel(Long orgId, Long propertyId, Long deviceId,
                                          double measuredDb, AlertSource source) {
        if (!Double.isFinite(measuredDb) || measuredDb <= 0) return null;
        var decision=admission.admit(orgId,propertyId,measuredDb);
        if(decision.isEmpty()) return null;
        var admitted=decision.orElseThrow();
        AlertSeverity severity=admitted.severity();
        int thresholdDb=admitted.threshold();
        NoiseAlertConfig config=new NoiseAlertConfig();
        config.setId(admitted.config());
        config.setOrganizationId(orgId);
        config.setPropertyId(propertyId);

        // Creer l'alerte
        NoiseAlert alert = new NoiseAlert();
        alert.setOrganizationId(orgId);
        alert.setPropertyId(propertyId);
        alert.setDeviceId(deviceId);
        alert.setSeverity(severity);
        alert.setMeasuredDb(measuredDb);
        alert.setThresholdDb(thresholdDb);
        alert.setTimeWindowLabel(admitted.label());
        alert.setSource(source);
        alert = alertRepository.save(alert);

        log.warn("Baitly bruit : alerte {} creee, severite {}", alert.getId(), severity);

        // Baitly: the queue must commit atomically with the alert. Never swallow enqueue failure.
        notificationService.dispatch(alert, config);

        // Moteur AutomationRule (fiche 08) : trigger NOISE_ALERT — F6a message
        // voyageur (SEND_NOISE_WARNING), F6b escalade (NOTIFY_STAFF /
        // CREATE_MAINTENANCE_INTERVENTION selon les regles de l'org).
        fireNoiseAlertTrigger(alert);

        return alert;
    }

    /**
     * Enregistre NOISE_ALERT dans la file du moteur, dans la transaction courante.
     * Seul le drain voit les lignes commitées et peut appeler les exécuteurs.
     *
     * <p>La file du moteur rejoint la transaction de création ; aucun effet externe ici.</p>
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
            alertRepository.countByOrganizationIdAndPropertyIdAndCreatedAtAfter(
                alert.getOrganizationId(),alert.getPropertyId(), LocalDateTime.now().minusHours(24)));

        Long orgId = alert.getOrganizationId();
        Long alertId = alert.getId();
        automationEngine.fireTrigger(AutomationTrigger.NOISE_ALERT, orgId,
            new AutomationSubject(AutomationSubject.TYPE_NOISE_ALERT, alertId, data));
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

        log.info("Baitly bruit : alerte {} acquittee", alertId);
        return NoiseAlertDto.from(alert);
    }

    // ─── Helpers internes ──────────────────────────────────────────────────────

    static NoiseAlertTimeWindow findMatchingWindow(List<NoiseAlertTimeWindow> windows, LocalTime time) {
        return windows.stream()
            .filter(tw -> tw.contains(time))
            .findFirst()
            .orElse(null);
    }

    static AlertSeverity determineSeverity(double measuredDb, NoiseAlertTimeWindow window) {
        if (measuredDb >= window.getCriticalThresholdDb()) {
            return AlertSeverity.CRITICAL;
        }
        if (measuredDb >= window.getWarningThresholdDb()) {
            return AlertSeverity.WARNING;
        }
        return null;
    }

}
