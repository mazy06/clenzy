package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.ProviderStatus;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.util.StringUtils;
import org.slf4j.LoggerFactory;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Objects;

@Component
public class MarketplaceActivationDeliveryScheduler {
    private final MarketplaceActivationDeliveries deliveries;
    private final MarketplaceProviderRepository providers;
    private final MarketplaceNotificationService notifications;
    private final TokenEncryptionService encryption;
    private final Clock clock;

    public MarketplaceActivationDeliveryScheduler(MarketplaceActivationDeliveries deliveries,
            MarketplaceProviderRepository providers, MarketplaceNotificationService notifications,
            TokenEncryptionService encryption, Clock clock) {
        this.deliveries = deliveries;
        this.providers = providers;
        this.notifications = notifications;
        this.encryption = encryption;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${baitly.marketplace.activation-delivery-delay-ms:60000}")
    @SchedulerLock(name = "baitly-marketplace-activation-delivery", lockAtMostFor = "PT10M")
    public void retryDue() {
        deliveries.discardInvalid();
        for (Long id : deliveries.due()) {
            try { deliver(id); }
            catch (RuntimeException failure) {
                // Aucun message d'exception externe : il pourrait contenir le lien ou l'adresse.
                LoggerFactory.getLogger(getClass()).warn("Invitation Baitly différée pour la fiche {}", id);
            }
        }
    }

    public void deliver(Long id) {
        var claim = deliveries.claim(id);
        if (claim == null) return;
        boolean sent = false;
        try {
            var provider = providers.findById(id).orElseThrow();
            // Relecture avant l'appel réseau ; aucun verrou SQL ne couvre l'envoi.
            if (provider.getStatus() == ProviderStatus.ACTIVE && provider.isEmailConfirmed()
                    && Objects.equals(provider.getUserId(), claim.userId())
                    && Objects.equals(StringUtils.computeEmailHash(provider.getEmail()), claim.emailHash())
                    && Objects.equals(provider.getActivationTokenHash(), claim.tokenHash())
                    && provider.getActivationTokenExpiresAt() != null
                    && provider.getActivationTokenExpiresAt().isAfter(LocalDateTime.now(clock))) {
                String token = encryption.decrypt(claim.encryptedToken());
                if (!Objects.equals(MarketplaceUploadTokens.hash(token), claim.tokenHash())) {
                    throw new IllegalStateException("Invitation incohérente");
                }
                notifications.sendAccountActivation(provider.getDisplayName(), provider.getEmail(), token);
                sent = true;
            }
        } finally {
            // Une panne ici laisse RUNNING jusqu'à expiration du bail, puis le même lien est repris.
            deliveries.finish(claim, sent);
        }
    }
}
