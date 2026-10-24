package com.clenzy.integration.homeaway.service;

import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import com.clenzy.service.AuditLogService;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Aucun audit de succès ni appel fournisseur pour les chemins non implémentés. */
class HomeAwaySyncServiceTest {
    @ParameterizedTest @ValueSource(strings={"created", "updated", "cancelled", "availability"})
    void incompleteHandlerFailsWithoutSideEffects(String action) {
        var repository = mock(HomeAwayConnectionRepository.class);
        var api = mock(HomeAwayApiClient.class);
        var oauth = mock(HomeAwayOAuthService.class);
        var audit = mock(AuditLogService.class);
        var service = new HomeAwaySyncService(repository, api, oauth, audit);
        Map<String,Object> payload = Map.of("listing_id", "synthetic-private", "guest_email", "synthetic@example.invalid");
        assertThatThrownBy(() -> {
            switch (action) {
                case "created" -> service.handleReservationCreated(payload, 7L);
                case "updated" -> service.handleReservationUpdated(payload, 7L);
                case "cancelled" -> service.handleReservationCancelled(payload, 7L);
                default -> service.handleAvailabilityUpdate(payload, 7L);
            }
        }).isInstanceOf(UnsupportedOperationException.class).hasNoCause()
                .hasMessage("Synchronisation HomeAway indisponible : traitement PMS non implémenté");
        verifyNoInteractions(repository, api, oauth, audit);
    }
}
