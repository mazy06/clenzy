package com.clenzy.service;

import com.clenzy.dto.noise.NoiseAlertDto;
import com.clenzy.model.NoiseAlert;
import com.clenzy.model.NoiseAlert.AlertSeverity;
import com.clenzy.model.NoiseAlert.AlertSource;
import com.clenzy.model.NoiseAlertConfig;
import com.clenzy.model.NoiseAlertTimeWindow;
import com.clenzy.repository.NoiseAlertConfigRepository;
import com.clenzy.repository.NoiseAlertRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Service
@Transactional
public class NoiseAlertService {

    private static final Logger log = LoggerFactory.getLogger(NoiseAlertService.class);

    private final NoiseAlertConfigRepository configRepository;
    private final NoiseAlertRepository alertRepository;
    private final NoiseAlertNotificationService notificationService;

    public NoiseAlertService(NoiseAlertConfigRepository configRepository,
                             NoiseAlertRepository alertRepository,
                             NoiseAlertNotificationService notificationService) {
        this.configRepository = configRepository;
        this.alertRepository = alertRepository;
        this.notificationService = notificationService;
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

        return alert;
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
