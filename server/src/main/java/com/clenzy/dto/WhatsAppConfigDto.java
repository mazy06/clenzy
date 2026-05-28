package com.clenzy.dto;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;

/**
 * Vue de la {@link WhatsAppConfig} expose au frontend. NE FUITE AUCUN secret :
 * ni le {@code apiToken} Meta, ni l'{@code openwaApiKey}. On expose juste des
 * booleens {@code hasApiToken} / {@code hasOpenwaApiKey} pour que l'UI sache
 * s'ils sont deja remplis.
 */
public record WhatsAppConfigDto(
    Long id,
    WhatsAppProviderType provider,
    // Meta
    String phoneNumberId,
    String businessAccountId,
    boolean hasApiToken,
    // OpenWA
    String openwaSessionId,
    boolean hasOpenwaApiKey,
    // Common
    boolean enabled
) {
    public static WhatsAppConfigDto from(WhatsAppConfig c) {
        return new WhatsAppConfigDto(
            c.getId(),
            c.getProvider() != null ? c.getProvider() : WhatsAppProviderType.META,
            c.getPhoneNumberId(),
            c.getBusinessAccountId(),
            c.getApiToken() != null && !c.getApiToken().isBlank(),
            c.getOpenwaSessionId(),
            c.getOpenwaApiKey() != null && !c.getOpenwaApiKey().isBlank(),
            c.isEnabled()
        );
    }
}
