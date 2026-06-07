package com.clenzy.dto;

import com.clenzy.model.ActivityAffiliateConfig;

/**
 * Etat de connexion d'un provider d'activites pour une org (cote admin).
 * La cle API n'est JAMAIS exposee — seul {@code hasKey} indique sa presence.
 */
public record ActivityConfigDto(
    String provider,
    String affiliateId,
    boolean enabled,
    boolean hasKey
) {
    public static ActivityConfigDto from(ActivityAffiliateConfig c) {
        return new ActivityConfigDto(
            c.getProvider().name(),
            c.getAffiliateId(),
            c.isEnabled(),
            c.getApiKey() != null && !c.getApiKey().isBlank());
    }
}
