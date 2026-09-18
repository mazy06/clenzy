package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MarketplaceRetentionHoldServiceTest {
    final MarketplaceProviderRepository providers = mock(MarketplaceProviderRepository.class);
    final MarketplaceDecisionJournal journal = mock(MarketplaceDecisionJournal.class);
    final Clock clock = Clock.fixed(Instant.parse("2026-09-16T10:00:00Z"), ZoneOffset.UTC);
    final MarketplaceRetentionHoldService service = new MarketplaceRetentionHoldService(providers, journal, clock);
    final MarketplaceProvider provider = new MarketplaceProvider();

    @Test void disputeRequiresReasonAndFutureReviewAndNeverStoresReasonInJournal() {
        when(providers.findForErasure(1L)).thenReturn(Optional.of(provider));
        assertThatThrownBy(() -> service.update(1L, " ", LocalDateTime.now(clock).plusDays(1), "manager"))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.update(1L, "Référence litige", LocalDateTime.now(clock), "manager"))
            .isInstanceOf(IllegalArgumentException.class);
        assertThat(service.update(1L, " Référence litige ", LocalDateTime.now(clock).plusDays(1), "manager").reason())
            .isEqualTo("Référence litige");
        verify(journal).record(1L, "RETENTION_HOLD", "NONE", "HELD", "manager");
    }

    @Test void overdueReviewDoesNotReleaseHoldAndExplicitReleaseClearsEveryField() {
        provider.setRetentionHoldReason("Litige"); provider.setRetentionHoldActor("manager");
        provider.setRetentionHoldReviewAt(LocalDateTime.now(clock).minusDays(1));
        when(providers.findById(1L)).thenReturn(Optional.of(provider));
        assertThat(service.view(1L).reviewOverdue()).isTrue();
        assertThat(provider.getRetentionHoldReason()).isEqualTo("Litige");
        when(providers.findForErasure(1L)).thenReturn(Optional.of(provider));
        var released = service.update(1L, null, null, "manager");
        assertThat(released.reason()).isNull(); assertThat(released.actor()).isNull(); assertThat(released.reviewAt()).isNull();
        verify(journal).record(1L, "RETENTION_HOLD", "HELD", "RELEASED", "manager");
    }
}
