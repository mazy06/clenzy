package com.clenzy.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth Proxy", description = "Proxy d'authentification via Keycloak (Direct Access Grants)")
public class AuthProxyController {

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
            return ResponseEntity.status(resp.getStatusCode()).headers(passThrough(resp.getHeaders())).body(resp.getBody());
        } catch (Exception ex) {
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
}


