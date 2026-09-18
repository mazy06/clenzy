package com.clenzy.marketplace.service;

import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.model.ProviderDocument;
import com.clenzy.repository.ProviderDocumentRepository;
import com.clenzy.service.PhotoStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Effacement d'une candidature.
 *
 * <p>Un effacement est irreversible : ce qui compte ici est l'ORDRE des deux
 * suppressions, et la conservation des références après une panne du stockage.</p>
 */
@ExtendWith(MockitoExtension.class)
class MarketplaceApplicationEraserTest {

    @Mock private MarketplaceProviderRepository providerRepository;
    @Mock private ProviderDocumentRepository documentRepository;
    @Mock private PhotoStorageService storageService;

    private MarketplaceApplicationEraser eraser;

    @BeforeEach
    void setUp() {
        lenient().when(providerRepository.findForErasure(any())).thenAnswer(call -> {
            var provider = new com.clenzy.marketplace.model.MarketplaceProvider(); provider.setId(call.getArgument(0));
            return java.util.Optional.of(provider);
        });
        eraser = new MarketplaceApplicationEraser(
            providerRepository, documentRepository, storageService);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"account", "active", "suspended"})
    void aChangedApplicationIsProtectedBeforeAnyBinaryIsDeleted(String state) {
        var provider = new com.clenzy.marketplace.model.MarketplaceProvider(); provider.setId(8L);
        if (state.equals("account")) provider.setUserId(99L);
        if (state.equals("active")) provider.setStatus(com.clenzy.marketplace.model.ProviderStatus.ACTIVE);
        if (state.equals("suspended")) provider.setStatus(com.clenzy.marketplace.model.ProviderStatus.SUSPENDED);
        when(providerRepository.findForErasure(8L)).thenReturn(java.util.Optional.of(provider));
        assertThatThrownBy(() -> eraser.erase(List.of(7L, 8L))).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(storageService, documentRepository);
        verify(providerRepository, never()).deleteAllByIdInBatch(any());
    }

    @Test void repeatedIdsAndAlreadyDeletedApplicationsAreIdempotent() {
        when(providerRepository.findForErasure(8L)).thenReturn(java.util.Optional.empty());
        assertThat(eraser.erase(List.of(8L, 7L, 7L))).isEqualTo(1);
        verify(providerRepository).findForErasure(7L);
        verify(providerRepository).deleteAllByIdInBatch(List.of(7L));
    }

    @Test
    void theBinariesGoBeforeTheRows() {
        // L'ordre inverse laisserait des pieces d'identite dans le stockage,
        // sans plus rien pour les retrouver ni les reclamer.
        when(documentRepository.findByMarketplaceProviderIdOrderByCreatedAtDesc(7L))
            .thenReturn(List.of(document("platform/marketplace-applications/abc")));

        assertThat(eraser.erase(List.of(7L))).isEqualTo(1);

        InOrder order = inOrder(storageService, providerRepository);
        order.verify(storageService).delete("platform/marketplace-applications/abc");
        order.verify(providerRepository).deleteAllByIdInBatch(List.of(7L));
    }

    @Test
    void storageFailurePreservesReferencesForRetry() {
        when(documentRepository.findByMarketplaceProviderIdOrderByCreatedAtDesc(7L))
            .thenReturn(List.of(document("platform/marketplace-applications/disparu")));
        doThrow(new RuntimeException("stockage indisponible")).when(storageService).delete(any());

        assertThatThrownBy(() -> eraser.erase(List.of(7L)))
            .isInstanceOf(RuntimeException.class).hasMessage("stockage indisponible");
        verify(providerRepository, never()).deleteAllByIdInBatch(any());
    }

    @Test
    void whenThereIsNothingToErase_thenNothingIsTouched() {
        assertThat(eraser.erase(List.of())).isZero();
        assertThat(eraser.erase(null)).isZero();

        verifyNoInteractions(providerRepository, documentRepository, storageService);
    }

    @Test
    void everyApplicationInTheBatchLosesItsBinaries() {
        when(documentRepository.findByMarketplaceProviderIdOrderByCreatedAtDesc(7L))
            .thenReturn(List.of(document("platform/marketplace-applications/a")));
        when(documentRepository.findByMarketplaceProviderIdOrderByCreatedAtDesc(8L))
            .thenReturn(List.of(document("platform/marketplace-applications/b")));

        assertThat(eraser.erase(List.of(7L, 8L))).isEqualTo(2);

        verify(storageService).delete("platform/marketplace-applications/a");
        verify(storageService).delete("platform/marketplace-applications/b");
        verify(providerRepository).deleteAllByIdInBatch(List.of(7L, 8L));
    }

    private static ProviderDocument document(String storageKey) {
        var document = new ProviderDocument();
        document.setStorageKey(storageKey);
        return document;
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"reopened", "recent", "not-notified", "hold", "account"})
    void retentionRechecksEligibilityUnderLock(String change) {
        var cutoff = java.time.LocalDateTime.of(2026, 6, 1, 0, 0);
        var provider = new com.clenzy.marketplace.model.MarketplaceProvider();
        provider.setId(7L);
        provider.setStatus(com.clenzy.marketplace.model.ProviderStatus.REJECTED);
        provider.setDecisionSentAt(cutoff.minusDays(1));
        switch (change) {
            case "reopened" -> provider.setStatus(com.clenzy.marketplace.model.ProviderStatus.PENDING_REVIEW);
            case "recent" -> provider.setDecisionSentAt(cutoff.plusSeconds(1));
            case "not-notified" -> provider.setDecisionSentAt(null);
            case "hold" -> provider.setRetentionHoldReason("Litige ouvert");
            case "account" -> provider.setUserId(42L);
        }
        when(providerRepository.findForErasure(7L)).thenReturn(java.util.Optional.of(provider));
        assertThat(eraser.eraseExpired(List.of(7L), cutoff)).isZero();
        verifyNoInteractions(storageService, documentRepository);
        verify(providerRepository, never()).deleteAllByIdInBatch(any());
    }

    @Test void expirationIncludesTheExactCutoffAndRemovesDocuments() {
        var cutoff = java.time.LocalDateTime.of(2026, 6, 1, 0, 0);
        var provider = new com.clenzy.marketplace.model.MarketplaceProvider();
        provider.setId(7L); provider.setStatus(com.clenzy.marketplace.model.ProviderStatus.REJECTED);
        provider.setDecisionSentAt(cutoff);
        when(providerRepository.findForErasure(7L)).thenReturn(java.util.Optional.of(provider));
        when(documentRepository.findByMarketplaceProviderIdOrderByCreatedAtDesc(7L)).thenReturn(List.of(document("proof")));
        assertThat(eraser.eraseExpired(List.of(7L), cutoff)).isEqualTo(1);
        verify(storageService).delete("proof");
        verify(providerRepository).deleteAllByIdInBatch(List.of(7L));
    }

    @Test void manualErasureCannotBypassADisputeHold() {
        var provider = new com.clenzy.marketplace.model.MarketplaceProvider();
        provider.setRetentionHoldReason("Contestation en cours");
        when(providerRepository.findForErasure(7L)).thenReturn(java.util.Optional.of(provider));
        assertThatThrownBy(() -> eraser.erase(List.of(7L))).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(storageService, documentRepository);
    }
}
