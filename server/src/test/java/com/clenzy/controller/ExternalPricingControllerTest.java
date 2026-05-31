package com.clenzy.controller;

import com.clenzy.dto.ExternalPriceRecommendation;
import com.clenzy.dto.ExternalPricingConfigDto;
import com.clenzy.dto.UpdateExternalPricingConfigRequest;
import com.clenzy.model.ExternalPricingConfig;
import com.clenzy.model.PricingProvider;
import com.clenzy.service.ExternalPricingSyncService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExternalPricingControllerTest {

    @Mock private ExternalPricingSyncService syncService;
    @Mock private TenantContext tenantContext;

    private ExternalPricingController controller;

    @BeforeEach
    void setUp() {
        controller = new ExternalPricingController(syncService, tenantContext);
        lenient().when(tenantContext.getOrganizationId()).thenReturn(1L);
    }

    private ExternalPricingConfig buildConfig() {
        ExternalPricingConfig c = new ExternalPricingConfig();
        c.setId(1L);
        c.setOrganizationId(1L);
        c.setProvider(PricingProvider.PRICELABS);
        c.setEnabled(true);
        return c;
    }

    @Test
    void getConfigs_returnsAllMapped() {
        when(syncService.getAllConfigs(1L)).thenReturn(List.of(buildConfig()));

        List<ExternalPricingConfigDto> result = controller.getConfigs();

        assertEquals(1, result.size());
        assertEquals(PricingProvider.PRICELABS, result.get(0).provider());
    }

    @Test
    void updateConfig_existingConfig_updatesFields() {
        ExternalPricingConfig existing = buildConfig();
        when(syncService.getConfig(1L, PricingProvider.PRICELABS)).thenReturn(existing);
        when(syncService.saveConfig(any())).thenAnswer(inv -> inv.getArgument(0));

        UpdateExternalPricingConfigRequest req = new UpdateExternalPricingConfigRequest(
            PricingProvider.PRICELABS, "new-key", "https://api.x", Map.of("p1", "ext1"), false, 12);

        ExternalPricingConfigDto result = controller.updateConfig(req);

        assertEquals("https://api.x", result.apiUrl());
        assertFalse(result.enabled());
        assertEquals(12, result.syncIntervalHours());
    }

    @Test
    void updateConfig_newConfig_createsNew() {
        when(syncService.getConfig(1L, PricingProvider.BEYOND_PRICING)).thenThrow(new IllegalArgumentException("not found"));
        when(syncService.saveConfig(any())).thenAnswer(inv -> {
            ExternalPricingConfig saved = inv.getArgument(0);
            saved.setId(99L);
            return saved;
        });

        UpdateExternalPricingConfigRequest req = new UpdateExternalPricingConfigRequest(
            PricingProvider.BEYOND_PRICING, "k", "u", Map.of(), true, 24);

        ExternalPricingConfigDto result = controller.updateConfig(req);

        assertEquals(99L, result.id());
        assertEquals(PricingProvider.BEYOND_PRICING, result.provider());
    }

    @Test
    void updateConfig_partialUpdate_onlyChangesProvided() {
        ExternalPricingConfig existing = buildConfig();
        existing.setApiUrl("original");
        when(syncService.getConfig(1L, PricingProvider.PRICELABS)).thenReturn(existing);
        when(syncService.saveConfig(any())).thenAnswer(inv -> inv.getArgument(0));

        UpdateExternalPricingConfigRequest req = new UpdateExternalPricingConfigRequest(
            PricingProvider.PRICELABS, null, null, null, null, null);

        ExternalPricingConfigDto result = controller.updateConfig(req);

        assertEquals("original", result.apiUrl());
    }

    @Test
    void sync_returnsCountFromService() {
        when(syncService.syncPricesForOrg(1L)).thenReturn(42);

        assertEquals(42, controller.sync());
    }

    @Test
    void getRecommendations_delegatesToService() {
        List<ExternalPriceRecommendation> recs = List.of();
        when(syncService.getRecommendations(5L, 1L, PricingProvider.PRICELABS)).thenReturn(recs);

        assertEquals(recs, controller.getRecommendations(5L, PricingProvider.PRICELABS));
    }
}
