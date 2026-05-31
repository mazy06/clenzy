package com.clenzy.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.lang.reflect.Method;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class ApiGatewayFilterTest {

    private ApiGatewayFilter filter;

    @BeforeEach
    void setUp() {
        filter = new ApiGatewayFilter();
        MDC.clear();
    }

    private static Boolean shouldNotFilter(ApiGatewayFilter f, MockHttpServletRequest req) throws Exception {
        Method m = ApiGatewayFilter.class.getDeclaredMethod("shouldNotFilter", jakarta.servlet.http.HttpServletRequest.class);
        m.setAccessible(true);
        return (Boolean) m.invoke(f, req);
    }

    @Test
    void doFilterInternal_generatesRequestIdWhenMissing() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/users");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = new MockFilterChain();

        filter.doFilterInternal(req, resp, chain);

        String requestId = resp.getHeader("X-Request-Id");
        assertThat(requestId).isNotBlank();
        assertThat(UUID.fromString(requestId)).isNotNull();
        assertThat(resp.getHeader("X-Response-Time")).matches("\\d+ms");
    }

    @Test
    void doFilterInternal_preservesIncomingRequestId() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/users");
        req.addHeader("X-Request-Id", "incoming-id-123");
        MockHttpServletResponse resp = new MockHttpServletResponse();

        filter.doFilterInternal(req, resp, new MockFilterChain());

        assertThat(resp.getHeader("X-Request-Id")).isEqualTo("incoming-id-123");
    }

    @Test
    void doFilterInternal_emptyIncomingRequestId_generatesNew() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/users");
        req.addHeader("X-Request-Id", "  ");
        MockHttpServletResponse resp = new MockHttpServletResponse();

        filter.doFilterInternal(req, resp, new MockFilterChain());

        String requestId = resp.getHeader("X-Request-Id");
        assertThat(requestId).isNotBlank();
        assertThat(requestId.trim()).isNotEmpty();
        // Generated UUID, not the blank input
        assertThat(UUID.fromString(requestId)).isNotNull();
    }

    @Test
    void doFilterInternal_invokesNextFilter() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/users");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, resp, chain);

        verify(chain).doFilter(req, resp);
    }

    @Test
    void doFilterInternal_clearsMdcAfterRequest() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/users");
        MockHttpServletResponse resp = new MockHttpServletResponse();

        filter.doFilterInternal(req, resp, new MockFilterChain());

        assertThat(MDC.get("requestId")).isNull();
    }

    @Test
    void doFilterInternal_setsMdcDuringExecution() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/users");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        // Capture MDC state mid-chain
        final String[] captured = new String[1];
        doAnswer(inv -> {
            captured[0] = MDC.get("requestId");
            return null;
        }).when(chain).doFilter(req, resp);

        filter.doFilterInternal(req, resp, chain);

        assertThat(captured[0]).isNotBlank();
    }

    @Test
    void doFilterInternal_excludesActuatorFromLogging() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/actuator/health");
        MockHttpServletResponse resp = new MockHttpServletResponse();

        // Should still process (the filter runs), but not log. Behavioral check via no exception.
        filter.doFilterInternal(req, resp, new MockFilterChain());

        assertThat(resp.getHeader("X-Request-Id")).isNotBlank();
    }

    @Test
    void doFilterInternal_apiHealthExcluded() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/health");
        MockHttpServletResponse resp = new MockHttpServletResponse();

        filter.doFilterInternal(req, resp, new MockFilterChain());

        assertThat(resp.getHeader("X-Request-Id")).isNotBlank();
        assertThat(resp.getHeader("X-Response-Time")).isNotBlank();
    }

    @Test
    void shouldNotFilter_staticResources_skip() throws Exception {
        for (String path : new String[]{
                "/static/css/app.css", "/assets/img.png", "/favicon.ico",
                "/foo.css", "/bar.js", "/x.png", "/x.jpg", "/x.gif",
                "/x.svg", "/x.woff", "/x.woff2", "/x.ttf"
        }) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", path);
            assertThat(shouldNotFilter(filter, req)).as(path).isTrue();
        }
    }

    @Test
    void shouldNotFilter_apiPath_processes() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/foo");
        assertThat(shouldNotFilter(filter, req)).isFalse();
    }

    @Test
    void doFilterInternal_addsResponseTimeHeader() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/x");
        MockHttpServletResponse resp = new MockHttpServletResponse();

        filter.doFilterInternal(req, resp, new MockFilterChain());

        String time = resp.getHeader("X-Response-Time");
        assertThat(time).matches("\\d+ms");
    }

    @Test
    void doFilterInternal_chainExceptionStillCleansMdcAndHeaders() {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/x");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain failingChain = (request, response) -> {
            throw new RuntimeException("boom");
        };

        try {
            filter.doFilterInternal(req, resp, failingChain);
        } catch (Exception ignored) {
            // expected
        }
        // MDC nettoye et headers presents meme apres exception
        assertThat(MDC.get("requestId")).isNull();
        assertThat(resp.getHeader("X-Response-Time")).isNotBlank();
    }
}
