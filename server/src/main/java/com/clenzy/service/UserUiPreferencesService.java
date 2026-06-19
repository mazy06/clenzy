package com.clenzy.service;

import com.clenzy.model.UserUiPreference;
import com.clenzy.repository.UserUiPreferenceRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Preferences UI generiques par utilisateur (key-value JSONB).
 * Logique deplacee depuis {@code UserUiPreferencesController}
 * (refactor T-ARCH-01 — controller mince).
 *
 * <p>Toutes les operations sont scopees au {@code keycloakId} de l'utilisateur
 * authentifie (sub du JWT) — une preference UI est strictement personnelle,
 * pas de scope organisation.</p>
 */
@Service
public class UserUiPreferencesService {

    private static final Logger log = LoggerFactory.getLogger(UserUiPreferencesService.class);

    private final UserUiPreferenceRepository repository;
    private final ObjectMapper objectMapper;

    public UserUiPreferencesService(UserUiPreferenceRepository repository,
                                    ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    /** Map { key -> value JSON } de toutes les preferences de l'utilisateur. */
    @Transactional(readOnly = true)
    public Map<String, JsonNode> getAllForUser(String keycloakId) {
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

    /**
     * Cree ou remplace la preference pour la cle donnee (valeur JSON deja serialisee).
     * Upsert ATOMIQUE (INSERT ... ON CONFLICT) : evite la race check-then-act qui faisait
     * echouer en 500 deux PUT concurrents de la meme cle (violation de la contrainte unique,
     * cf. regle CLAUDE.md #8). Re-lecture pour renvoyer l'entite persistee.
     */
    @Transactional
    public UserUiPreference upsert(String keycloakId, String key, String serializedValue) {
        repository.upsertPreference(keycloakId, key, serializedValue);
        return repository.findByKeycloakIdAndPrefKey(keycloakId, key)
                .orElseThrow(() -> new IllegalStateException(
                        "Preference UI introuvable apres upsert (key=" + key + ")"));
    }

    @Transactional
    public void delete(String keycloakId, String key) {
        repository.deleteByKeycloakIdAndPrefKey(keycloakId, key);
    }
}
