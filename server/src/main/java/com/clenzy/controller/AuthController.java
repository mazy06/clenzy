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

import java.util.HashMap;
import java.util.Map;
import java.util.List;
import com.clenzy.model.User;
import com.clenzy.service.UserService;
import com.clenzy.service.PermissionService;
import com.clenzy.model.UserRole;

@RestController
@RequestMapping("/api")
@Tag(name = "Auth", description = "Endpoints d'authentification (Keycloak JWT)")
public class AuthController {

    // Configuration Keycloak hardcodée pour Docker
    private final String keycloakUrl = "http://clenzy-keycloak:8080";
    private final String realm = "clenzy";
    private final String clientId = "clenzy-web";
    private final String clientSecret = "";

    private final UserService userService;
    private final PermissionService permissionService;

    public AuthController(UserService userService, PermissionService permissionService) {
        this.userService = userService;
        this.permissionService = permissionService;
    }

    @PostMapping("/auth/login")
    @Operation(summary = "Authentification utilisateur via Keycloak")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> credentials) {
        try {
            String username = credentials.get("username");
            String password = credentials.get("password");

            if (username == null || password == null) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "missing_credentials");
                error.put("error_description", "Username and password are required");
                return ResponseEntity.badRequest().body(error);
            }

            // Appel à Keycloak pour obtenir le token
            RestTemplate restTemplate = new RestTemplate();
            
            // URL de token Keycloak
            String tokenUrl = keycloakUrl + "/realms/" + realm + "/protocol/openid-connect/token";
            
            // Headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            
            // Paramètres de connexion
            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("username", username);
            params.add("password", password);
            params.add("grant_type", "password");
            params.add("client_id", clientId);
            if (clientSecret != null && !clientSecret.isEmpty()) {
                params.add("client_secret", clientSecret);
            }
            
            // Appel à Keycloak
            ResponseEntity<Map> keycloakResponse = restTemplate.postForEntity(tokenUrl, params, Map.class);
            
            if (keycloakResponse.getStatusCode().is2xxSuccessful() && keycloakResponse.getBody() != null) {
                Map<String, Object> tokenData = keycloakResponse.getBody();
                
                // Retourner les tokens
                Map<String, Object> response = new HashMap<>();
                response.put("access_token", tokenData.get("access_token"));
                response.put("refresh_token", tokenData.get("refresh_token"));
                response.put("id_token", tokenData.get("id_token"));
                response.put("expires_in", tokenData.get("expires_in"));
                response.put("token_type", tokenData.get("token_type"));
                
                return ResponseEntity.ok(response);
            } else {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "authentication_failed");
                error.put("error_description", "Invalid credentials");
                return ResponseEntity.status(401).body(error);
            }
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "server_error");
            error.put("error_description", "Internal server error: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @GetMapping("/me")
    @Operation(summary = "Informations sur l'utilisateur authentifié")
    public Map<String, Object> me(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) return Map.of("authenticated", false);
        
        try {
            // Récupérer les informations de base depuis le JWT
            Map<String, Object> claims = new HashMap<>();
            claims.put("authenticated", true);
            claims.put("subject", jwt.getSubject());
            claims.put("email", jwt.getClaim("email"));
            claims.put("preferred_username", jwt.getClaim("preferred_username"));
            claims.put("given_name", jwt.getClaim("given_name"));
            claims.put("family_name", jwt.getClaim("family_name"));
            
            // Récupérer les rôles depuis le JWT
            Object realmAccess = jwt.getClaim("realm_access");
            if (realmAccess instanceof Map) {
                Map<String, Object> realmAccessMap = (Map<String, Object>) realmAccess;
                Object roles = realmAccessMap.get("roles");
                if (roles instanceof List) {
                    claims.put("realm_access", Map.of("roles", roles));
                }
            }
            
            // Récupérer les informations complètes depuis la base métier
            String keycloakId = jwt.getSubject();
            User user = userService.findByKeycloakId(keycloakId);
            
            if (user != null) {
                // Ajouter les informations de la base métier
                claims.put("id", user.getId());
                claims.put("firstName", user.getFirstName());
                claims.put("lastName", user.getLastName());
                claims.put("role", user.getRole().name());
                claims.put("status", user.getStatus().name());
                claims.put("emailVerified", user.isEmailVerified());
                claims.put("phoneVerified", user.isPhoneVerified());
                claims.put("lastLogin", user.getLastLogin());
                claims.put("createdAt", user.getCreatedAt());
                claims.put("updatedAt", user.getUpdatedAt());
                
                // Ajouter les permissions basées sur le rôle (avec support des permissions personnalisées)
                List<String> permissions = permissionService.getUserPermissions(user.getRole().name());
                claims.put("permissions", permissions);
                
                System.out.println("🔍 /me - Utilisateur trouvé: " + user.getEmail() + " avec rôle: " + user.getRole());
                System.out.println("🔍 /me - Permissions: " + permissions);
            } else {
                System.out.println("⚠️ /me - Utilisateur non trouvé pour keycloakId: " + keycloakId);
            }
            
            return claims;
            
        } catch (Exception e) {
            System.err.println("❌ Erreur dans /me: " + e.getMessage());
            e.printStackTrace();
            return Map.of("authenticated", true, "error", "Erreur lors de la récupération des données");
        }
    }



    @PostMapping("/logout")
    @Operation(summary = "Déconnexion de l'utilisateur")
    public ResponseEntity<Map<String, String>> logout(@AuthenticationPrincipal Jwt jwt, 
                                                     @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        try {
            if (jwt != null && authorization != null && authorization.startsWith("Bearer ")) {
                String token = authorization.substring(7);
                
                // Révoquer le token côté Keycloak
                revokeToken(token);
                
                Map<String, String> response = new HashMap<>();
                response.put("message", "Déconnexion réussie");
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
            response.put("message", "Erreur lors de la déconnexion: " + e.getMessage());
            response.put("status", "error");
            
            return ResponseEntity.internalServerError().body(response);
        }
    }

    private void revokeToken(String token) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            
            // URL de révocation Keycloak
            String revokeUrl = keycloakUrl + "/realms/" + realm + "/protocol/openid-connect/logout";
            
            // Headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            
            // Paramètres de révocation
            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("client_id", clientId);
            if (clientSecret != null && !clientSecret.isEmpty()) {
                params.add("client_secret", clientSecret);
            }
            params.add("token", token);
            params.add("token_type_hint", "access_token");
            
            // Appel à Keycloak pour révoquer le token
            restTemplate.postForEntity(revokeUrl, params, String.class);
            
        } catch (Exception e) {
            // Log l'erreur mais ne pas faire échouer la déconnexion
            System.err.println("Erreur lors de la révocation du token Keycloak: " + e.getMessage());
        }
    }
}


