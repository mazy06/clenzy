package com.clenzy.scheduler;

import com.clenzy.service.PlatformAiConfigService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Vérifie CHAQUE JOUR la disponibilité des modèles IA configurés (probe proactif)
 * et notifie les admins plateforme AVANT que les utilisateurs ne tombent sur un
 * modèle retiré chez son provider (404/410). Délègue à
 * {@link PlatformAiConfigService#recheckAllAvailability()}.
 *
 * <p>NB multi-instance : plusieurs serveurs lanceraient le probe en parallèle
 * (redondant mais sans danger ; la notif est dédupliquée par transition de statut
 * persistée). Un verrou/CAS pourra être ajouté si le besoin se présente.</p>
 */
@Component
public class AiModelAvailabilityScheduler {

    private static final Logger log = LoggerFactory.getLogger(AiModelAvailabilityScheduler.class);

    private final PlatformAiConfigService configService;
    private final boolean enabled;

    public AiModelAvailabilityScheduler(
            PlatformAiConfigService configService,
            @Value("${clenzy.ai.availability-check.enabled:true}") boolean enabled) {
        this.configService = configService;
        this.enabled = enabled;
    }

    /** Quotidien, 6h UTC. */
    @Scheduled(cron = "0 0 6 * * *")
    public void runDaily() {
        if (!enabled) {
            log.debug("AI model availability check disabled (clenzy.ai.availability-check.enabled=false)");
            return;
        }
        try {
            configService.recheckAllAvailability();
        } catch (Exception e) {
            log.error("AI model availability scheduled check failed: {}", e.getMessage(), e);
        }
    }
}
