package com.clenzy.controller;

import com.clenzy.dto.PlatformAiModelDto;
import com.clenzy.dto.SavePlatformModelRequest;
import com.clenzy.dto.TestPlatformModelRequest;
import com.clenzy.service.PlatformAiConfigService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link PlatformAiConfigController}.
 *
 * <h2>Focus</h2>
 * <ul>
 *   <li>CRUD models (GET/POST/PUT/DELETE)</li>
 *   <li>updatedBy extrait du JWT (preferred_username)</li>
 *   <li>PUT force l'ID provenant du path (vs body)</li>
 *   <li>test model -> map success/provider/modelId</li>
 *   <li>Features assignements + unassign</li>
 *   <li>Budgets : valeur par defaut 100_000 quand 'limit' absent</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class PlatformAiConfigControllerTest {

    @Mock
    private PlatformAiConfigService configService;

    @Mock
    private Jwt jwt;

    @Mock
    private TenantContext tenantContext;

    private PlatformAiConfigController controller;

    @BeforeEach
    void setUp() {
        controller = new PlatformAiConfigController(configService, tenantContext);
        lenient().when(jwt.getClaimAsString("preferred_username")).thenReturn("admin@clenzy.com");
    }

    private PlatformAiModelDto model(Long id, String name, String provider) {
        return new PlatformAiModelDto(id, name, provider, "model-id",
                "sk-****1234", "https://api.example.com",
                List.of(), LocalDateTime.now(), LocalDateTime.now(),
                "AVAILABLE", LocalDateTime.now(), null);
    }

    // ─── GET /models ─────────────────────────────────────────────────────

    @Test
    @DisplayName("getModels returns list from service")
    void getModels_returnsList() {
        List<PlatformAiModelDto> models = List.of(
                model(1L, "Claude Sonnet", "anthropic"),
                model(2L, "GPT-4o", "openai")
        );
        when(configService.getModels()).thenReturn(models);

        ResponseEntity<List<PlatformAiModelDto>> response = controller.getModels();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    @DisplayName("getModels with empty list")
    void getModels_emptyList() {
        when(configService.getModels()).thenReturn(List.of());

        ResponseEntity<List<PlatformAiModelDto>> response = controller.getModels();

        assertThat(response.getBody()).isEmpty();
    }

    // ─── POST /models ────────────────────────────────────────────────────

    @Test
    @DisplayName("saveModel passes updatedBy from JWT preferred_username claim")
    void saveModel_passesUpdatedByFromJwt() {
        SavePlatformModelRequest req = new SavePlatformModelRequest(
                null, "My Model", "openai", "gpt-4o", "sk-xxx", null);
        PlatformAiModelDto savedDto = model(99L, "My Model", "openai");
        when(configService.saveModel(eq(req), eq("admin@clenzy.com"), any())).thenReturn(savedDto);

        ResponseEntity<PlatformAiModelDto> response = controller.saveModel(req, jwt);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().id()).isEqualTo(99L);
        verify(configService).saveModel(eq(req), eq("admin@clenzy.com"), any());
    }

    @Test
    @DisplayName("saveModel with null preferred_username claim passes null updatedBy")
    void saveModel_nullClaim_nullUpdatedBy() {
        when(jwt.getClaimAsString("preferred_username")).thenReturn(null);
        SavePlatformModelRequest req = new SavePlatformModelRequest(
                null, "Model X", "openai", "gpt", "key", null);
        when(configService.saveModel(any(), any(), any())).thenReturn(model(1L, "Model X", "openai"));

        controller.saveModel(req, jwt);

        verify(configService).saveModel(eq(req), isNull(), any());
    }

    // ─── PUT /models/{id} ────────────────────────────────────────────────

    @Test
    @DisplayName("updateModel forces ID from path even if body has different ID")
    void updateModel_forcesPathId() {
        SavePlatformModelRequest reqWithDifferentId = new SavePlatformModelRequest(
                999L, "Edit Model", "anthropic", "claude-x", "sk-y", "https://api.x.com");
        PlatformAiModelDto savedDto = model(42L, "Edit Model", "anthropic");
        when(configService.saveModel(any(SavePlatformModelRequest.class), eq("admin@clenzy.com"), any()))
                .thenReturn(savedDto);

        controller.updateModel(42L, reqWithDifferentId, jwt);

        ArgumentCaptor<SavePlatformModelRequest> captor = ArgumentCaptor.forClass(SavePlatformModelRequest.class);
        verify(configService).saveModel(captor.capture(), eq("admin@clenzy.com"), any());
        assertThat(captor.getValue().id()).isEqualTo(42L);
        assertThat(captor.getValue().name()).isEqualTo("Edit Model");
        assertThat(captor.getValue().provider()).isEqualTo("anthropic");
        assertThat(captor.getValue().modelId()).isEqualTo("claude-x");
        assertThat(captor.getValue().apiKey()).isEqualTo("sk-y");
        assertThat(captor.getValue().baseUrl()).isEqualTo("https://api.x.com");
    }

    // ─── DELETE /models/{id} ─────────────────────────────────────────────

    @Test
    @DisplayName("deleteModel calls service and returns success message")
    void deleteModel_callsServiceAndReturnsMessage() {
        ResponseEntity<Map<String, String>> response = controller.deleteModel(7L);

        verify(configService).deleteModel(7L);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("message", "Model deleted");
    }

    // ─── POST /models/test ───────────────────────────────────────────────

    @Test
    @DisplayName("testModel returns success=true with provider/modelId echoed")
    void testModel_success_echoesProviderAndModelId() {
        TestPlatformModelRequest req = new TestPlatformModelRequest(
                "anthropic", "claude-3-5-sonnet", "sk-xxx", null);
        when(configService.testModel(req)).thenReturn(true);

        ResponseEntity<Map<String, Object>> response = controller.testModel(req);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody())
                .containsEntry("success", true)
                .containsEntry("provider", "anthropic")
                .containsEntry("modelId", "claude-3-5-sonnet");
    }

    @Test
    @DisplayName("testModel returns success=false when service rejects")
    void testModel_failure_returnsSuccessFalse() {
        TestPlatformModelRequest req = new TestPlatformModelRequest(
                "openai", "gpt-4o", "bad-key", null);
        when(configService.testModel(req)).thenReturn(false);

        ResponseEntity<Map<String, Object>> response = controller.testModel(req);

        assertThat(response.getBody())
                .containsEntry("success", false)
                .containsEntry("provider", "openai");
    }

    // ─── GET /features ───────────────────────────────────────────────────

    @Test
    @DisplayName("getFeatureAssignments returns feature -> model map")
    void getFeatureAssignments_returnsMap() {
        Map<String, PlatformAiModelDto> assignments = Map.of(
                "DESIGN", model(1L, "Claude", "anthropic"),
                "PRICING", model(2L, "GPT", "openai")
        );
        when(configService.getFeatureAssignments()).thenReturn(assignments);

        ResponseEntity<Map<String, PlatformAiModelDto>> response = controller.getFeatureAssignments();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(2);
        assertThat(response.getBody().get("DESIGN").name()).isEqualTo("Claude");
    }

    // ─── PUT /features/{feature}/model/{modelId} ─────────────────────────

    @Test
    @DisplayName("assignModelToFeature calls service.assignModelToFeature with correct args")
    void assignModelToFeature_callsService() {
        ResponseEntity<Map<String, String>> response =
                controller.assignModelToFeature("DESIGN", 7L);

        verify(configService).assignModelToFeature(7L, "DESIGN");
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().get("message")).contains("DESIGN", "7");
    }

    // ─── DELETE /features/{feature} ──────────────────────────────────────

    @Test
    @DisplayName("unassignFeature calls service and returns confirmation")
    void unassignFeature_callsService() {
        ResponseEntity<Map<String, String>> response = controller.unassignFeature("PRICING");

        verify(configService).unassignFeature("PRICING");
        assertThat(response.getBody().get("message")).contains("PRICING");
    }

    // ─── GET /budgets ────────────────────────────────────────────────────

    @Test
    @DisplayName("getFeatureBudgets returns map of feature -> long")
    void getFeatureBudgets_returnsMap() {
        Map<String, Long> budgets = Map.of("DESIGN", 50_000L, "PRICING", 100_000L);
        when(configService.getFeatureBudgets()).thenReturn(budgets);

        ResponseEntity<Map<String, Long>> response = controller.getFeatureBudgets();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(2);
        assertThat(response.getBody().get("DESIGN")).isEqualTo(50_000L);
    }

    // ─── PUT /budgets/{feature} ──────────────────────────────────────────

    @Test
    @DisplayName("setFeatureBudget reads 'limit' from body and persists")
    void setFeatureBudget_readsLimitFromBody() {
        Map<String, Long> body = Map.of("limit", 250_000L);

        ResponseEntity<Map<String, Object>> response =
                controller.setFeatureBudget("DESIGN", body);

        verify(configService).setFeatureBudget("DESIGN", 250_000L);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody())
                .containsEntry("feature", "DESIGN")
                .containsEntry("limit", 250_000L);
    }

    @Test
    @DisplayName("setFeatureBudget uses 100_000 as default when 'limit' missing")
    void setFeatureBudget_missingLimit_uses100kDefault() {
        Map<String, Long> body = Map.of();

        ResponseEntity<Map<String, Object>> response =
                controller.setFeatureBudget("PRICING", body);

        verify(configService).setFeatureBudget("PRICING", 100_000L);
        assertThat(response.getBody()).containsEntry("limit", 100_000L);
    }
}
