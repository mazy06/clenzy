package com.clenzy.scheduler;

import com.clenzy.dto.noise.NoiseDataPointDto;
import com.clenzy.model.NoiseAlert.AlertSource;
import com.clenzy.model.NoiseAlertConfig;
import com.clenzy.model.NoiseDevice;
import com.clenzy.model.NoiseDevice.DeviceStatus;
import com.clenzy.repository.NoiseAlertConfigRepository;
import com.clenzy.repository.NoiseDeviceRepository;
import com.clenzy.service.NoiseAlertService;
import com.clenzy.service.NoiseDeviceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Tache planifiee qui verifie periodiquement les niveaux de bruit
 * des capteurs (principalement Tuya) et declenche des alertes si necessaire.
 *
 * Les capteurs Minut sont geres en temps reel via webhook → Kafka.
 * Ce scheduler couvre les capteurs sans webhooks (polling).
 */
@Service
public class NoiseAlertScheduler {

    private static final Logger log = LoggerFactory.getLogger(NoiseAlertScheduler.class);

    private final NoiseAlertConfigRepository configRepository;
    private final NoiseDeviceRepository deviceRepository;
    private final NoiseDeviceService deviceService;
    private final NoiseAlertService alertService;

    public NoiseAlertScheduler(NoiseAlertConfigRepository configRepository,
                                NoiseDeviceRepository deviceRepository,
                                NoiseDeviceService deviceService,
                                NoiseAlertService alertService) {
        this.configRepository = configRepository;
        this.deviceRepository = deviceRepository;
        this.deviceService = deviceService;
        this.alertService = alertService;
    }

    /**
     * Toutes les 5 minutes : verifie les configs actives et poll les capteurs.
     */
    @Scheduled(cron = "0 */5 * * * *")
    public void checkNoiseLevels() {
        List<NoiseAlertConfig> configs = configRepository.findAllEnabledWithTimeWindows();
        if (configs.isEmpty()) return;

        int checked = 0;
        int alerts = 0;
        int errors = 0;

        for (NoiseAlertConfig config : configs) {
            try {
                int result = processConfig(config);
                checked++;
                if (result > 0) alerts += result;
            } catch (Exception e) {
                errors++;
                log.error("Erreur verification bruit pour property={} org={}: {}",
                    config.getPropertyId(), config.getOrganizationId(), e.getMessage());
            }
        }

        if (checked > 0) {
            log.debug("NoiseAlertScheduler: {} configs verifiees, {} alertes, {} erreurs",
                checked, alerts, errors);
        }
    }

    private int processConfig(NoiseAlertConfig config) {
        List<NoiseDevice> devices = deviceRepository
            .findByPropertyIdAndStatus(config.getPropertyId(), DeviceStatus.ACTIVE);

        if (devices.isEmpty()) return 0;

        int alertCount = 0;
        String endAt = Instant.now().toString();
        String startAt = Instant.now().minusSeconds(300).toString(); // Derniere 5 min

        for (NoiseDevice device : devices) {
            try {
                List<NoiseDataPointDto> dataPoints = deviceService.getNoiseData(
                    device.getUserId(), device.getId(), startAt, endAt);

                if (dataPoints.isEmpty()) continue;

                // Evaluer le dernier point
                NoiseDataPointDto latest = dataPoints.get(dataPoints.size() - 1);
                var alert = alertService.evaluateNoiseLevel(
                    config.getOrganizationId(),
                    config.getPropertyId(),
                    device.getId(),
                    latest.getDecibels(),
                    AlertSource.SCHEDULER
                );
                if (alert != null) alertCount++;
            } catch (Exception e) {
                log.warn("Erreur lecture capteur device={}: {}", device.getId(), e.getMessage());
            }
        }
        return alertCount;
    }
}
