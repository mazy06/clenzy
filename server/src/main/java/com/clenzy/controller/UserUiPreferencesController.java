package com.clenzy.controller;

import com.clenzy.dto.UserUiPreferenceDto;
import com.clenzy.model.UserUiPreference;
import com.clenzy.repository.UserUiPreferenceRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Preferences UI generiques par utilisateur (key-value JSONB).
 *
 * <p>Remplace les usages de localStorage pour les preferences d'affichage
 * (filtres planning, zoom, density, largeur de colonnes, etc.) — permet
 * la portabilite cross-devices et cross-navigateurs.</p>
 *
 * <p>Toutes les routes sont scopees a l'utilisateur authentifie via le
 * {@code sub} du JWT Keycloak. Pas de besoin de scope organization :
 * une preference UI est strictement personnelle.</p>
 */
@RestController
@RequestMapping("/api/me/ui-preferences")
@PreAuthorize("isAuthenticated()")
@Validated
@Tag(name = "User UI Preferences",
     description = "Preferences UI generiques par utilisateur (key-value JSONB) — filtres planning, zoom, densite, etc.")
public class UserUiPreferencesController {

    private static final Logger log = LoggerFactory.getLogger(UserUiPreferencesController.class);

    /** Limite raisonnable pour eviter qu'un client malveillant ne sature la table. */
    private static final int MAX_VALUE_LENGTH = 16_384;

    private final UserUiPreferenceRepository repository;
    private final ObjectMapper objectMapper;

    public UserUiPreferencesController(UserUiPreferenceRepository repository,
                                       ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    @Operation(summary = "Liste toutes les preferences UI de l'utilisateur courant",
               description = "Retourne une map { key -> value } ou value est un JsonNode arbitraire.")
    public Map<String, JsonNode> getAll(@AuthenticationPrincipal Jwt jwt) {
        final String keycloakId = jwt.getSubject();
        final List<UserUiPreference> prefs = repository.findByKeycloakId(keycloakId);
        final Map<String, JsonNode> result = new HashMap<>(prefs.size());
        for (UserUiPreference pref : prefs) {
            try {
                result.put(pref.getPrefKey(), objectMapper.readTree(pref.getPrefValue()));
            } catch (JsonProcessingException e) {
                log.warn("Skipping unparseable pref {} for user {}: {}",
                        pref.getPrefKey(), keycloakId, e.getMessage());
            }
        }
        return result;
    }

    @PutMapping("/{key}")
    @Operation(summary = "Upsert une preference UI",
               description = "Cree ou remplace la preference pour la cle donnee. Valeur = JSON arbitraire.")
    public ResponseEntity<UserUiPreferenceDto> upsert(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable @NotBlank @Size(max = 120) String key,
            @RequestBody JsonNode value) {

        final String keycloakId = jwt.getSubject();
        final String serialized;
        try {
            serialized = objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payload JSON invalide");
        }
        if (serialized.length() > MAX_VALUE_LENGTH) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "La valeur depasse la taille maximale (" + MAX_VALUE_LENGTH + " chars)");
        }

        final UserUiPreference pref = repository.findByKeycloakIdAndPrefKey(keycloakId, key)
                .map(existing -> {
                    existing.setPrefValue(serialized);
                    return existing;
                })
                .orElseGet(() -> new UserUiPreference(keycloakId, key, serialized));

        final UserUiPreference saved = repository.save(pref);
        return ResponseEntity.ok(new UserUiPreferenceDto(saved.getPrefKey(), value));
    }

    @DeleteMapping("/{key}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprime une preference UI (retour au defaut frontend)")
    public void delete(@AuthenticationPrincipal Jwt jwt,
                       @PathVariable @NotBlank @Size(max = 120) String key) {
        final String keycloakId = jwt.getSubject();
        repository.deleteByKeycloakIdAndPrefKey(keycloakId, key);
    }
}
