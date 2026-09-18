package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.ProviderStatus;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.util.StringUtils;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class MarketplaceActivationDeliverySchedulerTest {
    @Mock MarketplaceActivationDeliveries deliveries;
    @Mock MarketplaceProviderRepository providers;
    @Mock MarketplaceNotificationService notifications;
    @Mock TokenEncryptionService encryption;
    MarketplaceActivationDeliveryScheduler scheduler;
    Clock clock = Clock.fixed(Instant.parse("2026-09-15T12:00:00Z"), ZoneOffset.UTC);
    String token = "test-only-activation-link";
    MarketplaceActivationDeliveries.Claim claim;
    MarketplaceProvider provider;

    @BeforeEach
    void setup() {
        scheduler = new MarketplaceActivationDeliveryScheduler(deliveries, providers, notifications, encryption, clock);
        claim = new MarketplaceActivationDeliveries.Claim(1L, 42L, StringUtils.computeEmailHash("test@example.invalid"),
                MarketplaceUploadTokens.hash(token), "encrypted-only", UUID.randomUUID().toString());
        provider = new MarketplaceProvider();
        provider.setId(1L); provider.setUserId(42L); provider.setEmail("test@example.invalid");
        provider.setDisplayName("Baitly test"); provider.setStatus(ProviderStatus.ACTIVE);
        provider.setEmailConfirmedAt(LocalDateTime.now(clock));
        provider.setActivationTokenHash(claim.tokenHash());
        provider.setActivationTokenExpiresAt(LocalDateTime.now(clock).plusDays(7));
        when(deliveries.claim(1L)).thenReturn(claim);
        when(providers.findById(1L)).thenReturn(Optional.of(provider));
    }

    @Test
    void successfulSendIsAcknowledgedWithoutChangingTheActivationToken() {
        when(encryption.decrypt("encrypted-only")).thenReturn(token);
        scheduler.deliver(1L);
        verify(notifications).sendAccountActivation("Baitly test", "test@example.invalid", token);
        verify(deliveries).finish(claim, true);
        verify(providers, never()).save(any());
    }

    @Test
    void transportFailureIsRecordedForAnotherAttempt() {
        when(encryption.decrypt("encrypted-only")).thenReturn(token);
        doThrow(new IllegalStateException("transport unavailable")).when(notifications).sendAccountActivation(any(), any(), any());
        assertThatThrownBy(() -> scheduler.deliver(1L)).isInstanceOf(IllegalStateException.class);
        verify(deliveries).finish(claim, false);
    }

    @Test
    void consumedLinkBetweenClaimAndLoadIsNotSentOrRearmed() {
        provider.setActivationTokenHash(null);
        scheduler.deliver(1L);
        verifyNoInteractions(notifications, encryption);
        verify(providers, never()).save(any());
        verify(deliveries).finish(claim, false);
    }

    @Test
    void changedRecipientIsNotGivenTheOriginalAccountsLink() {
        provider.setEmail("other@example.invalid");
        scheduler.deliver(1L);
        verifyNoInteractions(notifications, encryption);
    }

    @Test
    void corruptedCiphertextCannotSendADifferentToken() {
        when(encryption.decrypt("encrypted-only")).thenReturn("wrong-link");
        assertThatThrownBy(() -> scheduler.deliver(1L)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(notifications);
        verify(deliveries).finish(claim, false);
    }
}
