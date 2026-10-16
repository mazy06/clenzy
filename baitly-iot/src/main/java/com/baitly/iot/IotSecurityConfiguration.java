package com.baitly.iot;

import java.io.IOException;
import java.security.MessageDigest;
import java.util.List;
import java.util.Collections;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
@EnableMethodSecurity
public class IotSecurityConfiguration {
    @Bean
    SecurityFilterChain security(HttpSecurity http, DeviceRepository devices, DeviceSecrets secrets,
            IngressLimits limits, IngressMetrics metrics, @Value("${baitly.iot.internal-port:8096}") int internalPort,
            @Value("${baitly.iot.service-token}") String serviceToken) throws Exception {
        if (serviceToken == null || !serviceToken.matches("[\\x21-\\x7E]{32,128}")) {
            throw new IllegalStateException("BAITLY_IOT_SERVICE_TOKEN must contain at least 32 characters");
        }
        return http.csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(cache -> cache.disable())
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(TokenFilter.OPERATIONS).permitAll()
                        .requestMatchers("/internal/v1/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/measurements").hasRole("DEVICE")
                        .anyRequest().denyAll())
                .exceptionHandling(errors -> errors.authenticationEntryPoint((request, response, exception) ->
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED)))
                .addFilterBefore(new TokenFilter(devices, secrets, secrets.hash(serviceToken), limits, metrics, internalPort),
                        UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    static class TokenFilter extends OncePerRequestFilter {
        /** Health and metrics: GET, private port, loopback caller. They expose no secret nor identifier. */
        static final String[] OPERATIONS = {"/actuator/health", "/actuator/prometheus"};
        private final DeviceRepository devices;
        private final DeviceSecrets secrets;
        private final byte[] serviceHash;
        private final IngressLimits limits;
        private final IngressMetrics metrics;
        private final int internalPort;

        TokenFilter(DeviceRepository devices, DeviceSecrets secrets, String serviceHash, IngressLimits limits,
                    IngressMetrics metrics, int internalPort) {
            this.devices = devices;
            this.secrets = secrets;
            this.serviceHash = serviceHash.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
            this.limits = limits;
            this.metrics = metrics;
            this.internalPort = internalPort;
        }

        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws IOException, ServletException {
            String path = request.getRequestURI().substring(request.getContextPath().length());
            boolean measuring = path.equals("/api/v1/measurements") && request.getLocalPort() != internalPort;
            try {
                if (operations(request, path)) { chain.doFilter(request, response); return; }
                boolean internal = path.startsWith("/internal/v1/") && request.getLocalPort() == internalPort;
                boolean ingestion = path.equals("/api/v1/measurements") && "POST".equals(request.getMethod())
                        && request.getLocalPort() != internalPort;
                // This port boundary uses the real socket, never Host / Forwarded headers.
                if (!internal && !ingestion) { response.setStatus(404); return; }
                if (ingestion && !limits.acceptPeer(request.getRemoteAddr())) { rateLimited(response); return; }
                if (ingestion && request.getQueryString() != null) { response.setStatus(400); return; }
                var headers = Collections.list(request.getHeaders("Authorization"));
                if (headers.size() != 1 || !headers.getFirst().startsWith("Bearer ") || headers.getFirst().length() > 256) {
                    response.setStatus(401); return;
                }
                String token = headers.getFirst().substring(7);
                if (!internal && !token.matches("[A-Za-z0-9_-]{43}")) { response.setStatus(401); return; }
                if (internal && !MessageDigest.isEqual(serviceHash,
                        secrets.hash(token).getBytes(java.nio.charset.StandardCharsets.US_ASCII))) {
                    response.setStatus(401); return;
                }
                HttpServletRequest bounded = request;
                if ("POST".equals(request.getMethod()) || "PUT".equals(request.getMethod())) {
                    if (request.getContentLengthLong() > 4096) { response.setStatus(413); return; }
                    byte[] body = request.getInputStream().readNBytes(4097);
                    if (body.length > 4096) {
                        response.setStatus(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
                        return;
                    }
                    if (body.length > 0 && (request.getContentType() == null
                            || !request.getContentType().matches("(?i)application/json(?:\\s*;.*)?"))) {
                        response.setStatus(415); return;
                    }
                    bounded = new BoundedJsonRequest(request, body);
                }
                authenticate(path, token);
                var authentication = SecurityContextHolder.getContext().getAuthentication();
                if (ingestion && authentication != null && !limits.acceptDevice((DeviceIdentity) authentication.getPrincipal())) {
                    rateLimited(response); return;
                }
                chain.doFilter(bounded, response);
            } finally {
                SecurityContextHolder.clearContext();
                if (measuring) metrics.record("http", response.getStatus(), false);
            }
        }

        private boolean operations(HttpServletRequest request, String path) {
            return "GET".equals(request.getMethod()) && request.getLocalPort() == internalPort
                    && java.util.Arrays.asList(OPERATIONS).contains(path) && request.getQueryString() == null
                    && loopback(request.getRemoteAddr());
        }

        private static boolean loopback(String address) {
            return "127.0.0.1".equals(address) || "0:0:0:0:0:0:0:1".equals(address) || "::1".equals(address);
        }

        private void rateLimited(HttpServletResponse response) throws IOException {
            response.setHeader("Retry-After", "60");
            response.setStatus(429);
        }

        private void authenticate(String path, String token) {
            String hash = secrets.hash(token);
            if (path.startsWith("/internal/v1/")) {
                if (MessageDigest.isEqual(serviceHash, hash.getBytes(java.nio.charset.StandardCharsets.US_ASCII))) {
                    setIdentity("baitly-pms", "ADMIN");
                }
                return;
            }
            if (path.equals("/api/v1/measurements")) {
                devices.authenticate(hash).ifPresent(device -> setIdentity(DeviceIdentity.http(device.id(), hash), "DEVICE"));
            }
        }

        private void setIdentity(Object identity, String role) {
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(identity, null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + role))));
            SecurityContextHolder.setContext(context);
        }
    }
}
