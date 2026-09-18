package com.clenzy.marketplace.service;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.assertj.core.api.Assertions.*;

class MarketplaceApplicationSessionTest {
    @Test
    void secretIsOnlyReadFromTheHttpOnlyCookie() {
        var request = new MockHttpServletRequest();
        request.addHeader("X-Requested-With", "BaitlyApplication");
        request.setCookies(new Cookie(MarketplaceApplicationSession.COOKIE, "secret"));
        assertThat(MarketplaceApplicationSession.resolve("session", request)).isEqualTo("secret");
        assertThatThrownBy(() -> MarketplaceApplicationSession.resolve("secret-in-url", request))
                .isInstanceOf(MarketplaceApplicationDocumentService.InvalidUploadTokenException.class);
        assertThat(MarketplaceApplicationSession.cookie("secret"))
                .contains("HttpOnly", "Secure", "SameSite=None", "Path=/api/public/marketplace/applications");
    }

    @Test
    void cookieAloneDoesNotAuthorizeACrossSiteFormSubmission() {
        var request = new MockHttpServletRequest();
        request.setCookies(new Cookie(MarketplaceApplicationSession.COOKIE, "secret"));
        assertThatThrownBy(() -> MarketplaceApplicationSession.resolve("session", request))
                .isInstanceOf(MarketplaceApplicationDocumentService.InvalidUploadTokenException.class);
    }

    @Test
    void missingCookieCannotAccessAnApplication() {
        var request = new MockHttpServletRequest(); request.addHeader("X-Requested-With", "BaitlyApplication");
        assertThatThrownBy(() -> MarketplaceApplicationSession.resolve("session", request))
                .isInstanceOf(MarketplaceApplicationDocumentService.InvalidUploadTokenException.class);
        assertThat(MarketplaceApplicationSession.cookie("")).contains("Max-Age=0");
    }
}
