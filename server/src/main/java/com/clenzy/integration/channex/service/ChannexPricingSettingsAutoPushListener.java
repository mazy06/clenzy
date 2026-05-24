package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.event.ChannexPricingSettingsChangedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Listener @Async qui declenche un {@code pushPricingSettings} vers Channex
 * quand un {@link ChannexPricingSettingsChangedEvent} est publie — Phase 5
 * audit O3 (hooks push auto).
 *
 * <p><b>Asynchrone</b> : le push HTTP vers Channex ne doit pas bloquer la
 * transaction Clenzy qui a modifie la donnee. {@code @Async} delegue a un
 * thread pool Spring (require {@code @EnableAsync} dans la config — verifie).</p>
 *
 * <p><b>Best-effort</b> : un echec du push (Channex down, API key absente,
 * property en mode OTA) est log warn mais ne propage jamais d'exception.</p>
 */
@Component
public class ChannexPricingSettingsAutoPushListener {

    private static final Logger log = LoggerFactory.getLogger(
        ChannexPricingSettingsAutoPushListener.class);

    private final ChannexSyncService syncService;
    private final com.clenzy.integration.channex.config.ChannexProperties channexProperties;

    public ChannexPricingSettingsAutoPushListener(ChannexSyncService syncService,
                                                    com.clenzy.integration.channex.config.ChannexProperties channexProperties) {
        this.syncService = syncService;
        this.channexProperties = channexProperties;
    }

    @Async
    @EventListener
    public void onPricingSettingsChanged(ChannexPricingSettingsChangedEvent event) {
        if (event == null || event.clenzyPropertyId() == null || event.organizationId() == null) {
            log.warn("ChannexAutoPush: event invalide (property ou org null), skip");
            return;
        }
        if (!channexProperties.isConfigured()) {
            log.debug("ChannexAutoPush: skip property={} (CHANNEX_API_KEY non configuree)",
                event.clenzyPropertyId());
            return;
        }
        try {
            log.info("ChannexAutoPush: push pricing settings property={} (source={})",
                event.clenzyPropertyId(), event.source());
            ChannexSyncService.ChannexSyncResult result = syncService.pushPricingSettings(
                event.clenzyPropertyId(), event.organizationId());
            if (!result.success()) {
                log.warn("ChannexAutoPush: push KO property={} source={}: {}",
                    event.clenzyPropertyId(), event.source(), result.message());
            }
        } catch (Exception e) {
            // Best-effort : un echec ne doit pas remonter (ce serait async-noise).
            log.error("ChannexAutoPush: erreur inattendue property={} source={}: {}",
                event.clenzyPropertyId(), event.source(), e.getMessage());
        }
    }
}
