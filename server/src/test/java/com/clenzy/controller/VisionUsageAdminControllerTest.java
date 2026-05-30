package com.clenzy.controller;

import com.clenzy.model.OrgVisionAlert;
import com.clenzy.repository.OrgVisionAlertRepository;
import com.clenzy.service.agent.vision.VisionTokenUsageService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VisionUsageAdminControllerTest {

    @Mock private VisionTokenUsageService usageService;
    @Mock private OrgVisionAlertRepository alertRepository;
    @Mock private TenantContext tenantContext;

    private VisionUsageAdminController controller;

    @BeforeEach
    void setUp() {
        controller = new VisionUsageAdminController(usageService, alertRepository, tenantContext);
    }

    @Nested
    @DisplayName("getUsage")
    class GetUsage {

        @Test
        void withoutAlertConfig_returnsBasicSnapshot() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
            VisionTokenUsageService.UsageSnapshot snap = new VisionTokenUsageService.UsageSnapshot(
                    7L, 12345L, 30, LocalDateTime.now());
            when(usageService.snapshot(7L)).thenReturn(snap);
            when(alertRepository.findByOrganizationId(7L)).thenReturn(Optional.empty());

            ResponseEntity<Map<String, Object>> response = controller.getUsage();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("organizationId", 7L);
            assertThat(response.getBody()).containsEntry("tokensLast30Days", 12345L);
            assertThat(response.getBody()).containsEntry("windowDays", 30);
            assertThat(response.getBody()).doesNotContainKey("alertConfig");
        }

        @Test
        void withAlertConfigBelowThreshold_includesNotExceeded() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
            VisionTokenUsageService.UsageSnapshot snap = new VisionTokenUsageService.UsageSnapshot(
                    7L, 100L, 30, LocalDateTime.now());
            when(usageService.snapshot(7L)).thenReturn(snap);
            OrgVisionAlert cfg = new OrgVisionAlert(7L, 1_000_000L);
            when(alertRepository.findByOrganizationId(7L)).thenReturn(Optional.of(cfg));

            ResponseEntity<Map<String, Object>> response = controller.getUsage();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, Object> alertCfg = (Map<String, Object>) response.getBody().get("alertConfig");
            assertThat(alertCfg).isNotNull();
            assertThat(alertCfg).containsEntry("thresholdTokens", 1_000_000L);
            assertThat(alertCfg).containsEntry("exceeded", false);
        }

        @Test
        void withAlertConfigAboveThreshold_includesExceeded() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
            VisionTokenUsageService.UsageSnapshot snap = new VisionTokenUsageService.UsageSnapshot(
                    7L, 2_000_000L, 30, LocalDateTime.now());
            when(usageService.snapshot(7L)).thenReturn(snap);
            OrgVisionAlert cfg = new OrgVisionAlert(7L, 1_000_000L);
            cfg.setLastAlertedAt(LocalDateTime.now().minusDays(1));
            when(alertRepository.findByOrganizationId(7L)).thenReturn(Optional.of(cfg));

            ResponseEntity<Map<String, Object>> response = controller.getUsage();

            @SuppressWarnings("unchecked")
            Map<String, Object> alertCfg = (Map<String, Object>) response.getBody().get("alertConfig");
            assertThat(alertCfg).containsEntry("exceeded", true);
            assertThat(alertCfg.get("lastAlertedAt")).isNotNull();
        }
    }

    @Nested
    @DisplayName("setThreshold")
    class SetThreshold {

        @Test
        void validThreshold_createsOrUpdates() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
            when(alertRepository.findByOrganizationId(7L)).thenReturn(Optional.empty());
            when(alertRepository.save(any(OrgVisionAlert.class))).thenAnswer(inv -> {
                OrgVisionAlert saved = inv.getArgument(0);
                // Set lastAlertedAt so the Map.of in controller doesn't NPE
                saved.setLastAlertedAt(LocalDateTime.now());
                return saved;
            });

            Map<String, Object> body = new HashMap<>();
            body.put("thresholdTokens", 500_000);

            ResponseEntity<Map<String, Object>> response = controller.setThreshold(body);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("organizationId", 7L);
            assertThat(response.getBody()).containsEntry("thresholdTokens", 500_000L);
        }

        @Test
        void existingConfig_updatesValue() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
            OrgVisionAlert existing = new OrgVisionAlert(7L, 100L);
            existing.setLastAlertedAt(LocalDateTime.now()); // avoid Map.of(null)
            when(alertRepository.findByOrganizationId(7L)).thenReturn(Optional.of(existing));
            when(alertRepository.save(any(OrgVisionAlert.class))).thenAnswer(inv -> inv.getArgument(0));

            Map<String, Object> body = Map.of("thresholdTokens", 800L);

            ResponseEntity<Map<String, Object>> response = controller.setThreshold(body);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(existing.getThresholdTokens()).isEqualTo(800L);
        }

        @Test
        void nonNumeric_returns400() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
            ResponseEntity<Map<String, Object>> response =
                    controller.setThreshold(Map.of("thresholdTokens", "abc"));

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void zeroValue_returns400() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
            ResponseEntity<Map<String, Object>> response =
                    controller.setThreshold(Map.of("thresholdTokens", 0));

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void negativeValue_returns400() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
            ResponseEntity<Map<String, Object>> response =
                    controller.setThreshold(Map.of("thresholdTokens", -10));

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void missingKey_returns400() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
            ResponseEntity<Map<String, Object>> response =
                    controller.setThreshold(new HashMap<>());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }
}
