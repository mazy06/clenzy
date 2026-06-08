package com.clenzy.integration.activities;

import com.clenzy.model.ActivityProvider;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AffiliateLinkDecoratorTest {

    private final AffiliateLinkDecorator klook = new KlookAffiliateLinkDecorator();
    private final AffiliateLinkDecorator gyg = new GetYourGuideAffiliateLinkDecorator();

    // ─── Klook (param aid) ──────────────────────────────────────────────────
    @Test
    void klook_wrapsBareUrlWithAid() {
        assertThat(klook.wrap("https://www.klook.com/activity/123-foo/", "AFF42"))
            .isEqualTo("https://www.klook.com/activity/123-foo/?aid=AFF42");
    }

    @Test
    void klook_appendsWithAmpersandWhenQueryPresent() {
        assertThat(klook.wrap("https://www.klook.com/activity/123?spm=x", "AFF42"))
            .isEqualTo("https://www.klook.com/activity/123?spm=x&aid=AFF42");
    }

    @Test
    void klook_leavesAlreadyTrackedUntouched() {
        String url = "https://www.klook.com/activity/123?aid=EXISTING&aff_adid=7";
        assertThat(klook.wrap(url, "AFF42")).isEqualTo(url);
    }

    @Test
    void klook_matchesApexAndSubdomainsOnly() {
        assertThat(klook.matchesHost("klook.com")).isTrue();
        assertThat(klook.matchesHost("www.klook.com")).isTrue();
        assertThat(klook.matchesHost("evil-klook.com.attacker.net")).isFalse();
    }

    // ─── GetYourGuide (param partner_id) ────────────────────────────────────
    @Test
    void gyg_wrapsBareUrlWithPartnerId() {
        assertThat(gyg.wrap("https://www.getyourguide.com/paris-l16/eiffel-tower-t1/", "ABC123"))
            .isEqualTo("https://www.getyourguide.com/paris-l16/eiffel-tower-t1/?partner_id=ABC123");
    }

    @Test
    void gyg_appendsWithAmpersandWhenQueryPresent() {
        assertThat(gyg.wrap("https://www.getyourguide.com/x?cmp=guide", "ABC123"))
            .isEqualTo("https://www.getyourguide.com/x?cmp=guide&partner_id=ABC123");
    }

    @Test
    void gyg_leavesAlreadyTrackedUntouched() {
        String url = "https://www.getyourguide.com/x?partner_id=EXISTING";
        assertThat(gyg.wrap(url, "ABC123")).isEqualTo(url);
    }

    @Test
    void gyg_leavesShortGygMeLinkUntouched() {
        String url = "https://gyg.me/abc123"; // déjà tracké, autre domaine
        assertThat(gyg.wrap(url, "ABC123")).isEqualTo(url);
    }

    // ─── Isolation : chaque décorateur ne touche que son domaine ────────────
    @Test
    void decoratorsIgnoreOtherProvidersDomains() {
        String gygUrl = "https://www.getyourguide.com/x";
        String klookUrl = "https://www.klook.com/x";
        assertThat(klook.wrap(gygUrl, "AFF42")).isEqualTo(gygUrl);
        assertThat(gyg.wrap(klookUrl, "ABC123")).isEqualTo(klookUrl);
    }

    @Test
    void nullAndBlankSafe() {
        assertThat(klook.wrap(null, "AFF42")).isNull();
        assertThat(gyg.wrap("", "ABC123")).isEmpty();
        assertThat(klook.wrap("https://www.klook.com/x", null)).isEqualTo("https://www.klook.com/x");
        assertThat(gyg.wrap("https://www.getyourguide.com/x", "  ")).isEqualTo("https://www.getyourguide.com/x");
    }

    @Test
    void urlEncodesAffiliateIdValue() {
        assertThat(klook.wrap("https://www.klook.com/x", "a b&c"))
            .isEqualTo("https://www.klook.com/x?aid=a+b%26c");
    }

    @Test
    void providerAndParamExposed() {
        assertThat(klook.provider()).isEqualTo(ActivityProvider.KLOOK);
        assertThat(klook.affiliateParam()).isEqualTo("aid");
        assertThat(gyg.provider()).isEqualTo(ActivityProvider.GETYOURGUIDE);
        assertThat(gyg.affiliateParam()).isEqualTo("partner_id");
    }
}
