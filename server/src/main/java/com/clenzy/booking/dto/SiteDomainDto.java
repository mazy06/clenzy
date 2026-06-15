package com.clenzy.booking.dto;

import com.clenzy.booking.model.SiteDomain;

/** Vue d'un domaine de site (sous-domaine ou domaine custom). */
public record SiteDomainDto(
    Long id,
    Long siteId,
    String hostname,
    String status,
    boolean verified,
    boolean primary,
    String cloudflareHostnameId
) {
    public static SiteDomainDto from(SiteDomain d) {
        return new SiteDomainDto(
            d.getId(), d.getSiteId(), d.getHostname(),
            d.getStatus() != null ? d.getStatus().name() : null,
            d.isVerified(), d.isPrimary(), d.getCloudflareHostnameId());
    }
}
