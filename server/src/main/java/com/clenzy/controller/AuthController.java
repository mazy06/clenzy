package com.clenzy.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.time.LocalDateTime;
import com.clenzy.model.User;
import com.clenzy.service.UserService;
import com.clenzy.service.PermissionService;
import com.clenzy.service.AuditLogService;
import com.clenzy.model.UserRole;
import com.clenzy.dto.RolePermissionsDto;

@RestController
@RequestMapping("/api")
@Tag(name = "Auth", description = "Endpoints d'authentification (Keycloak JWT)")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    // Configuration Keycloak externalisee via variables d'environnement
    @Value("${keycloak.auth-server-url:http://clenzy-keycloak:8080}")
    private String keycloakUrl;

    @Value("${keycloak.realm:clenzy}")
    private String realm;

    @Value("${KEYCLOAK_CLIENT_ID:clenzy-web}")
    private String clientId;

    @Value("${keycloak.credentials.secret:}")
    private String clientSecret;

    private final UserService userService;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;

    public AuthController(UserService userService, PermissionService permissionService, AuditLogService auditLogService) {
        this.userService = userService;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
    }

    @PostMapping("/auth/login")
    @Operation(summary = "Authentification utilisateur via Keycloak")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        if (username == null || username.isBlank()) {
            // Backward/forward compat: some clients send email instead of username
            username = credentials.get("email");
        }

        try {
            String password = credentials.get("password");

            if (username == null || username.isBlank() || password == null || password.isBlank()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "missing_credentials");
                error.put("error_description", "Username (or email) and password are required");
                return ResponseEntity.badRequest().body(error);
            }

            // Appel a Keycloak pour obtenir le token
            RestTemplate restTemplate = new RestTemplate();
            String tokenUrl = keycloakUrl + "/realms/" + realm + "/protocol/openid-connect/token";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("username", username);
            params.add("password", password);
            params.add("grant_type", "password");
            params.add("client_id", clientId);
            if (clientSecret != null && !clientSecret.isEmpty()) {
                params.add("client_secret", clientSecret);
            }

            ResponseEntity<Map> keycloakResponse = restTemplate.postForEntity(tokenUrl, params, Map.class);

            if (keycloakResponse.getStatusCode().is2xxSuccessful() && keycloakResponse.getBody() != null) {
                Map<String, Object> tokenData = keycloakResponse.getBody();

                Map<String, Object> response = new HashMap<>();
                response.put("access_token", tokenData.get("access_token"));
                response.put("refresh_token", tokenData.get("refresh_token"));
                response.put("id_token", tokenData.get("id_token"));
                response.put("expires_in", tokenData.get("expires_in"));
                response.put("token_type", tokenData.get("token_type"));

                // Audit : connexion reussie
                auditLogService.logLogin(username, username);

                return ResponseEntity.ok(response);
            } else {
                // Audit : connexion echouee
                auditLogService.logLoginFailed(username, "Invalid credentials");

                Map<String, Object> error = new HashMap<>();
                error.put("error", "authentication_failed");
                error.put("error_description", "Invalid credentials");
                return ResponseEntity.status(401).body(error);
            }

        } catch (Exception e) {
            // Audit : connexion echouee
            auditLogService.logLoginFailed(username != null ? username : "unknown", e.getMessage());

            Map<String, Object> error = new HashMap<>();
            error.put("error", "server_error");
            error.put("error_description", "Internal server error");
            log.error("Erreur lors du login: {}", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @GetMapping("/me")
    @Operation(summary = "Informations sur l'utilisateur authentifie")
    public Map<String, Object> me(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) return Map.of("authenticated", false);

        try {
            Map<String, Object> claims = new HashMap<>();
            claims.put("authenticated", true);
            claims.put("subject", jwt.getSubject());
            claims.put("email", jwt.getClaim("email"));
            claims.put("preferred_username", jwt.getClaim("preferred_username"));
            claims.put("given_name", jwt.getClaim("given_name"));
            claims.put("family_name", jwt.getClaim("family_name"));

            Object realmAccess = jwt.getClaim("realm_access");
            if (realmAccess instanceof Map) {
                Map<String, Object> realmAccessMap = (Map<String, Object>) realmAccess;
                Object roles = realmAccessMap.get("roles");
                if (roles instanceof List) {
                    claims.put("realm_access", Map.of("roles", roles));
                }
            }

            String keycloakId = jwt.getSubject();
            User user = userService.findByKeycloakId(keycloakId);

            // Auto-liaison : si l'utilisateur n'est pas trouve par keycloakId,
            // chercher par email et lier automatiquement le keycloakId
            if (user == null) {
                String email = jwt.getClaim("email");
                if (email != null && !email.isBlank()) {
                    user = userService.findByEmail(email);
                    if (user != null) {
                        log.info("/me - Auto-liaison keycloakId {} -> utilisateur {} (email: {})",
                                keycloakId, user.getId(), email);
                        userService.updateKeycloakId(user.getId(), keycloakId);
                    } else {
                        log.warn("/me - Aucun utilisateur trouve ni par keycloakId ({}) ni par email ({})",
                                keycloakId, email);
                    }
                }
            }

            if (user != null) {
                claims.put("id", user.getId());
                claims.put("firstName", user.getFirstName());
                claims.put("lastName", user.getLastName());
                claims.put("role", user.getRole().name());
                claims.put("status", user.getStatus().name());
                claims.put("emailVerified", user.isEmailVerified() != null ? user.isEmailVerified() : false);
                claims.put("phoneVerified", user.isPhoneVerified() != null ? user.isPhoneVerified() : false);
                claims.put("lastLogin", user.getLastLogin());
                claims.put("createdAt", user.getCreatedAt());
                claims.put("updatedAt", user.getUpdatedAt());
                claims.put("forfait", user.getForfait());

                RolePermissionsDto rolePermissions = permissionService.getRolePermissions(user.getRole().name());
                List<String> permissions = rolePermissions.getPermissions();

                // Fallback : si le cache retourne une liste vide, recharger depuis la base
                if (permissions == null || permissions.isEmpty()) {
                    log.warn("/me - Cache permissions vide pour le role {}, rechargement depuis la base...",
                            user.getRole().name());
                    permissions = permissionService.getUserPermissionsForSync(keycloakId);
                }

                // Fallback ultime pour ADMIN : si toujours vide, injecter toutes les permissions
                if ((permissions == null || permissions.isEmpty()) && user.getRole() == UserRole.ADMIN) {
                    log.warn("/me - FALLBACK ADMIN : injection de toutes les permissions disponibles");
                    permissions = permissionService.getAllAvailablePermissions();
                }

                claims.put("permissions", permissions);

                log.info("/me - Utilisateur: {} role: {} permissions: {} ({})",
                        user.getEmail(), user.getRole().name(), permissions.size(),
                        permissions.isEmpty() ? "VIDE" : String.join(",", permissions));
            } else {
                log.warn("/me - Utilisateur non trouve pour keycloakId: {} et email: {}",
                        keycloakId, jwt.getClaim("email"));
                // Retourner les infos de base du JWT meme sans correspondance en base
                claims.put("permissions", List.of());
                claims.put("role", "UNKNOWN");
            }

            return claims;

        } catch (Exception e) {
            log.error("Erreur dans /me: {}", e.getMessage(), e);
            return Map.of("authenticated", true, "error", "Erreur lors de la recuperation des donnees");
        }
    }

    @GetMapping("/auth/debug-permissions")
    @Operation(summary = "Diagnostic des permissions pour le debug en production")
    public ResponseEntity<Map<String, Object>> debugPermissions(@AuthenticationPrincipal Jwt jwt) {
        Map<String, Object> debug = new HashMap<>();

        if (jwt == null) {
            debug.put("error", "Aucun JWT");
            return ResponseEntity.status(401).body(debug);
        }

        debug.put("jwt_subject", jwt.getSubject());
        debug.put("jwt_email", jwt.getClaim("email"));
        debug.put("jwt_preferred_username", jwt.getClaim("preferred_username"));

        Object realmAccess = jwt.getClaim("realm_access");
        if (realmAccess instanceof Map) {
            debug.put("jwt_realm_access", realmAccess);
        } else {
            debug.put("jwt_realm_access", "ABSENT");
        }

        String keycloakId = jwt.getSubject();
        User userByKc = userService.findByKeycloakId(keycloakId);
        debug.put("user_found_by_keycloakId", userByKc != null);

        String email = jwt.getClaim("email");
        User userByEmail = (email != null) ? userService.findByEmail(email) : null;
        debug.put("user_found_by_email", userByEmail != null);

        if (userByKc != null) {
            debug.put("user_id", userByKc.getId());
            debug.put("user_role", userByKc.getRole().name());
            debug.put("user_keycloakId", userByKc.getKeycloakId());

            RolePermissionsDto rolePerms = permissionService.getRolePermissions(userByKc.getRole().name());
            debug.put("permissions_from_cache", rolePerms.getPermissions());
            debug.put("permissions_from_cache_count", rolePerms.getPermissions() != null ? rolePerms.getPermissions().size() : 0);

            List<String> dbPerms = permissionService.getUserPermissionsForSync(keycloakId);
            debug.put("permissions_from_db", dbPerms);
            debug.put("permissions_from_db_count", dbPerms != null ? dbPerms.size() : 0);

            List<String> allPerms = permissionService.getAllAvailablePermissions();
            debug.put("all_available_permissions_count", allPerms != null ? allPerms.size() : 0);
        } else if (userByEmail != null) {
            debug.put("user_by_email_id", userByEmail.getId());
            debug.put("user_by_email_role", userByEmail.getRole().name());
            debug.put("user_by_email_keycloakId", userByEmail.getKeycloakId());
            debug.put("mismatch", "User exists by email but keycloakId does not match JWT subject");
        } else {
            debug.put("user_status", "NOT_FOUND");
            debug.put("suggestion", "Run POST /api/sync/force-sync-all-to-keycloak to sync users");
        }

        return ResponseEntity.ok(debug);
    }

    @PostMapping("/logout")
    @Operation(summary = "Deconnexion de l'utilisateur")
    public ResponseEntity<Map<String, String>> logout(@AuthenticationPrincipal Jwt jwt,
                                                     @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        try {
            if (jwt != null && authorization != null && authorization.startsWith("Bearer ")) {
                String token = authorization.substring(7);

                // Revoquer le token cote Keycloak
                revokeToken(token);

                // Audit : deconnexion
                auditLogService.logLogout(jwt.getSubject(), jwt.getClaimAsString("email"));

                Map<String, String> response = new HashMap<>();
                response.put("message", "Deconnexion reussie");
                response.put("status", "success");

                return ResponseEntity.ok(response);
            } else {
                Map<String, String> response = new HashMap<>();
                response.put("message", "Token invalide");
                response.put("status", "error");

                return ResponseEntity.badRequest().body(response);
            }
        } catch (Exception e) {
            Map<String, String> response = new HashMap<>();
            response.put("message", "Erreur lors de la deconnexion: " + e.getMessage());
            response.put("status", "error");

            return ResponseEntity.internalServerError().body(response);
        }
    }

    private void revokeToken(String token) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            String revokeUrl = keycloakUrl + "/realms/" + realm + "/protocol/openid-connect/logout";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("client_id", clientId);
            if (clientSecret != null && !clientSecret.isEmpty()) {
                params.add("client_secret", clientSecret);
            }
            params.add("token", token);
            params.add("token_type_hint", "access_token");

            restTemplate.postForEntity(revokeUrl, params, String.class);

        } catch (Exception e) {
            log.error("Erreur lors de la revocation du token Keycloak: {}", e.getMessage());
        }
    }
}
