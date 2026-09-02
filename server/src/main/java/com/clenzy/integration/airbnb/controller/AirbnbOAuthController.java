package com.clenzy.integration.airbnb.controller;

import com.clenzy.integration.airbnb.dto.AirbnbConnectionStatusDto;
import com.clenzy.integration.airbnb.model.AirbnbConnection;
import com.clenzy.integration.airbnb.service.AirbnbListingMappingQueryService;
import com.clenzy.integration.airbnb.service.AirbnbOAuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Controller OAuth 2.0 pour l'integration Airbnb.
 *
 * Endpoints :
 * - GET  /api/airbnb/connect    : redirige vers Airbnb pour l'autorisation
 * - GET  /api/airbnb/callback   : callback OAuth (echange code -> token)
 * - POST /api/airbnb/disconnect : deconnecte le compte Airbnb
 * - GET  /api/airbnb/status     : statut de la connexion
 */
@RestController
@RequestMapping("/api/airbnb")
@Tag(name = "Airbnb OAuth", description = "Gestion de la connexion OAuth Airbnb")
/*
 * Connecter, deconnecter ou lire l'etat d'un canal de distribution est une
 * action d'administration. L'onglet « Integrations » qui la porte est deja
 * reserve a SUPER_ADMIN / SUPER_MANAGER cote interface — l'API ne l'etait pas,
 * et retombait sur l'attrape-tout `/api/**` de SecurityConfigProd, qui liste
 * TOUS les roles : un HOUSEKEEPER authentifie pouvait deconnecter le compte
 * Airbnb. Meme portee que ChannelConnectionController pour les memes gestes.
 *
 * `/callback` fait exception : c'est Airbnb qui y redirige le navigateur, sans
 * jeton. Il figure a ce titre dans les permitAll() de SecurityConfigProd.
 */
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class AirbnbOAuthController {

    private static final Logger log = LoggerFactory.getLogger(AirbnbOAuthController.class);

    private final AirbnbOAuthService oAuthService;
    private final AirbnbListingMappingQueryService listingMappingQueryService;

    public AirbnbOAuthController(AirbnbOAuthService oAuthService,
                                  AirbnbListingMappingQueryService listingMappingQueryService) {
        this.oAuthService = oAuthService;
        this.listingMappingQueryService = listingMappingQueryService;
    }

    @GetMapping("/connect")
    @Operation(summary = "Initier la connexion OAuth Airbnb",
            description = "Retourne l'URL de redirection vers la page d'autorisation Airbnb")
    public ResponseEntity<Map<String, String>> connect(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();

        // Verifier si deja connecte
        if (oAuthService.isConnected(userId)) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "already_connected");
            response.put("message", "Votre compte Airbnb est deja connecte");
            return ResponseEntity.ok(response);
        }

        try {
            String authUrl = oAuthService.getAuthorizationUrl(userId);
            Map<String, String> response = new HashMap<>();
            response.put("authorization_url", authUrl);
            response.put("status", "redirect");
            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "configuration_missing");
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/callback")
    // Redirection du navigateur depuis Airbnb : aucun jeton n'accompagne
    // l'appel. Deja liste dans les permitAll() de SecurityConfigProd — la
    // securite vient du `state` OAuth (UUID en Redis, TTL 10 min, consomme une
    // seule fois), pas du role de l'appelant.
    @PreAuthorize("permitAll()")
    @Operation(summary = "Callback OAuth Airbnb",
            description = "Recoit le code d'autorisation et l'echange contre un token")
    public ResponseEntity<Map<String, Object>> callback(
            @RequestParam("code") String code,
            @RequestParam("state") String state) {
        try {
            // Valider le state CSRF et recuperer le userId associe
            String userId = oAuthService.validateAndConsumeState(state);
            AirbnbConnection connection = oAuthService.exchangeCodeForToken(code, userId);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "connected");
            response.put("message", "Connexion Airbnb etablie avec succes");
            response.put("airbnb_user_id", connection.getAirbnbUserId());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Erreur callback OAuth Airbnb: {}", e.getMessage());
            Map<String, Object> error = new HashMap<>();
            error.put("status", "error");
            error.put("message", "Echec de la connexion Airbnb");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    @PostMapping("/disconnect")
    @Operation(summary = "Deconnecter le compte Airbnb",
            description = "Revoque le token OAuth et supprime la connexion")
    public ResponseEntity<Map<String, String>> disconnect(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();

        try {
            oAuthService.revokeToken(userId);

            Map<String, String> response = new HashMap<>();
            response.put("status", "disconnected");
            response.put("message", "Compte Airbnb deconnecte");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Erreur deconnexion Airbnb: {}", e.getMessage());
            Map<String, String> error = new HashMap<>();
            error.put("status", "error");
            error.put("message", "Erreur lors de la deconnexion");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    @GetMapping("/status")
    @Operation(summary = "Statut de la connexion Airbnb",
            description = "Retourne le statut actuel de la connexion OAuth et le nombre de listings lies")
    public ResponseEntity<AirbnbConnectionStatusDto> status(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();

        AirbnbConnectionStatusDto statusDto = new AirbnbConnectionStatusDto();

        Optional<AirbnbConnection> connectionOpt = oAuthService.getConnectionStatus(userId);
        if (connectionOpt.isPresent()) {
            AirbnbConnection connection = connectionOpt.get();
            statusDto.setConnected(connection.getStatus() == AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
            statusDto.setAirbnbUserId(connection.getAirbnbUserId());
            statusDto.setStatus(connection.getStatus().name());
            statusDto.setConnectedAt(connection.getConnectedAt());
            statusDto.setLastSyncAt(connection.getLastSyncAt());
            statusDto.setScopes(connection.getScopes());
            statusDto.setErrorMessage(connection.getErrorMessage());

            // Compter les listings lies
            statusDto.setLinkedListingsCount(listingMappingQueryService.countSyncEnabledMappings());
        } else {
            statusDto.setConnected(false);
            statusDto.setStatus("NOT_CONNECTED");
            statusDto.setLinkedListingsCount(0);
        }

        return ResponseEntity.ok(statusDto);
    }
}
