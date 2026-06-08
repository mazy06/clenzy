package com.clenzy.integration.activities;

import com.clenzy.model.ActivityProvider;
import org.springframework.stereotype.Component;

/**
 * Affiliation GetYourGuide : paramètre {@code partner_id} (Partner ID / Cookie ID) sur les liens
 * {@code getyourguide.com}. Les liens courts {@code gyg.me} générés par le link builder sont déjà
 * trackés (autre domaine) → laissés intacts.
 */
@Component
public class GetYourGuideAffiliateLinkDecorator implements AffiliateLinkDecorator {

    @Override
    public ActivityProvider provider() {
        return ActivityProvider.GETYOURGUIDE;
    }

    @Override
    public String affiliateParam() {
        return "partner_id";
    }

    @Override
    public boolean matchesHost(String host) {
        return host.equals("getyourguide.com") || host.endsWith(".getyourguide.com");
    }
}
