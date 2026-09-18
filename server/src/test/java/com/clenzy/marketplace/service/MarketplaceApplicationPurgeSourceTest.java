package com.clenzy.marketplace.service;

import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Retention des candidatures closes.
 *
 * <p>Une purge est irreversible : ces tests portent surtout sur ce qu'elle ne
 * doit PAS faire, et sur l'ordre des deux suppressions.</p>
 */
@ExtendWith(MockitoExtension.class)
class MarketplaceApplicationPurgeSourceTest {

    @Mock private MarketplaceProviderRepository providerRepository;
    @Mock private MarketplaceApplicationEraser eraser;

    private MarketplaceApplicationPurgeSource source;

    private static final Instant CUTOFF = Instant.parse("2026-03-13T00:00:00Z");
    private static final LocalDateTime CUTOFF_LOCAL =
        LocalDateTime.ofInstant(CUTOFF, ZoneOffset.UTC);

    @BeforeEach
    void setUp() {
        source = new MarketplaceApplicationPurgeSource(
            providerRepository, eraser, ZoneOffset.UTC);
    }

    @Test
    void theTargetNameMatchesTheConfiguredOne() {
        // Le moteur relie source et cible par ce nom : s'en ecarter rend la
        // source invisible, sans erreur.
        assertThat(source.targetName()).isEqualTo("marketplace-applications");
    }

    @Test
    void countingNeverDeletesAnything() {
        when(providerRepository.countPurgeableApplications(CUTOFF_LOCAL)).thenReturn(12L);

        assertThat(source.countExpired(CUTOFF)).isEqualTo(12L);

        verifyNoInteractions(eraser);
    }

    @Test
    void whenNothingIsExpired_thenTheEngineIsToldToStop() {
        when(providerRepository.findPurgeableApplicationIds(any(), any())).thenReturn(List.of());
        when(eraser.eraseExpired(List.of(), CUTOFF_LOCAL)).thenReturn(0);

        assertThat(source.deleteExpiredBatch(CUTOFF, 500)).isZero();
    }

    @Test
    void theBatchIsBoundedByTheLimit() {
        // Une suppression non bornee tiendrait des verrous sur toute la table.
        when(providerRepository.findPurgeableApplicationIds(any(), any())).thenReturn(List.of(1L, 2L));

        source.deleteExpiredBatch(CUTOFF, 50);

        var pageable = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(providerRepository).findPurgeableApplicationIds(eq(CUTOFF_LOCAL), pageable.capture());
        assertThat(pageable.getValue()).isEqualTo(PageRequest.of(0, 50));
    }

    @Test
    void whenTheLimitIsZero_thenNothingIsEvenLookedUp() {
        assertThat(source.deleteExpiredBatch(CUTOFF, 0)).isZero();

        verifyNoInteractions(providerRepository, eraser);
    }

    @Test
    void theErasureIsDelegatedRatherThanReimplemented() {
        // La retention et la demande d'effacement doivent supprimer exactement
        // pareil : deux copies de l'ordre « octets puis lignes » finiraient par
        // diverger, et la divergence se paierait en pieces laissees en place.
        when(providerRepository.findPurgeableApplicationIds(any(), any())).thenReturn(List.of(7L, 8L));
        when(eraser.eraseExpired(List.of(7L, 8L), CUTOFF_LOCAL)).thenReturn(2);

        assertThat(source.deleteExpiredBatch(CUTOFF, 500)).isEqualTo(2);

        verify(eraser).eraseExpired(List.of(7L, 8L), CUTOFF_LOCAL);
    }

}
