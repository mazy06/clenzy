package com.clenzy.service.agent.supervision;

import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.SupervisionSuggestionRepository;
import org.junit.jupiter.api.Test;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class StockSuggestionVisualTest {
    @Test void enrichesAnExistingInformationCardWithoutMakingItActionable() {
        var repository = mock(SupervisionSuggestionRepository.class);
        var clock = Clock.fixed(Instant.parse("2026-10-01T10:00:00Z"), ZoneOffset.UTC);
        var service = new SupervisionSuggestionService(repository, null, null, null, null, null, clock,
                mock(org.springframework.transaction.PlatformTransactionManager.class));
        var card = new SupervisionSuggestion(3L, 7L, "ops", "stock_low", "Stock bas : Café (1 restant)", "Motif", clock.instant().plusSeconds(3600));
        when(repository.existsByOrganizationIdAndPropertyIdAndModuleKeyAndTitleAndStatusAndExpiresAtAfter(
                eq(3L), eq(7L), eq("ops"), eq(card.getTitle()), eq("PENDING"), any())).thenReturn(true);
        when(repository.findFirstByOrganizationIdAndPropertyIdAndModuleKeyAndTitleAndStatusAndExpiresAtAfter(
                eq(3L), eq(7L), eq("ops"), eq(card.getTitle()), eq("PENDING"), any())).thenReturn(Optional.of(card));
        service.recordStockAlert(3L, 7L, card.getTitle(), card.getMotif(), 12L);
        assertThat(card.getActionParams()).isEqualTo("{\"stockItemId\":12}");
        assertThat(card.getActionType()).isNull();
        verify(repository).save(card);
        service.recordStockAlert(3L, 7L, card.getTitle(), card.getMotif(), 12L);
        verify(repository, times(1)).save(card);
    }
}
