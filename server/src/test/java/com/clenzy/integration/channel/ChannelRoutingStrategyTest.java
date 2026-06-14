package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Routage direct vs Channex (CLZ Domaine 1 / CM natif) : direct prioritaire, anti double-push.
 */
class ChannelRoutingStrategyTest {

    private final ChannelMappingRepository channelMappingRepository = mock(ChannelMappingRepository.class);
    private final ChannexPropertyMappingRepository channexRepository = mock(ChannexPropertyMappingRepository.class);
    private final ChannelRoutingStrategy strategy =
        new ChannelRoutingStrategy(channelMappingRepository, channexRepository);

    @Test
    void decide_directPrioritaire() {
        assertThat(ChannelRoutingStrategy.decide(true, true)).isEqualTo(ChannelRoute.DIRECT);
        assertThat(ChannelRoutingStrategy.decide(true, false)).isEqualTo(ChannelRoute.DIRECT);
        assertThat(ChannelRoutingStrategy.decide(false, true)).isEqualTo(ChannelRoute.CHANNEX);
        assertThat(ChannelRoutingStrategy.decide(false, false)).isEqualTo(ChannelRoute.NONE);
    }

    @Test
    void resolve_directMappingWins_evenIfChannexExists() {
        when(channelMappingRepository.findActiveByPropertyId(eq(100L), eq(42L)))
            .thenReturn(List.of(new ChannelMapping()));
        ChannexPropertyMapping cm = new ChannexPropertyMapping();
        cm.setSyncStatus(ChannexSyncStatus.ACTIVE);
        when(channexRepository.findByClenzyPropertyId(eq(100L), eq(42L))).thenReturn(Optional.of(cm));

        assertThat(strategy.resolve(100L, 42L)).isEqualTo(ChannelRoute.DIRECT);
    }

    @Test
    void resolve_channexFallbackWhenNoDirect() {
        when(channelMappingRepository.findActiveByPropertyId(eq(100L), eq(42L))).thenReturn(List.of());
        ChannexPropertyMapping cm = new ChannexPropertyMapping();
        cm.setSyncStatus(ChannexSyncStatus.ACTIVE);
        when(channexRepository.findByClenzyPropertyId(eq(100L), eq(42L))).thenReturn(Optional.of(cm));

        assertThat(strategy.resolve(100L, 42L)).isEqualTo(ChannelRoute.CHANNEX);
    }

    @Test
    void resolve_disabledChannexIsNotFallback() {
        when(channelMappingRepository.findActiveByPropertyId(eq(100L), eq(42L))).thenReturn(List.of());
        ChannexPropertyMapping cm = new ChannexPropertyMapping();
        cm.setSyncStatus(ChannexSyncStatus.DISABLED);
        when(channexRepository.findByClenzyPropertyId(eq(100L), eq(42L))).thenReturn(Optional.of(cm));

        assertThat(strategy.resolve(100L, 42L)).isEqualTo(ChannelRoute.NONE);
    }

    @Test
    void resolve_noneWhenNoMapping() {
        when(channelMappingRepository.findActiveByPropertyId(eq(100L), eq(42L))).thenReturn(List.of());
        when(channexRepository.findByClenzyPropertyId(eq(100L), eq(42L))).thenReturn(Optional.empty());

        assertThat(strategy.resolve(100L, 42L)).isEqualTo(ChannelRoute.NONE);
    }
}
