package com.clenzy.scheduler;

import com.clenzy.service.EnvironmentSensorService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Poll periodique des capteurs fumee / mouvement (Tuya) pour declencher les
 * alertes hors interaction utilisateur. Les autres types (temp/humidite, contact)
 * sont rafraichis a la demande via le hub. Meme principe que {@link NoiseAlertScheduler}
 * (polling des capteurs sans webhook).
 */
@Service
public class EnvironmentSensorScheduler {

    private static final Logger log = LoggerFactory.getLogger(EnvironmentSensorScheduler.class);

    private final EnvironmentSensorService sensorService;

    public EnvironmentSensorScheduler(EnvironmentSensorService sensorService) {
        this.sensorService = sensorService;
    }

    /** Toutes les 3 minutes : poll fumee/mouvement + alertes. */
    @Scheduled(cron = "0 */3 * * * *")
    public void pollSensors() {
        try {
            int processed = sensorService.pollAndAlert();
            if (processed > 0) {
                log.debug("EnvironmentSensorScheduler: {} capteurs fumee/mouvement verifies", processed);
            }
        } catch (Exception e) {
            log.error("Erreur poll capteurs d'environnement: {}", e.getMessage());
        }
    }
}
