package com.clenzy.dto;

import com.clenzy.model.MarketingIntegration;

import java.time.Instant;

/**
 * Vue de la configuration d'integration marketing renvoyee au frontend.
 *
 * SECURITE : la cle API n'est JAMAIS renvoyee en clair — uniquement un booleen
 * {@code configured} et une version masquee ({@code apiKeyMasked}, ex "••••SYVG").
 */
public record MarketingIntegrationDto(
        String provider,
        boolean configured,
        String apiKeyMasked,
        Long waitlistListId,
        Long newsletterListId,
        Long prospectsListId,
        Long leadsListId,
        boolean syncWaitlistEnabled,
        boolean syncNewsletterEnabled,
        boolean syncProspectsEnabled,
        boolean syncLeadsEnabled,
        boolean syncAttributesEnabled,
        String status,
        String errorMessage,
        Instant lastTestedAt
) {

    /** Construit la vue masquee a partir de l'entity (ne fuit jamais la cle). */
    public static MarketingIntegrationDto from(MarketingIntegration m) {
        String key = m.getApiKey();
        boolean configured = key != null && !key.isBlank();
        String masked = configured ? mask(key) : null;
        return new MarketingIntegrationDto(
                m.getProvider().name(),
                configured,
                masked,
                m.getWaitlistListId(),
                m.getNewsletterListId(),
                m.getProspectsListId(),
                m.getLeadsListId(),
                m.isSyncWaitlistEnabled(),
                m.isSyncNewsletterEnabled(),
                m.isSyncProspectsEnabled(),
                m.isSyncLeadsEnabled(),
                m.isSyncAttributesEnabled(),
                m.getStatus().name(),
                m.getErrorMessage(),
                m.getLastTestedAt()
        );
    }

    private static String mask(String key) {
        String trimmed = key.trim();
        String last = trimmed.length() >= 4 ? trimmed.substring(trimmed.length() - 4) : trimmed;
        return "••••" + last;
    }
}
