package com.clenzy.config;

import jakarta.servlet.ServletException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import jakarta.servlet.http.Cookie;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("TokenCookieFilter")
class TokenCookieFilterTest {

    private TokenCookieFilter filter;
    private MockHttpServletResponse response;
    private MockFilterChain filterChain;

    @BeforeEach
    void setUp() {
        filter = new TokenCookieFilter();
        response = new MockHttpServletResponse();
        filterChain = new MockFilterChain();
    }

    @Test
    @DisplayName("when Authorization header exists - cookie is ignored, request passes through unchanged")
    void whenAuthorizationHeaderExists_thenCookieIsIgnored() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer existing-token");
        request.setCookies(new Cookie(TokenCookieFilter.COOKIE_NAME, "cookie-token"));

        filter.doFilterInternal(request, response, filterChain);

        MockHttpServletRequest filteredRequest = (MockHttpServletRequest) filterChain.getRequest();
        assertThat(filteredRequest).isSameAs(request);
        assertThat(filteredRequest.getHeader("Authorization")).isEqualTo("Bearer existing-token");
    }

    @Test
    @DisplayName("when no Authorization header but cookie exists - Authorization header is injected")
    void whenNoCookieExists_thenAuthorizationHeaderInjected() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(TokenCookieFilter.COOKIE_NAME, "my-jwt-token"));

        filter.doFilterInternal(request, response, filterChain);

        // The filtered request should be a wrapper, not the original
        assertThat(filterChain.getRequest()).isNotSameAs(request);
        assertThat(filterChain.getRequest().getClass().getSimpleName()).isEqualTo("AuthorizationHeaderWrapper");

        // The wrapper should inject the Authorization header
        String authHeader = ((jakarta.servlet.http.HttpServletRequest) filterChain.getRequest())
                .getHeader("Authorization");
        assertThat(authHeader).isEqualTo("Bearer my-jwt-token");
    }

    @Test
    @DisplayName("when no Authorization header and no cookie - request passes through without modification")
    void whenNoAuthorizationHeaderAndNoCookie_thenRequestPassesThrough() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();

        filter.doFilterInternal(request, response, filterChain);

        MockHttpServletRequest filteredRequest = (MockHttpServletRequest) filterChain.getRequest();
        assertThat(filteredRequest).isSameAs(request);
        assertThat(filteredRequest.getHeader("Authorization")).isNull();
    }

    @Test
    @DisplayName("when cookie exists but is blank - no Authorization header injected")
    void whenCookieIsBlank_thenNoAuthorizationHeaderInjected() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(TokenCookieFilter.COOKIE_NAME, "   "));

        filter.doFilterInternal(request, response, filterChain);

        MockHttpServletRequest filteredRequest = (MockHttpServletRequest) filterChain.getRequest();
        assertThat(filteredRequest).isSameAs(request);
        assertThat(filteredRequest.getHeader("Authorization")).isNull();
    }

    @Test
    @DisplayName("when cookie exists but is empty string - no Authorization header injected")
    void whenCookieIsEmpty_thenNoAuthorizationHeaderInjected() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(TokenCookieFilter.COOKIE_NAME, ""));

        filter.doFilterInternal(request, response, filterChain);

        MockHttpServletRequest filteredRequest = (MockHttpServletRequest) filterChain.getRequest();
        assertThat(filteredRequest).isSameAs(request);
        assertThat(filteredRequest.getHeader("Authorization")).isNull();
    }

    @Test
    @DisplayName("when other cookies exist but not clenzy_auth - request passes through unchanged")
    void whenOtherCookiesExist_thenRequestPassesThrough() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("other_cookie", "some-value"));

        filter.doFilterInternal(request, response, filterChain);

        MockHttpServletRequest filteredRequest = (MockHttpServletRequest) filterChain.getRequest();
        assertThat(filteredRequest).isSameAs(request);
        assertThat(filteredRequest.getHeader("Authorization")).isNull();
    }
}
