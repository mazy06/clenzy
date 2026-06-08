package com.clenzy.integration.activities;

import com.clenzy.model.ActivityProvider;
import org.springframework.stereotype.Component;

/** Affiliation Klook (portail in-house) : paramètre {@code aid} sur les liens {@code klook.com}. */
@Component
public class KlookAffiliateLinkDecorator implements AffiliateLinkDecorator {

    @Override
    public ActivityProvider provider() {
        return ActivityProvider.KLOOK;
    }

    @Override
    public String affiliateParam() {
        return "aid";
    }

    @Override
    public boolean matchesHost(String host) {
        return host.equals("klook.com") || host.endsWith(".klook.com");
    }
}
