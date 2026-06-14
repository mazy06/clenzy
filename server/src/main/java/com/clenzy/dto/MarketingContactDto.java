package com.clenzy.dto;

import com.clenzy.model.MarketingContact;
import com.clenzy.model.MarketingContactSource;
import com.clenzy.model.MarketingContactStatus;

import java.time.Instant;

/** Contact marketing capturé (CLZ Domaine 2 — capture de leads). */
public record MarketingContactDto(
        Long id,
        String email,
        String name,
        MarketingContactSource source,
        MarketingContactStatus status,
        String locale,
        boolean consent,
        Instant createdAt
) {
    public static MarketingContactDto from(MarketingContact c) {
        return new MarketingContactDto(c.getId(), c.getEmail(), c.getName(), c.getSource(),
                c.getStatus(), c.getLocale(), c.isConsent(), c.getCreatedAt());
    }
}
