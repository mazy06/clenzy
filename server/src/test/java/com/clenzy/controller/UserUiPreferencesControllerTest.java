package com.clenzy.controller;

import com.clenzy.dto.UserUiPreferenceDto;
import com.clenzy.model.UserUiPreference;
import com.clenzy.repository.UserUiPreferenceRepository;
import com.clenzy.service.UserUiPreferencesService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link UserUiPreferencesController}.
 *
 * <h2>Focus</h2>
 * <ul>
 *   <li>GET : recupere toutes les prefs de l'utilisateur (Jwt subject), parse JSON, skip les invalides</li>
 *   <li>PUT : upsert (cree ou met a jour la pref) ; renvoie DTO ; refuse payloads > MAX_VALUE_LENGTH</li>
 *   <li>DELETE : appelle deleteByKeycloakIdAndPrefKey avec les bons params</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class UserUiPreferencesControllerTest {

    @Mock
    private UserUiPreferenceRepository repository;

    @Mock
    private Jwt jwt;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private UserUiPreferencesController controller;

    private static final String KC_ID = "550e8400-e29b-41d4-a716-446655440000";

    @BeforeEach
    void setUp() {
        // Service REEL construit au-dessus du repository mocke (pattern Vague A)
        controller = new UserUiPreferencesController(
                new UserUiPreferencesService(repository, objectMapper), objectMapper);
        lenient().when(jwt.getSubject()).thenReturn(KC_ID);
    }

    // ─── GET /api/me/ui-preferences ──────────────────────────────────────

    @Test
    @DisplayName("getAll returns empty map when no preferences exist")
    void getAll_noPreferences_emptyMap() {
        when(repository.findByKeycloakId(KC_ID)).thenReturn(List.of());

        Map<String, JsonNode> result = controller.getAll(jwt);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("getAll returns parsed JSON nodes keyed by prefKey")
    void getAll_parsedJsonNodesByKey() {
        UserUiPreference p1 = new UserUiPreference(KC_ID, "planning.filters", "{\"hidden\":false,\"density\":3}");
        UserUiPreference p2 = new UserUiPreference(KC_ID, "calendar.view", "\"month\"");
        UserUiPreference p3 = new UserUiPreference(KC_ID, "kpis.dismissed", "[\"a\",\"b\"]");
        when(repository.findByKeycloakId(KC_ID)).thenReturn(List.of(p1, p2, p3));

        Map<String, JsonNode> result = controller.getAll(jwt);

        assertThat(result).hasSize(3);
        assertThat(result.get("planning.filters").get("hidden").asBoolean()).isFalse();
        assertThat(result.get("planning.filters").get("density").asInt()).isEqualTo(3);
        assertThat(result.get("calendar.view").asText()).isEqualTo("month");
        assertThat(result.get("kpis.dismissed").isArray()).isTrue();
        assertThat(result.get("kpis.dismissed").size()).isEqualTo(2);
    }

    @Test
    @DisplayName("getAll skips unparseable JSON entries silently")
    void getAll_skipsUnparseableEntries() {
        UserUiPreference good = new UserUiPreference(KC_ID, "ok", "{\"a\":1}");
        UserUiPreference bad = new UserUiPreference(KC_ID, "broken", "{ not valid json");
        when(repository.findByKeycloakId(KC_ID)).thenReturn(List.of(good, bad));

        Map<String, JsonNode> result = controller.getAll(jwt);

        assertThat(result).hasSize(1);
        assertThat(result).containsKey("ok");
        assertThat(result).doesNotContainKey("broken");
    }

    // ─── PUT /api/me/ui-preferences/{key} ────────────────────────────────

    @Test
    @DisplayName("upsert creates a new preference when none exists for the key")
    void upsert_createsNewPreference() {
        when(repository.findByKeycloakIdAndPrefKey(KC_ID, "newKey"))
                .thenReturn(Optional.of(new UserUiPreference(KC_ID, "newKey", "{\"zoom\":1.5}")));

        ObjectNode value = JsonNodeFactory.instance.objectNode().put("zoom", 1.5);
        ResponseEntity<UserUiPreferenceDto> response = controller.upsert(jwt, "newKey", value);

        // Upsert atomique : on verifie l'appel + la valeur serialisee (plus de save() check-then-act).
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(repository).upsertPreference(eq(KC_ID), eq("newKey"), captor.capture());
        assertThat(captor.getValue()).contains("\"zoom\":1.5");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().key()).isEqualTo("newKey");
        assertThat(response.getBody().value().get("zoom").asDouble()).isEqualTo(1.5);
    }

    @Test
    @DisplayName("upsert updates an existing preference (same row)")
    void upsert_updatesExistingPreference() {
        when(repository.findByKeycloakIdAndPrefKey(KC_ID, "filters"))
                .thenReturn(Optional.of(new UserUiPreference(KC_ID, "filters", "{\"v\":42}")));

        ObjectNode newValue = JsonNodeFactory.instance.objectNode().put("v", 42);
        controller.upsert(jwt, "filters", newValue);

        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(repository).upsertPreference(eq(KC_ID), eq("filters"), captor.capture());
        assertThat(captor.getValue()).contains("\"v\":42");
    }

    @Test
    @DisplayName("upsert rejects payloads larger than MAX_VALUE_LENGTH with 413")
    void upsert_oversizedPayload_returns413() {
        // Build a value whose serialized form exceeds 16_384 chars
        StringBuilder bigText = new StringBuilder();
        for (int i = 0; i < 17000; i++) bigText.append('x');
        ObjectNode bigValue = JsonNodeFactory.instance.objectNode().put("text", bigText.toString());

        assertThatThrownBy(() -> controller.upsert(jwt, "bigKey", bigValue))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(t -> {
                    ResponseStatusException rse = (ResponseStatusException) t;
                    assertThat(rse.getStatusCode()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE);
                    assertThat(rse.getReason()).contains("maximale");
                });
    }

    @Test
    @DisplayName("upsert with a null JsonNode treats it as 'null' literal and succeeds")
    void upsert_nullJsonNode_writesNullLiteral() {
        when(repository.findByKeycloakIdAndPrefKey(KC_ID, "nullable"))
                .thenReturn(Optional.of(new UserUiPreference(KC_ID, "nullable", "null")));

        JsonNode nullNode = JsonNodeFactory.instance.nullNode();
        ResponseEntity<UserUiPreferenceDto> response = controller.upsert(jwt, "nullable", nullNode);

        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(repository).upsertPreference(eq(KC_ID), eq("nullable"), captor.capture());
        assertThat(captor.getValue()).isEqualTo("null");
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    @DisplayName("upsert accepts arrays as values")
    void upsert_arrayValue_succeeds() {
        when(repository.findByKeycloakIdAndPrefKey(KC_ID, "arr"))
                .thenReturn(Optional.of(new UserUiPreference(KC_ID, "arr", "[1,2,3]")));

        JsonNode arr = objectMapper.createArrayNode().add(1).add(2).add(3);
        ResponseEntity<UserUiPreferenceDto> response = controller.upsert(jwt, "arr", arr);

        assertThat(response.getBody().value().isArray()).isTrue();
        assertThat(response.getBody().value().get(0).asInt()).isEqualTo(1);
    }

    // ─── DELETE /api/me/ui-preferences/{key} ─────────────────────────────

    @Test
    @DisplayName("delete calls repository.deleteByKeycloakIdAndPrefKey with extracted keycloakId")
    void delete_callsRepoWithCorrectParams() {
        controller.delete(jwt, "planning.filters");

        verify(repository).deleteByKeycloakIdAndPrefKey(KC_ID, "planning.filters");
    }

    @Test
    @DisplayName("delete works even when nothing exists (no exception)")
    void delete_noEntryExists_silentNoOp() {
        when(repository.deleteByKeycloakIdAndPrefKey(KC_ID, "missing")).thenReturn(0);

        controller.delete(jwt, "missing");

        verify(repository).deleteByKeycloakIdAndPrefKey(KC_ID, "missing");
    }
}
