package com.clenzy.controller;

import com.clenzy.service.LoginProtectionService;
import com.clenzy.service.LoginProtectionService.LoginStatus;
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

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth Proxy", description = "Proxy d'authentification via Keycloak (Direct Access Grants)")
public class AuthProxyController {

    private static final Logger log = LoggerFactory.getLogger(AuthProxyController.class);

    private final LoginProtectionService loginProtectionService;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${KEYCLOAK_TOKEN_URI:http://keycloak:8080/realms/clenzy/protocol/openid-connect/token}")
    private String tokenUri;

    @Value("${KEYCLOAK_CLIENT_ID:clenzy-web}")
    private String clientId;

    @Value("${KEYCLOAK_CLIENT_SECRET:}")
    private String clientSecret;

    public AuthProxyController(LoginProtectionService loginProtectionService) {
        this.loginProtectionService = loginProtectionService;
    }

    public record LoginRequest(String username, String password, String captchaToken) {}
    public record LogoutRequest(String refreshToken) {}

    @PostMapping(value = "/login", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Connexion avec identifiants (proxy)")
    public ResponseEntity<?> login(@RequestBody LoginRequest body) {
        if (body == null || body.username() == null || body.password() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "username et password requis"));
        }

        String username = body.username().toLowerCase().trim();

        // ─── Account lockout check (Redis-backed) ─────────────────
        LoginStatus status = loginProtectionService.checkLoginAllowed(username);
        if (status.isLocked()) {
            log.warn("Compte verrouille pour '{}', unlock dans {}s", username, status.remainingSeconds());
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(status.remainingSeconds()))
                    .body(Map.of(
                            "error", "account_locked",
                            "message", "Compte temporairement verrouille. Reessayez dans " + status.remainingSeconds() + " secondes.",
                            "retryAfter", status.remainingSeconds()
                    ));
        }

        // ─── CAPTCHA validation (si requis apres N tentatives) ────
        if (status.captchaRequired()) {
            if (body.captchaToken() == null || body.captchaToken().isBlank()) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of(
                                "error", "captcha_required",
                                "message", "Verification CAPTCHA requise apres plusieurs tentatives echouees.",
                                "captchaRequired", true
                        ));
            }
            if (!loginProtectionService.validateCaptchaToken(body.captchaToken())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of(
                                "error", "captcha_invalid",
                                "message", "Verification CAPTCHA echouee. Veuillez reessayer."
                        ));
            }
        }

        // ─── Keycloak token exchange ──────────────────────────────
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
            // Login successful — reset failure counter in Redis
            loginProtectionService.recordSuccessfulLogin(username);
            return ResponseEntity.status(resp.getStatusCode()).headers(passThrough(resp.getHeaders())).body(resp.getBody());
        } catch (Exception ex) {
            // Login failed — increment failure counter in Redis
            loginProtectionService.recordFailedAttempt(username);

            // Verifier si le CAPTCHA est maintenant requis apres cet echec
            LoginStatus updatedStatus = loginProtectionService.checkLoginAllowed(username);
            Map<String, Object> errorBody = new HashMap<>();
            errorBody.put("error", "invalid_credentials");
            errorBody.put("message", "Identifiants invalides.");
            if (updatedStatus.captchaRequired()) {
                errorBody.put("captchaRequired", true);
            }
            if (updatedStatus.isLocked()) {
                errorBody.put("accountLocked", true);
                errorBody.put("retryAfter", updatedStatus.remainingSeconds());
            }

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorBody);
        }
    }

    @PostMapping(value = "/logout", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Deconnexion (revocation du refresh token)")
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
}
