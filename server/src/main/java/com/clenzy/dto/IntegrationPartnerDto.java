package com.clenzy.dto;

import com.clenzy.model.IntegrationPartner;
import com.clenzy.model.IntegrationPartner.IntegrationCategory;
import com.clenzy.model.IntegrationPartner.IntegrationStatus;

import java.time.Instant;

public record IntegrationPartnerDto(
    Long id,
    String partnerName,
    String partnerSlug,
    IntegrationCategory category,
    String description,
    String logoUrl,
    String websiteUrl,
    IntegrationStatus status,
    Instant connectedAt,
    Instant lastSyncAt
) {
    public static IntegrationPartnerDto from(IntegrationPartner p) {
        return new IntegrationPartnerDto(
            p.getId(), p.getPartnerName(), p.getPartnerSlug(),
            p.getCategory(), p.getDescription(), p.getLogoUrl(),
            p.getWebsiteUrl(), p.getStatus(),
            p.getConnectedAt(), p.getLastSyncAt()
        );
    }
}
