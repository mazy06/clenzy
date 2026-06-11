package com.clenzy.service.ical;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests de {@link FeedUrlMasker} : aucune URL de feed avec token ne doit
 * apparaitre en clair dans les logs.
 */
@DisplayName("FeedUrlMasker")
class FeedUrlMaskerTest {

    @Test
    @DisplayName("URL avec token Airbnb (?s=...) → query string masquee")
    void whenUrlHasQueryToken_thenQueryIsMasked() {
        String masked = FeedUrlMasker.mask("https://www.airbnb.fr/calendar/ical/123.ics?s=abc123secret");

        assertThat(masked).isEqualTo("https://www.airbnb.fr/calendar/ical/123.ics?<masque>");
        assertThat(masked).doesNotContain("abc123secret");
    }

    @Test
    @DisplayName("URL sans query string → scheme/host/path conserves")
    void whenUrlHasNoQuery_thenHostAndPathKept() {
        assertThat(FeedUrlMasker.mask("https://example.com/cal.ics"))
                .isEqualTo("https://example.com/cal.ics");
    }

    @Test
    @DisplayName("port non standard conserve")
    void whenUrlHasPort_thenPortKept() {
        assertThat(FeedUrlMasker.mask("https://example.com:8443/cal.ics?token=x"))
                .isEqualTo("https://example.com:8443/cal.ics?<masque>");
    }

    @Test
    @DisplayName("URL nulle / vide / invalide → placeholder, jamais d'exception")
    void whenUrlIsInvalid_thenPlaceholder() {
        assertThat(FeedUrlMasker.mask(null)).isEqualTo("<url vide>");
        assertThat(FeedUrlMasker.mask("   ")).isEqualTo("<url vide>");
        assertThat(FeedUrlMasker.mask("not a url ::")).isEqualTo("<url invalide>");
        assertThat(FeedUrlMasker.mask("/relative/path?s=secret")).doesNotContain("secret");
    }
}
