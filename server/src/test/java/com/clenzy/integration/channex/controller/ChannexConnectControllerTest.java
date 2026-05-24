package com.clenzy.integration.channex.controller;

import com.clenzy.integration.channex.dto.ChannexPriceDriftDto;
import com.clenzy.integration.channex.model.ChannexPriceDrift;
import com.clenzy.integration.channex.repository.ChannexSyncLogRepository;
import com.clenzy.integration.channex.service.ChannexCapabilityService;
import com.clenzy.integration.channex.service.ChannexConnectService;
import com.clenzy.integration.channex.service.ChannexImportService;
import com.clenzy.integration.channex.service.ChannexPriceDriftService;
import com.clenzy.integration.channex.service.ChannexSyncService;
import com.clenzy.model.PriceSourceOfTruth;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests d'integration legers (unit + delegation verification) pour les nouveaux
 * endpoints livres pendant cette session (Phase 5 + audit) — Phase 5 audit T7.
 *
 * <p>Focus sur les endpoints qui n'avaient pas de coverage : push-pricing-settings,
 * price-source-of-truth, price-drifts list/per-property/resolve.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexConnectController (audit endpoints)")
class ChannexConnectControllerTest {

    @Mock private ChannexConnectService connectService;
    @Mock private ChannexImportService importService;
    @Mock private TenantContext tenantContext;
    @Mock private ChannexCapabilityService capabilityService;
    @Mock private ChannexSyncLogRepository syncLogRepository;
    @Mock private ChannexPriceDriftService priceDriftService;
    @Mock private ChannexSyncService syncService;
    @Mock private com.clenzy.integration.channex.client.ChannexClient channexClient;

    private ChannexConnectController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new ChannexConnectController(connectService, importService, tenantContext,
            capabilityService, syncLogRepository, priceDriftService, syncService, channexClient,
            // Items 2-3-4 paid apps services mocked
            org.mockito.Mockito.mock(com.clenzy.integration.channex.service.ChannexMessagingService.class),
            org.mockito.Mockito.mock(com.clenzy.integration.channex.service.ChannexReviewsService.class),
            org.mockito.Mockito.mock(com.clenzy.integration.channex.service.ChannexStripeTokenizationService.class));
        jwt = Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .claim("sub", "user-123")
            .claim("email", "admin@clenzy.fr")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(3600))
            .build();
        org.mockito.Mockito.lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(42L);
    }

    // ─── pushPricingSettings ─────────────────────────────────────────────────

    @Test
    @DisplayName("pushPricingSettings : delegue au syncService avec orgId du tenant")
    void pushPricingSettings_delegates() {
        when(syncService.pushPricingSettings(100L, 42L))
            .thenReturn(new ChannexSyncService.ChannexSyncResult(true, "ok", 5, 0));

        ChannexSyncService.ChannexSyncResult result = controller.pushPricingSettings(100L);

        assertThat(result.success()).isTrue();
        verify(syncService).pushPricingSettings(100L, 42L);
    }

    // ─── setPriceSourceOfTruth ───────────────────────────────────────────────

    @Test
    @DisplayName("setPriceSourceOfTruth : body valide -> delegue au connectService")
    void setPriceSource_valid() {
        when(connectService.updatePriceSourceOfTruth(100L, 42L, PriceSourceOfTruth.OTA))
            .thenReturn(PriceSourceOfTruth.OTA);

        ChannexConnectController.PriceSourceResponse result = controller.setPriceSourceOfTruth(100L,
            new ChannexConnectController.PriceSourceBody("OTA"));

        assertThat(result.clenzyPropertyId()).isEqualTo(100L);
        assertThat(result.priceSourceOfTruth()).isEqualTo("OTA");
        verify(connectService).updatePriceSourceOfTruth(100L, 42L, PriceSourceOfTruth.OTA);
    }

    @Test
    @DisplayName("setPriceSourceOfTruth : body null -> IllegalArgumentException")
    void setPriceSource_nullBody() {
        assertThatThrownBy(() -> controller.setPriceSourceOfTruth(100L, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Body requis");
    }

    @Test
    @DisplayName("setPriceSourceOfTruth : source vide -> IllegalArgumentException")
    void setPriceSource_emptySource() {
        assertThatThrownBy(() -> controller.setPriceSourceOfTruth(100L,
            new ChannexConnectController.PriceSourceBody("")))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("setPriceSourceOfTruth : source invalide -> IllegalArgumentException explicite")
    void setPriceSource_invalidEnum() {
        assertThatThrownBy(() -> controller.setPriceSourceOfTruth(100L,
            new ChannexConnectController.PriceSourceBody("INVALID")))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("CLENZY, OTA ou MANUAL");
    }

    // ─── listPriceDrifts ─────────────────────────────────────────────────────

    @Test
    @DisplayName("listPriceDrifts : returns liste mappee en DTO depuis priceDriftService")
    void listPriceDrifts_mapsToDtos() {
        ChannexPriceDrift d = new ChannexPriceDrift();
        d.setId(1L);
        d.setOrganizationId(42L);
        d.setClenzyPropertyId(100L);
        d.setMappingId(UUID.randomUUID());
        d.setDriftDate(LocalDate.of(2026, 7, 15));
        d.setClenzyPrice(new BigDecimal("89.00"));
        d.setOtaPrice(new BigDecimal("95.00"));
        d.setCurrency("EUR");
        d.setDetectedAt(Instant.now());
        when(priceDriftService.listActive(42L)).thenReturn(List.of(d));

        List<ChannexPriceDriftDto> result = controller.listPriceDrifts();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).clenzyPropertyId()).isEqualTo(100L);
        assertThat(result.get(0).diffAmount()).isEqualByComparingTo("-6.00");
    }

    @Test
    @DisplayName("listPriceDriftsForProperty : scope sur la property + delegue")
    void listPriceDriftsForProperty_scoped() {
        when(priceDriftService.listActiveForProperty(42L, 100L)).thenReturn(List.of());

        List<ChannexPriceDriftDto> result = controller.listPriceDriftsForProperty(100L);

        assertThat(result).isEmpty();
        verify(priceDriftService).listActiveForProperty(42L, 100L);
    }

    // ─── resolvePriceDrift ───────────────────────────────────────────────────

    @Test
    @DisplayName("resolvePriceDrift : body resolution=KEEP_OTA + JWT email -> delegue resolvedBy=email")
    void resolveDrift_keepOta() {
        ChannexPriceDrift resolved = new ChannexPriceDrift();
        resolved.setId(1L);
        resolved.setOrganizationId(42L);
        resolved.setClenzyPropertyId(100L);
        resolved.setMappingId(UUID.randomUUID());
        resolved.setDriftDate(LocalDate.now());
        resolved.setClenzyPrice(BigDecimal.ZERO);
        resolved.setOtaPrice(BigDecimal.ZERO);
        resolved.setResolution(ChannexPriceDrift.Resolution.KEEP_OTA);
        resolved.setResolvedAt(Instant.now());
        resolved.setResolvedBy("admin@clenzy.fr");
        when(priceDriftService.resolve(eq(42L), eq(1L), eq(ChannexPriceDrift.Resolution.KEEP_OTA),
            eq("admin@clenzy.fr"))).thenReturn(resolved);

        ChannexPriceDriftDto result = controller.resolvePriceDrift(1L,
            new ChannexConnectController.ResolveDriftBody("KEEP_OTA"), jwt);

        assertThat(result.resolution()).isEqualTo("KEEP_OTA");
        assertThat(result.resolvedBy()).isEqualTo("admin@clenzy.fr");
    }

    @Test
    @DisplayName("resolvePriceDrift : body null -> IllegalArgumentException")
    void resolveDrift_nullBody() {
        assertThatThrownBy(() -> controller.resolvePriceDrift(1L, null, jwt))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("resolution");
    }

    @Test
    @DisplayName("resolvePriceDrift : resolution invalide -> IllegalArgumentException explicite")
    void resolveDrift_invalidResolution() {
        assertThatThrownBy(() -> controller.resolvePriceDrift(1L,
            new ChannexConnectController.ResolveDriftBody("WRONG"), jwt))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("KEEP_CLENZY, KEEP_OTA ou DISMISSED");
    }

    // ─── Sprint A4-A7 Quick Wins endpoints ───────────────────────────────────

    @Test
    @DisplayName("channelLogs : delegue au client + retourne JsonNode")
    void channelLogs_delegates() {
        com.fasterxml.jackson.databind.JsonNode stub =
            new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode().put("data", "ok");
        when(channexClient.fetchChannelLogs(eq("chan-1"), eq(50)))
            .thenReturn(java.util.Optional.of(stub));

        com.fasterxml.jackson.databind.JsonNode result = controller.channelLogs("chan-1", 50);

        assertThat(result.path("data").asText()).isEqualTo("ok");
        verify(channexClient).fetchChannelLogs("chan-1", 50);
    }

    @Test
    @DisplayName("channelLogs : client retourne empty -> fallback not_supported")
    void channelLogs_fallback() {
        when(channexClient.fetchChannelLogs(any(), any(Integer.class)))
            .thenReturn(java.util.Optional.empty());

        com.fasterxml.jackson.databind.JsonNode result = controller.channelLogs("chan-1", 50);

        assertThat(result.path("status").asText()).isEqualTo("not_supported");
    }

    @Test
    @DisplayName("channelWebhookLogs : delegue au client")
    void channelWebhookLogs_delegates() {
        com.fasterxml.jackson.databind.JsonNode stub =
            new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode().put("count", 3);
        when(channexClient.fetchChannelWebhookLogs(eq("chan-1"), eq(50)))
            .thenReturn(java.util.Optional.of(stub));

        com.fasterxml.jackson.databind.JsonNode result = controller.channelWebhookLogs("chan-1", 50);

        assertThat(result.path("count").asInt()).isEqualTo(3);
    }

    @Test
    @DisplayName("channexUsage : delegue au client + fallback si non disponible")
    void channexUsage_fallback() {
        when(channexClient.fetchBillingUsage()).thenReturn(java.util.Optional.empty());

        com.fasterxml.jackson.databind.JsonNode result = controller.channexUsage();

        assertThat(result.path("status").asText()).isEqualTo("not_available");
    }

    @Test
    @DisplayName("testWebhook : delegue au client + retourne fallback ko si non supporte")
    void testWebhook_fallback() {
        when(channexClient.testWebhook(eq("wh-1"))).thenReturn(java.util.Optional.empty());

        com.fasterxml.jackson.databind.JsonNode result = controller.testWebhook("wh-1");

        assertThat(result.path("status").asText()).isEqualTo("ko");
    }
}
