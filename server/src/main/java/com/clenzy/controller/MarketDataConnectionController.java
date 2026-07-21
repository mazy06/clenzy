package com.clenzy.controller;

import com.clenzy.model.MarketDataConnection;
import com.clenzy.service.marketdata.MarketDataConnectionService;
import com.clenzy.service.marketdata.MarketDataProviderType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Connexions fournisseurs de données de marché (Réglages → Intégrations →
 * Intelligence de marché). Portée PLATEFORME (l'abonnement est celui de Baitly,
 * l'ingestion est globale) → réservé au staff plateforme.
 *
 * <p>Le « connect » enregistre la clé (chiffrée) après validation de forme —
 * la validation par appel réel au vendeur sera ajoutée à l'activation du compte
 * (schéma de réponse à confirmer, cf. RestMarketDataProvider). Shapes alignées
 * sur le composant client générique {@code ApiKeyConnectionCard}.</p>
 */
@RestController
@RequestMapping("/api/integrations/market-data")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class MarketDataConnectionController {

    private static final int MIN_API_KEY_LENGTH = 8;

    private final MarketDataConnectionService connectionService;

    public MarketDataConnectionController(MarketDataConnectionService connectionService) {
        this.connectionService = connectionService;
    }

    /** Corps du connect — mêmes champs que le composant générique client. */
    public record ConnectRequest(String serverUrl, String accountIdentifier, String apiKey) {
    }

    public record StatusDto(boolean connected, String providerType, String serverUrl,
                            String status, String connectedAt) {

        static StatusDto from(MarketDataConnection connection) {
            return new StatusDto(connection.isEnabled(), connection.getProvider(),
                    connection.getBaseUrl(), connection.isEnabled() ? "CONNECTED" : "DISABLED",
                    connection.getCreatedAt() != null ? connection.getCreatedAt().toString() : null);
        }

        static StatusDto notConnected(MarketDataProviderType provider) {
            return new StatusDto(false, provider.name(), null, "NOT_CONNECTED", null);
        }
    }

    @PostMapping("/{provider}/connect")
    public ResponseEntity<?> connect(@PathVariable MarketDataProviderType provider,
                                     @RequestBody ConnectRequest request) {
        if (provider != MarketDataProviderType.AIRBTICS && provider != MarketDataProviderType.AIRROI) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "unsupported_provider",
                    "message", "Seules les sources externes (AIRBTICS, AIRROI) se connectent par clé API."));
        }
        if (request.apiKey() == null || request.apiKey().trim().length() < MIN_API_KEY_LENGTH) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "invalid_api_key",
                    "message", "Clé API invalide (longueur minimale " + MIN_API_KEY_LENGTH + ")."));
        }
        final MarketDataConnection saved = connectionService.saveConnection(
                provider, request.apiKey().trim(), request.serverUrl());
        return ResponseEntity.ok(StatusDto.from(saved));
    }

    @GetMapping("/{provider}/status")
    public StatusDto status(@PathVariable MarketDataProviderType provider) {
        return connectionService.getConnection(provider)
                .map(StatusDto::from)
                .orElseGet(() -> StatusDto.notConnected(provider));
    }

    @PostMapping("/{provider}/disconnect")
    public Map<String, Object> disconnect(@PathVariable MarketDataProviderType provider) {
        return Map.of(
                "disconnected", connectionService.disconnect(provider),
                "provider", provider.name());
    }
}
