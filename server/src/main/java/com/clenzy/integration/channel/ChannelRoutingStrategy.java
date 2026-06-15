package com.clenzy.integration.channel;

import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import org.springframework.stereotype.Component;

/**
 * Décide la voie de synchronisation d'une propriété (CLZ Domaine 1 / CM natif) : <b>direct
 * prioritaire</b>, Channex en repli. Garantit qu'une propriété n'est synchronisée que par une
 * seule voie (anti double-push : les consumers {@code ChannelSyncService} et
 * {@code ChannexSyncService} écoutent le même topic Kafka).</p>
 *
 * <p>Règle : un mapping direct actif l'emporte sur Channex ; sans direct, Channex sert de repli.
 * (Une préférence par pays — ex. Channex pour certaines régions MENA — est un raffinement
 * ultérieur, non requis pour le routage natif/anti-double-push.)</p>
 */
@Component
public class ChannelRoutingStrategy {

    private final ChannelMappingRepository channelMappingRepository;
    private final ChannexPropertyMappingRepository channexPropertyMappingRepository;

    public ChannelRoutingStrategy(ChannelMappingRepository channelMappingRepository,
                                  ChannexPropertyMappingRepository channexPropertyMappingRepository) {
        this.channelMappingRepository = channelMappingRepository;
        this.channexPropertyMappingRepository = channexPropertyMappingRepository;
    }

    /** Décision pure : direct prioritaire, Channex en repli. */
    public static ChannelRoute decide(boolean hasDirect, boolean hasChannex) {
        if (hasDirect) return ChannelRoute.DIRECT;
        if (hasChannex) return ChannelRoute.CHANNEX;
        return ChannelRoute.NONE;
    }

    public ChannelRoute resolve(Long propertyId, Long orgId) {
        boolean hasDirect = !channelMappingRepository.findActiveByPropertyId(propertyId, orgId).isEmpty();
        boolean hasChannex = channexPropertyMappingRepository.findByClenzyPropertyId(propertyId, orgId)
            .map(m -> m.getSyncStatus() != ChannexSyncStatus.DISABLED)
            .orElse(false);
        return decide(hasDirect, hasChannex);
    }
}
