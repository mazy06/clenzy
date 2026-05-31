package com.clenzy.booking.security;

import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.lang.reflect.Method;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingApiKeyFilterTest {

    @Mock private BookingEngineConfigRepository configRepository;

    private BookingApiKeyFilter filter;
    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new ObjectMapper();
        filter = new BookingApiKeyFilter(configRepository, mapper);
    }

    private static BookingEngineConfig config(boolean enabled, String allowedOrigins) {
        BookingEngineConfig c = new BookingEngineConfig();
        c.setEnabled(enabled);
        c.setApiKey("valid-key-1234567890");
        c.setOrganizationId(42L);
        c.setAllowedOrigins(allowedOrigins);
        return c;
    }

    private static Boolean shouldNotFilter(BookingApiKeyFilter f, MockHttpServletRequest req) throws Exception {
        Method m = BookingApiKeyFilter.class.getDeclaredMethod("shouldNotFilter", jakarta.servlet.http.HttpServletRequest.class);
        m.setAccessible(true);
        return (Boolean) m.invoke(f, req);
    }

    @Test
    void shouldNotFilter_outsideBookingPath_skips() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/users");
        assertThat(shouldNotFilter(filter, req)).isTrue();
    }

    @Test
    void shouldNotFilter_bookingPath_processes() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/public/booking/properties");
        assertThat(shouldNotFilter(filter, req)).isFalse();
    }

    @Test
    void doFilterInternal_optionsPreflight_passesWithoutApiKey() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("OPTIONS", "/api/public/booking/x");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, resp, chain);

        verify(chain).doFilter(req, resp);
        assertThat(resp.getStatus()).isEqualTo(200);
    }

    @Test
    void doFilterInternal_missingHeader_returns401() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/public/booking/x");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, resp, chain);

        assertThat(resp.getStatus()).isEqualTo(401);
        assertThat(resp.getContentAsString()).contains("manquant");
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void doFilterInternal_blankApiKey_returns401() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/public/booking/x");
        req.addHeader("X-Booking-Key", "   ");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, resp, chain);

        assertThat(resp.getStatus()).isEqualTo(401);
    }

    @Test
    void doFilterInternal_unknownApiKey_returns401() throws Exception {
        when(configRepository.findByApiKey("k-9999999999")).thenReturn(Optional.empty());
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/public/booking/x");
        req.addHeader("X-Booking-Key", "k-9999999999");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, resp, chain);

        assertThat(resp.getStatus()).isEqualTo(401);
    }

    @Test
    void doFilterInternal_disabledEngine_returns403() throws Exception {
        when(configRepository.findByApiKey("ek")).thenReturn(Optional.of(config(false, null)));
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/public/booking/x");
        req.addHeader("X-Booking-Key", "ek");
        MockHttpServletResponse resp = new MockHttpServletResponse();

        filter.doFilterInternal(req, resp, mock(FilterChain.class));

        assertThat(resp.getStatus()).isEqualTo(403);
        assertThat(resp.getContentAsString()).contains("desactive");
    }

    @Test
    void doFilterInternal_validKey_setsAttributesAndContinues() throws Exception {
        BookingEngineConfig cfg = config(true, null);
        when(configRepository.findByApiKey("ok")).thenReturn(Optional.of(cfg));
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/public/booking/x");
        req.addHeader("X-Booking-Key", "ok");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, resp, chain);

        verify(chain).doFilter(req, resp);
        assertThat(req.getAttribute("bookingOrgId")).isEqualTo(42L);
        assertThat(req.getAttribute("bookingConfig")).isEqualTo(cfg);
    }

    @Test
    void doFilterInternal_allowedOrigin_addsCorsHeaders() throws Exception {
        BookingEngineConfig cfg = config(true, "https://shop.example.com,https://other.com");
        when(configRepository.findByApiKey("ok")).thenReturn(Optional.of(cfg));
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/public/booking/x");
        req.addHeader("X-Booking-Key", "ok");
        req.addHeader("Origin", "https://shop.example.com");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, resp, chain);

        verify(chain).doFilter(req, resp);
        assertThat(resp.getHeader("Access-Control-Allow-Origin")).isEqualTo("https://shop.example.com");
        assertThat(resp.getHeader("Access-Control-Allow-Methods")).contains("GET", "POST");
        assertThat(resp.getHeader("Access-Control-Allow-Headers")).contains("X-Booking-Key");
        assertThat(resp.getHeader("Vary")).isEqualTo("Origin");
    }

    @Test
    void doFilterInternal_originWithTrailingSlash_acceptedWhenAllowedHasNone() throws Exception {
        BookingEngineConfig cfg = config(true, "https://shop.example.com");
        when(configRepository.findByApiKey("ok")).thenReturn(Optional.of(cfg));
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/public/booking/x");
        req.addHeader("X-Booking-Key", "ok");
        req.addHeader("Origin", "https://shop.example.com/");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, resp, chain);

        verify(chain).doFilter(req, resp);
        assertThat(resp.getStatus()).isEqualTo(200);
    }

    @Test
    void doFilterInternal_disallowedOrigin_returns403() throws Exception {
        BookingEngineConfig cfg = config(true, "https://shop.example.com");
        when(configRepository.findByApiKey("ok")).thenReturn(Optional.of(cfg));
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/public/booking/x");
        req.addHeader("X-Booking-Key", "ok");
        req.addHeader("Origin", "https://malicious.com");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, resp, chain);

        assertThat(resp.getStatus()).isEqualTo(403);
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void doFilterInternal_noAllowedOriginsConfig_acceptsAnyOrigin() throws Exception {
        BookingEngineConfig cfg = config(true, "");
        when(configRepository.findByApiKey("ok")).thenReturn(Optional.of(cfg));
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/public/booking/x");
        req.addHeader("X-Booking-Key", "ok");
        req.addHeader("Origin", "https://any-origin.com");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, resp, chain);

        verify(chain).doFilter(req, resp);
        assertThat(resp.getStatus()).isEqualTo(200);
    }

    @Test
    void doFilterInternal_noOriginHeader_skipsCorsCheck() throws Exception {
        BookingEngineConfig cfg = config(true, "https://only.example.com");
        when(configRepository.findByApiKey("ok")).thenReturn(Optional.of(cfg));
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/public/booking/x");
        req.addHeader("X-Booking-Key", "ok");
        MockHttpServletResponse resp = new MockHttpServletResponse();

        filter.doFilterInternal(req, resp, new MockFilterChain());

        assertThat(resp.getStatus()).isEqualTo(200);
        assertThat(resp.getHeader("Access-Control-Allow-Origin")).isNull();
    }
}
