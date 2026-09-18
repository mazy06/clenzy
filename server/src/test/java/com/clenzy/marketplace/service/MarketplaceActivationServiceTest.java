package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.KeycloakService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Le prestataire pose son mot de passe.
 *
 * <p>Ce jeton ouvre un COMPTE : les cas qui comptent sont ceux ou il ne doit
 * PAS fonctionner, et l'ordre entre Keycloak et la consommation du jeton.</p>
 */
@ExtendWith(MockitoExtension.class)
class MarketplaceActivationServiceTest {

    @Mock private MarketplaceProviderRepository providerRepository;
    @Mock private UserRepository userRepository;
    @Mock private KeycloakService keycloakService;
    @Mock private MarketplaceActivationTokenConsumer tokens;

    private MarketplaceActivationService service;

    private static final Instant NOW = Instant.parse("2026-09-13T09:00:00Z");
    private static final String TOKEN = "jeton-activation";

    @BeforeEach
    void setUp() {
        service = new MarketplaceActivationService(
            providerRepository, userRepository, keycloakService, Clock.fixed(NOW, ZoneOffset.UTC), tokens);
    }

    @Test
    void whenTheTokenIsValid_thenThePasswordIsSetAndTheTokenConsumed() {
        var provider = givenProvider(p -> {});
        givenAccount();
        allowConsumption();

        service.activate(TOKEN, "un-mot-de-passe-correct");

        var order = inOrder(tokens, keycloakService);
        order.verify(tokens).consume(eq(7L), eq(42L), eq(MarketplaceUploadTokens.hash(TOKEN)), any());
        order.verify(keycloakService).resetPassword("kc-1", "un-mot-de-passe-correct");
        verify(providerRepository, never()).save(any());
    }

    @Test
    void whenKeycloakFails_thenRecoveryUsesEmailWithoutRearmingTheToken() {
        givenProvider(p -> {});
        givenAccount();
        allowConsumption();
        doThrow(new RuntimeException("Keycloak injoignable"))
            .when(keycloakService).resetPassword(anyString(), anyString());

        assertThatThrownBy(() -> service.activate(TOKEN, "un-mot-de-passe-correct"))
            .isInstanceOf(MarketplaceActivationService.ActivationRecoveryException.class)
            .hasMessageContaining("Un courriel");

        verify(keycloakService).sendPasswordResetEmailByKeycloakId("kc-1");
        verify(providerRepository, never()).save(any());
    }

    @Test
    void aConcurrentConsumerCannotResetThePasswordAgain() {
        givenProvider(p -> {});
        givenAccount();
        when(tokens.consume(any(), any(), any(), any())).thenReturn(false);
        assertThatThrownBy(() -> service.activate(TOKEN, "un-mot-de-passe-correct"))
                .isInstanceOf(MarketplaceActivationService.InvalidActivationTokenException.class);
        verifyNoInteractions(keycloakService);
    }

    @Test
    void failedRecoveryDoesNotClaimAnEmailWasSent() {
        givenProvider(p -> {});
        givenAccount();
        allowConsumption();
        doThrow(new RuntimeException("indisponible")).when(keycloakService).resetPassword(any(), any());
        doThrow(new RuntimeException("indisponible")).when(keycloakService).sendPasswordResetEmailByKeycloakId(any());
        assertThatThrownBy(() -> service.activate(TOKEN, "un-mot-de-passe-correct"))
                .isInstanceOf(MarketplaceActivationService.ActivationRecoveryException.class)
                .hasMessageContaining("Mot de passe oublié").hasMessageNotContaining("Un courriel");
        verify(providerRepository, never()).save(any());
    }

    @Test
    void tokenIsInvalidAtItsExactExpiry() {
        givenProvider(p -> p.setActivationTokenExpiresAt(LocalDateTime.ofInstant(NOW, ZoneOffset.UTC)));
        assertThatThrownBy(() -> service.activate(TOKEN, "un-mot-de-passe-correct"))
                .isInstanceOf(MarketplaceActivationService.InvalidActivationTokenException.class);
        verifyNoInteractions(tokens, keycloakService);
    }

    private void allowConsumption() {
        when(tokens.consume(eq(7L), eq(42L), eq(MarketplaceUploadTokens.hash(TOKEN)), any())).thenReturn(true);
    }

    @Test
    void whenTheTokenHasExpired_thenItIsRefused() {
        givenProvider(p -> p.setActivationTokenExpiresAt(
            LocalDateTime.ofInstant(NOW, ZoneOffset.UTC).minusDays(1)));

        assertThatThrownBy(() -> service.activate(TOKEN, "un-mot-de-passe-correct"))
            .isInstanceOf(MarketplaceActivationService.InvalidActivationTokenException.class);

        verifyNoInteractions(keycloakService);
    }

    @Test
    void whenTheTokenIsUnknownOrBlank_thenItIsRefused() {
        when(providerRepository.findByActivationTokenHash(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.activate("inconnu", "un-mot-de-passe-correct"))
            .isInstanceOf(MarketplaceActivationService.InvalidActivationTokenException.class);
        assertThatThrownBy(() -> service.activate("   ", "un-mot-de-passe-correct"))
            .isInstanceOf(MarketplaceActivationService.InvalidActivationTokenException.class);

        verifyNoInteractions(keycloakService);
    }

    @Test
    void whenThePasswordIsTooShort_thenNothingIsEvenLookedUp() {
        assertThatThrownBy(() -> service.activate(TOKEN, "court"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("8");

        verifyNoInteractions(providerRepository, keycloakService);
    }

    @Test
    void whenTheProviderHasNoAccountYet_thenTheTokenIsTreatedAsInvalid() {
        // Ne devrait pas arriver : le jeton n'est emis qu'apres la creation du
        // compte. Mieux vaut le dire que planter plus loin.
        givenProvider(p -> p.setUserId(null));

        assertThatThrownBy(() -> service.activate(TOKEN, "un-mot-de-passe-correct"))
            .isInstanceOf(MarketplaceActivationService.InvalidActivationTokenException.class);

        verifyNoInteractions(keycloakService);
    }

    @Test
    void describeGivesTheNameSoTheFormCanProveItsOrigin() {
        givenProvider(p -> {});

        assertThat(service.describe(TOKEN)).isEqualTo("Atelier Ourika");
    }

    private MarketplaceProvider givenProvider(Consumer<MarketplaceProvider> tweak) {
        var provider = new MarketplaceProvider();
        provider.setId(7L);
        provider.setDisplayName("Atelier Ourika");
        provider.setUserId(42L);
        provider.setActivationTokenHash(MarketplaceUploadTokens.hash(TOKEN));
        provider.setActivationTokenExpiresAt(
            LocalDateTime.ofInstant(NOW, ZoneOffset.UTC).plusDays(5));
        tweak.accept(provider);
        when(providerRepository.findByActivationTokenHash(MarketplaceUploadTokens.hash(TOKEN)))
            .thenReturn(Optional.of(provider));
        return provider;
    }

    private void givenAccount() {
        var user = new User();
        user.setId(42L);
        user.setKeycloakId("kc-1");
        when(userRepository.findById(42L)).thenReturn(Optional.of(user));
    }
}
