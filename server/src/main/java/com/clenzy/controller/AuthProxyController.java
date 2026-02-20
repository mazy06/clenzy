package com.clenzy.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth Proxy", description = "Proxy d'authentification via Keycloak (Direct Access Grants)")
public class AuthProxyController {

    private static final Logger log = LoggerFactory.getLogger(AuthProxyController.class);

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final long LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

    private final Map<String, AccountLockout> lockouts = new ConcurrentHashMap<>();
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${KEYCLOAK_TOKEN_URI:http://keycloak:8080/realms/clenzy/protocol/openid-connect/token}")
    private String tokenUri;

    @Value("${KEYCLOAK_CLIENT_ID:clenzy-web}")
    private String clientId;

    @Value("${KEYCLOAK_CLIENT_SECRET:}")
    private String clientSecret;

    public record LoginRequest(String username, String password) {}
    public record LogoutRequest(String refreshToken) {}

    @PostMapping(value = "/login", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Connexion avec identifiants (proxy)")
    public ResponseEntity<?> login(@RequestBody LoginRequest body) {
        if (body == null || body.username() == null || body.password() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "username et password requis"));
        }

        String username = body.username().toLowerCase().trim();

        // Account lockout check
        AccountLockout lockout = lockouts.get(username);
        if (lockout != null && lockout.isLocked()) {
            long remainingSec = lockout.getRemainingLockSeconds();
            log.warn("Compte verrouille pour '{}' - {} tentatives echouees, unlock dans {}s", username, lockout.failedAttempts, remainingSec);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(remainingSec))
                    .body(Map.of("error", "account_locked",
                            "message", "Compte temporairement verrouille apres " + MAX_FAILED_ATTEMPTS + " tentatives echouees. Reessayez dans " + remainingSec + " secondes."));
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "password");
        form.add("client_id", clientId);
        if (clientSecret != null && !clientSecret.isBlank()) {
            form.add("client_secret", clientSecret);
        }
        form.add("username", body.username());
        form.add("password", body.password());

        HttpEntity<MultiValueMap<String, String>> req = new HttpEntity<>(form, headers);
        try {
            ResponseEntity<String> resp = restTemplate.postForEntity(tokenUri, req, String.class);
            // Login successful - reset failure counter
            lockouts.remove(username);
            return ResponseEntity.status(resp.getStatusCode()).headers(passThrough(resp.getHeaders())).body(resp.getBody());
        } catch (Exception ex) {
            // Login failed - increment failure counter
            AccountLockout acctLockout = lockouts.computeIfAbsent(username, k -> new AccountLockout());
            acctLockout.recordFailure();
            int remaining = MAX_FAILED_ATTEMPTS - acctLockout.failedAttempts;
            if (remaining > 0) {
                log.warn("Tentative de connexion echouee pour '{}' ({}/{})", username, acctLockout.failedAttempts, MAX_FAILED_ATTEMPTS);
            } else {
                log.warn("Compte '{}' verrouille apres {} tentatives echouees", username, MAX_FAILED_ATTEMPTS);
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "invalid_credentials", "message", ex.getMessage()));
        }
    }

    @PostMapping(value = "/logout", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Déconnexion (révocation du refresh token)")
    public ResponseEntity<?> logout(@RequestBody LogoutRequest body) {
        String logoutUri = tokenUri.replace("/token", "/logout");
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", clientId);
        if (clientSecret != null && !clientSecret.isBlank()) {
            form.add("client_secret", clientSecret);
        }
        if (body != null && body.refreshToken() != null) {
            form.add("refresh_token", body.refreshToken());
        }
        try {
            ResponseEntity<String> resp = restTemplate.postForEntity(logoutUri, new HttpEntity<>(form, headers), String.class);
            return ResponseEntity.status(resp.getStatusCode()).build();
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.OK).build();
        }
    }

    private HttpHeaders passThrough(HttpHeaders source) {
        HttpHeaders dest = new HttpHeaders();
        if (source.getContentType() != null) dest.setContentType(source.getContentType());
        return dest;
    }

    /**
     * Suivi des tentatives echouees par compte.
     * Verrouillage pendant 15 minutes apres 5 echecs consecutifs.
     */
    static class AccountLockout {
        volatile int failedAttempts;
        volatile long lockedAt;

        void recordFailure() {
            failedAttempts++;
            if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
                lockedAt = System.currentTimeMillis();
            }
        }

        boolean isLocked() {
            if (failedAttempts < MAX_FAILED_ATTEMPTS) return false;
            if (System.currentTimeMillis() - lockedAt > LOCKOUT_DURATION_MS) {
                // Lockout expired - reset
                failedAttempts = 0;
                lockedAt = 0;
                return false;
            }
            return true;
        }

        long getRemainingLockSeconds() {
            long elapsed = System.currentTimeMillis() - lockedAt;
            return Math.max(1, (LOCKOUT_DURATION_MS - elapsed) / 1000);
        }
    }
}


