package com.clenzy.dto;

import com.clenzy.model.WhatsAppConfig;

public record WhatsAppConfigDto(
    Long id,
    String phoneNumberId,
    String businessAccountId,
    boolean enabled,
    boolean hasApiToken
) {
    public static WhatsAppConfigDto from(WhatsAppConfig c) {
        return new WhatsAppConfigDto(
            c.getId(), c.getPhoneNumberId(), c.getBusinessAccountId(),
            c.isEnabled(), c.getApiToken() != null && !c.getApiToken().isBlank()
        );
    }
}
