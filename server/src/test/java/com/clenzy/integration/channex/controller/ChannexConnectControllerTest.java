package com.clenzy.integration.channex.controller;

import com.clenzy.integration.channex.dto.ChannexConnectRequest;
import com.clenzy.integration.channex.dto.ChannexConnectedOta;
import com.clenzy.integration.channex.dto.ChannexDiscoveryResponse;
import com.clenzy.integration.channex.dto.ChannexEmbedUrlResponse;
import com.clenzy.integration.channex.dto.ChannexFullDisconnectResult;
import com.clenzy.integration.channex.dto.ChannexHealthSummary;
import com.clenzy.integration.channex.dto.ChannexImportRequest;
import com.clenzy.integration.channex.dto.ChannexImportResult;
import com.clenzy.integration.channex.dto.ChannexOauthSetupResponse;
import com.clenzy.integration.channex.dto.ChannexOtaChannelResponse;
import com.clenzy.integration.channex.dto.ChannexPreflightReport;
import com.clenzy.integration.channex.dto.ChannexPriceDriftDto;
import com.clenzy.integration.channex.dto.ChannexResyncContentResult;
import com.clenzy.integration.channex.model.ChannexPriceDrift;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
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
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
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
        // Service sync-log reel sur repository mocke (refactor T-ARCH-01)
        controller = new ChannexConnectController(connectService, importService, tenantContext,
            capabilityService,
            new com.clenzy.integration.channex.service.ChannexSyncLogService(syncLogRepository),
            priceDriftService, syncService, channexClient,
            // Items 2-3-4 paid apps services mocked
            org.mockito.Mockito.mock(com.clenzy.integration.channex.service.ChannexMessagingService.class),
            org.mockito.Mockito.mock(com.clenzy.integration.channex.service.ChannexReviewsService.class),
            org.mockito.Mockito.mock(com.clenzy.integration.channex.service.ChannexStripeTokenizationService.class),
            // Phase B : webhook registration + content push
            org.mockito.Mockito.mock(com.clenzy.integration.channex.service.ChannexWebhookRegistrationService.class),
            org.mockito.Mockito.mock(com.clenzy.integration.channex.service.ChannexContentPushService.class),
            // Phase C : applications, CRS, rules par canal, Google, reporting
            org.mockito.Mockito.mock(com.clenzy.integration.channex.service.ChannexApplicationsService.class),
            org.mockito.Mockito.mock(com.clenzy.integration.channex.service.ChannexCrsBookingService.class),
            org.mockito.Mockito.mock(com.clenzy.integration.channex.service.ChannexAvailabilityRuleService.class),
            org.mockito.Mockito.mock(com.clenzy.integration.channex.service.ChannexGoogleReadinessService.class),
            org.mockito.Mockito.mock(com.clenzy.integration.channex.service.ChannexBookingReportingService.class));
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

    // ─── Listing/Get/Connect/Disconnect Mappings ─────────────────────────────

    @Nested
    @DisplayName("listMappings + getMapping")
    class ListAndGetMappings {

        @Test
        @DisplayName("listMappings : delegue au connectService + mappe les rows en DTO")
        void listMappings_returnsMappedDtos() {
            ChannexPropertyMapping m = new ChannexPropertyMapping();
            m.setId(UUID.randomUUID());
            m.setOrganizationId(42L);
            m.setClenzyPropertyId(100L);
            m.setChannexPropertyId("chx-1");
            m.setSyncStatus(ChannexSyncStatus.ACTIVE);
            when(connectService.list(42L)).thenReturn(List.of(m));

            var result = controller.listMappings();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).clenzyPropertyId()).isEqualTo(100L);
            assertThat(result.get(0).syncStatus()).isEqualTo(ChannexSyncStatus.ACTIVE);
            verify(connectService).list(42L);
        }

        @Test
        @DisplayName("listMappings : aucune row -> liste vide")
        void listMappings_emptyList() {
            when(connectService.list(42L)).thenReturn(List.of());
            assertThat(controller.listMappings()).isEmpty();
        }

        @Test
        @DisplayName("getMapping : trouve -> 200 OK avec DTO")
        void getMapping_found() {
            ChannexPropertyMapping m = new ChannexPropertyMapping();
            m.setId(UUID.randomUUID());
            m.setOrganizationId(42L);
            m.setClenzyPropertyId(100L);
            m.setChannexPropertyId("chx-1");
            when(connectService.getByPropertyId(100L, 42L)).thenReturn(Optional.of(m));

            var response = controller.getMapping(100L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().clenzyPropertyId()).isEqualTo(100L);
        }

        @Test
        @DisplayName("getMapping : absent -> 404 Not Found")
        void getMapping_notFound() {
            when(connectService.getByPropertyId(100L, 42L)).thenReturn(Optional.empty());

            var response = controller.getMapping(100L);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
            assertThat(response.getBody()).isNull();
        }
    }

    @Nested
    @DisplayName("connect + disconnect + fullDisconnect")
    class ConnectAndDisconnect {

        @Test
        @DisplayName("connect : delegue au service avec orgId tenant + DTO retourne")
        void connect_delegates() {
            ChannexConnectRequest request = ChannexConnectRequest.autoCreate();
            ChannexPropertyMapping mapping = new ChannexPropertyMapping();
            mapping.setId(UUID.randomUUID());
            mapping.setOrganizationId(42L);
            mapping.setClenzyPropertyId(100L);
            mapping.setChannexPropertyId("chx-new");
            when(connectService.connect(100L, 42L, request)).thenReturn(mapping);

            var result = controller.connect(100L, request);

            assertThat(result.clenzyPropertyId()).isEqualTo(100L);
            verify(connectService).connect(100L, 42L, request);
        }

        @Test
        @DisplayName("disconnect : delegue au service (no return)")
        void disconnect_delegates() {
            controller.disconnect(100L);
            verify(connectService).disconnect(100L, 42L);
        }

        @Test
        @DisplayName("fullDisconnect : body null -> deletePivot=false")
        void fullDisconnect_nullBody() {
            ChannexFullDisconnectResult result = new ChannexFullDisconnectResult(
                true, 100L, "chx-1", List.of());
            when(connectService.fullDisconnect(100L, 42L, false)).thenReturn(result);

            var actual = controller.fullDisconnect(100L, null);

            assertThat(actual.overallSuccess()).isTrue();
            verify(connectService).fullDisconnect(100L, 42L, false);
        }

        @Test
        @DisplayName("fullDisconnect : body.deleteChannexProperty=true -> deletePivot=true")
        void fullDisconnect_deletePivotTrue() {
            ChannexFullDisconnectResult result = new ChannexFullDisconnectResult(
                true, 100L, "chx-1", List.of());
            when(connectService.fullDisconnect(100L, 42L, true)).thenReturn(result);

            controller.fullDisconnect(100L,
                new ChannexConnectController.FullDisconnectBody(true));

            verify(connectService).fullDisconnect(100L, 42L, true);
        }

        @Test
        @DisplayName("fullDisconnect : body.deleteChannexProperty=null -> deletePivot=false")
        void fullDisconnect_nullField() {
            ChannexFullDisconnectResult result = new ChannexFullDisconnectResult(
                true, 100L, "chx-1", List.of());
            when(connectService.fullDisconnect(100L, 42L, false)).thenReturn(result);

            controller.fullDisconnect(100L,
                new ChannexConnectController.FullDisconnectBody(null));

            verify(connectService).fullDisconnect(100L, 42L, false);
        }
    }

    // ─── healthSummary, preflight, diagnose, resync, syncLogs ────────────────

    @Nested
    @DisplayName("healthSummary + preflight + diagnose + resync + syncLogs")
    class HealthAndOps {

        @Test
        @DisplayName("healthSummary : delegue au service avec orgId tenant")
        void healthSummary_delegates() {
            ChannexHealthSummary expected = new ChannexHealthSummary(
                3, java.util.Map.of(), List.of(), Instant.now());
            when(connectService.computeHealthSummary(42L)).thenReturn(expected);

            var result = controller.healthSummary();

            assertThat(result.totalMappings()).isEqualTo(3);
            verify(connectService).computeHealthSummary(42L);
        }

        @Test
        @DisplayName("preflight : propertyId null -> appel global (null)")
        void preflight_noProperty() {
            ChannexPreflightReport report = new ChannexPreflightReport(true, List.of());
            when(connectService.runPreflight(42L, null)).thenReturn(report);

            var result = controller.preflight(null);

            assertThat(result.canProceed()).isTrue();
            verify(connectService).runPreflight(42L, null);
        }

        @Test
        @DisplayName("preflight : propertyId fourni -> delegue avec propertyId")
        void preflight_withProperty() {
            ChannexPreflightReport report = new ChannexPreflightReport(false, List.of());
            when(connectService.runPreflight(42L, 100L)).thenReturn(report);

            controller.preflight(100L);

            verify(connectService).runPreflight(42L, 100L);
        }

        @Test
        @DisplayName("diagnose : delegue au service")
        void diagnose_delegates() {
            com.clenzy.integration.channex.dto.ChannexDiagnosisReport report =
                new com.clenzy.integration.channex.dto.ChannexDiagnosisReport(
                    100L, "Mon studio", null, List.of(), "Tout va bien");
            when(connectService.diagnose(100L, 42L)).thenReturn(report);

            var result = controller.diagnose(100L);

            assertThat(result.clenzyPropertyId()).isEqualTo(100L);
        }

        @Test
        @DisplayName("resync : utilise le defaut 6 mois si non fourni")
        void resync_default6Months() {
            ChannexSyncService.ChannexSyncResult sr =
                new ChannexSyncService.ChannexSyncResult(true, "ok", 5, 0);
            when(connectService.resync(100L, 42L, 6)).thenReturn(sr);

            var result = controller.resync(100L, 6);

            assertThat(result.success()).isTrue();
            verify(connectService).resync(100L, 42L, 6);
        }

        @Test
        @DisplayName("resync : months explicite est transmis")
        void resync_customMonths() {
            ChannexSyncService.ChannexSyncResult sr =
                new ChannexSyncService.ChannexSyncResult(true, "ok", 12, 0);
            when(connectService.resync(100L, 42L, 12)).thenReturn(sr);

            controller.resync(100L, 12);

            verify(connectService).resync(100L, 42L, 12);
        }

        @Test
        @DisplayName("syncLogs : limit dans la plage -> pageRequest with limit")
        void syncLogs_default() {
            when(syncLogRepository.findByPropertyOrdered(eq(42L), eq(100L), any(PageRequest.class)))
                .thenReturn(List.of());

            var result = controller.syncLogs(100L, 50);

            assertThat(result).isEmpty();
            verify(syncLogRepository).findByPropertyOrdered(eq(42L), eq(100L), any(PageRequest.class));
        }

        @Test
        @DisplayName("syncLogs : limit > 200 -> clamp a 200")
        void syncLogs_clampedAt200() {
            when(syncLogRepository.findByPropertyOrdered(eq(42L), eq(100L), any(PageRequest.class)))
                .thenReturn(List.of());

            controller.syncLogs(100L, 9999);

            verify(syncLogRepository).findByPropertyOrdered(eq(42L), eq(100L), any(PageRequest.class));
        }

        @Test
        @DisplayName("syncLogs : limit < 1 -> clamp a 1")
        void syncLogs_clampedAt1() {
            when(syncLogRepository.findByPropertyOrdered(eq(42L), eq(100L), any(PageRequest.class)))
                .thenReturn(List.of());

            controller.syncLogs(100L, -10);

            verify(syncLogRepository).findByPropertyOrdered(eq(42L), eq(100L), any(PageRequest.class));
        }
    }

    // ─── Capabilities cache ─────────────────────────────────────────────────

    @Nested
    @DisplayName("Capabilities cache")
    class Capabilities {

        @Test
        @DisplayName("listCapabilities : delegue au service -> Report wrapping")
        void listCapabilities_delegates() {
            when(capabilityService.snapshot()).thenReturn(java.util.Map.of());

            var report = controller.listCapabilities();

            assertThat(report).isNotNull();
            verify(capabilityService).snapshot();
        }

        @Test
        @DisplayName("resetCapabilityCache : delegue au service (void)")
        void resetCapabilityCache_delegates() {
            controller.resetCapabilityCache();
            verify(capabilityService).clearCache();
        }
    }

    // ─── pullBookings ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("pullBookings")
    class PullBookings {

        @Test
        @DisplayName("pullBookings : from/to null -> defauts (today, today+12mo)")
        void pullBookings_defaults() {
            ChannexConnectService.PullBookingsResult result =
                new ChannexConnectService.PullBookingsResult(0, 0, 0, 0);
            when(connectService.pullBookings(eq(100L), eq(42L), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(result);

            var actual = controller.pullBookings(100L, null, null);

            assertThat(actual.totalReceived()).isZero();
            verify(connectService).pullBookings(eq(100L), eq(42L),
                any(LocalDate.class), any(LocalDate.class));
        }

        @Test
        @DisplayName("pullBookings : from/to fournis -> parsing + transmis")
        void pullBookings_withDates() {
            ChannexConnectService.PullBookingsResult result =
                new ChannexConnectService.PullBookingsResult(2, 2, 0, 0);
            when(connectService.pullBookings(100L, 42L, LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31))).thenReturn(result);

            controller.pullBookings(100L, "2026-01-01", "2026-12-31");

            verify(connectService).pullBookings(100L, 42L,
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31));
        }

        @Test
        @DisplayName("pullBookings : from fourni seul -> to = from + 12mois")
        void pullBookings_fromOnly() {
            ChannexConnectService.PullBookingsResult result =
                new ChannexConnectService.PullBookingsResult(0, 0, 0, 0);
            when(connectService.pullBookings(eq(100L), eq(42L), eq(LocalDate.of(2026, 1, 1)),
                eq(LocalDate.of(2027, 1, 1)))).thenReturn(result);

            controller.pullBookings(100L, "2026-01-01", null);

            verify(connectService).pullBookings(100L, 42L,
                LocalDate.of(2026, 1, 1), LocalDate.of(2027, 1, 1));
        }
    }

    // ─── getEmbedUrl ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getEmbedUrl")
    class GetEmbedUrl {

        @Test
        @DisplayName("getEmbedUrl : jwt avec email -> username = email")
        void getEmbedUrl_jwtEmail() {
            when(connectService.getEmbedUrl(100L, 42L, "admin@clenzy.fr", "fr", null))
                .thenReturn("https://channex.io/iframe");

            ChannexEmbedUrlResponse result = controller.getEmbedUrl(100L, "fr", null, jwt);

            assertThat(result.url()).isEqualTo("https://channex.io/iframe");
            verify(connectService).getEmbedUrl(100L, 42L, "admin@clenzy.fr", "fr", null);
        }

        @Test
        @DisplayName("getEmbedUrl : jwt null -> username = clenzy-org-{orgId}")
        void getEmbedUrl_jwtNull() {
            when(connectService.getEmbedUrl(eq(100L), eq(42L), eq("clenzy-org-42"),
                eq("fr"), any())).thenReturn("https://channex.io/iframe");

            controller.getEmbedUrl(100L, "fr", null, null);

            verify(connectService).getEmbedUrl(100L, 42L, "clenzy-org-42", "fr", null);
        }

        @Test
        @DisplayName("getEmbedUrl : channel fourni est transmis")
        void getEmbedUrl_withChannel() {
            when(connectService.getEmbedUrl(100L, 42L, "admin@clenzy.fr", "en", "ABB"))
                .thenReturn("https://channex.io/iframe");

            controller.getEmbedUrl(100L, "en", "ABB", jwt);

            verify(connectService).getEmbedUrl(100L, 42L, "admin@clenzy.fr", "en", "ABB");
        }

        @Test
        @DisplayName("getEmbedUrl : jwt avec email blank -> fallback clenzy-org-{orgId}")
        void getEmbedUrl_jwtBlankEmail() {
            Jwt blankJwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-1")
                .claim("email", "   ")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
            when(connectService.getEmbedUrl(100L, 42L, "clenzy-org-42", "fr", null))
                .thenReturn("https://channex.io/iframe");

            controller.getEmbedUrl(100L, "fr", null, blankJwt);

            verify(connectService).getEmbedUrl(100L, 42L, "clenzy-org-42", "fr", null);
        }
    }

    // ─── createOtaChannel ──────────────────────────────────────────────────

    @Nested
    @DisplayName("createOtaChannel")
    class CreateOtaChannel {

        @Test
        @DisplayName("createOtaChannel : body valide + jwt email -> delegue au service")
        void createOtaChannel_valid() {
            ChannexOtaChannelResponse response = ChannexOtaChannelResponse.of(
                "chan-id", "Airbnb - Studio", "Airbnb", "https://channex.io/oauth");
            when(connectService.createOtaChannel(100L, 42L, "Airbnb",
                "admin@clenzy.fr", "fr")).thenReturn(response);

            var result = controller.createOtaChannel(100L,
                new ChannexConnectController.CreateOtaChannelBody("Airbnb"), "fr", jwt);

            assertThat(result.channelId()).isEqualTo("chan-id");
            assertThat(result.embedUrl()).isEqualTo("https://channex.io/oauth");
        }

        @Test
        @DisplayName("createOtaChannel : body null -> IllegalArgumentException")
        void createOtaChannel_nullBody() {
            assertThatThrownBy(() -> controller.createOtaChannel(100L, null, "fr", jwt))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("otaChannelName");
        }

        @Test
        @DisplayName("createOtaChannel : otaChannelName blank -> IllegalArgumentException")
        void createOtaChannel_blankName() {
            assertThatThrownBy(() -> controller.createOtaChannel(100L,
                new ChannexConnectController.CreateOtaChannelBody("   "), "fr", jwt))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("createOtaChannel : otaChannelName null -> IllegalArgumentException")
        void createOtaChannel_nullName() {
            assertThatThrownBy(() -> controller.createOtaChannel(100L,
                new ChannexConnectController.CreateOtaChannelBody(null), "fr", jwt))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("createOtaChannel : jwt null -> username = clenzy-org-{orgId}")
        void createOtaChannel_jwtNull() {
            ChannexOtaChannelResponse response = ChannexOtaChannelResponse.of(
                "c", "t", "n", "u");
            when(connectService.createOtaChannel(100L, 42L, "Airbnb",
                "clenzy-org-42", "fr")).thenReturn(response);

            controller.createOtaChannel(100L,
                new ChannexConnectController.CreateOtaChannelBody("Airbnb"), "fr", null);

            verify(connectService).createOtaChannel(100L, 42L, "Airbnb",
                "clenzy-org-42", "fr");
        }
    }

    // ─── Discovery + Import endpoints ───────────────────────────────────────

    @Nested
    @DisplayName("Discovery / Import")
    class DiscoveryImport {

        @Test
        @DisplayName("discoverUnmapped : delegue a importService")
        void discoverUnmapped_delegates() {
            ChannexDiscoveryResponse expected = ChannexDiscoveryResponse.of(List.of(), 0);
            when(importService.discoverUnmappedProperties(42L)).thenReturn(expected);

            var result = controller.discoverUnmapped();

            assertThat(result.totalInHub()).isZero();
            verify(importService).discoverUnmappedProperties(42L);
        }

        @Test
        @DisplayName("importProperties : jwt avec sub + role HOST -> isPlatformStaff=false")
        void importProperties_hostNotStaff() {
            ChannexImportRequest req = new ChannexImportRequest(
                List.of(new ChannexImportRequest.Item("p-1", "APARTMENT")), null, null);
            ChannexImportResult expected = new ChannexImportResult(1, 1, 0, 0, List.of());
            when(importService.importProperties(eq(42L), eq(req), eq("user-123"), anyBoolean()))
                .thenReturn(expected);

            var result = controller.importProperties(req, jwt);

            assertThat(result.created()).isEqualTo(1);
            verify(importService).importProperties(eq(42L), eq(req), eq("user-123"), anyBoolean());
        }

        @Test
        @DisplayName("importProperties : jwt null -> keycloakId=null")
        void importProperties_jwtNull() {
            ChannexImportRequest req = new ChannexImportRequest(
                List.of(new ChannexImportRequest.Item("p-1", "APARTMENT")), null, null);
            ChannexImportResult expected = new ChannexImportResult(1, 0, 0, 1, List.of());
            when(importService.importProperties(eq(42L), eq(req), eq(null), anyBoolean()))
                .thenReturn(expected);

            controller.importProperties(req, null);

            verify(importService).importProperties(eq(42L), eq(req), eq(null), anyBoolean());
        }

        @Test
        @DisplayName("setupOauth : body valide ABB -> uppercased + delegue")
        void setupOauth_validUpper() {
            ChannexOauthSetupResponse expected = ChannexOauthSetupResponse.of(
                "https://channex.io/iframe", "pivot-1");
            when(importService.setupGlobalOauth(42L, "admin@clenzy.fr",
                "ABB", "fr", null)).thenReturn(expected);

            var result = controller.setupOauth(
                new ChannexConnectController.SetupOauthBody("abb", null), "fr", jwt);

            assertThat(result.embedUrl()).isEqualTo("https://channex.io/iframe");
            verify(importService).setupGlobalOauth(42L, "admin@clenzy.fr",
                "ABB", "fr", null);
        }

        @Test
        @DisplayName("setupOauth : body null -> IllegalArgumentException")
        void setupOauth_nullBody() {
            assertThatThrownBy(() -> controller.setupOauth(null, "fr", jwt))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("channelCode");
        }

        @Test
        @DisplayName("setupOauth : channelCode blank -> IllegalArgumentException")
        void setupOauth_blankChannelCode() {
            assertThatThrownBy(() -> controller.setupOauth(
                new ChannexConnectController.SetupOauthBody("   ", null), "fr", jwt))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("setupOauth : channelCode null -> IllegalArgumentException")
        void setupOauth_nullChannelCode() {
            assertThatThrownBy(() -> controller.setupOauth(
                new ChannexConnectController.SetupOauthBody(null, null), "fr", jwt))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("setupOauth : jwt null -> username = clenzy-org-{orgId}")
        void setupOauth_jwtNull() {
            ChannexOauthSetupResponse expected = ChannexOauthSetupResponse.of(
                "https://channex.io/iframe", "pivot-1");
            when(importService.setupGlobalOauth(42L, "clenzy-org-42",
                "ABB", "fr", null)).thenReturn(expected);

            controller.setupOauth(
                new ChannexConnectController.SetupOauthBody("ABB", null), "fr", null);

            verify(importService).setupGlobalOauth(42L, "clenzy-org-42",
                "ABB", "fr", null);
        }

        @Test
        @DisplayName("setupOauth : jwt avec email blank -> fallback clenzy-org-{orgId}")
        void setupOauth_jwtBlankEmail() {
            Jwt blankJwt = Jwt.withTokenValue("t").header("alg", "RS256")
                .claim("sub", "u-1").claim("email", "")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
            ChannexOauthSetupResponse expected = ChannexOauthSetupResponse.of(
                "https://channex.io/iframe", "pivot-1");
            when(importService.setupGlobalOauth(42L, "clenzy-org-42",
                "ABB", "fr", null)).thenReturn(expected);

            controller.setupOauth(
                new ChannexConnectController.SetupOauthBody("ABB", null), "fr", blankJwt);

            verify(importService).setupGlobalOauth(42L, "clenzy-org-42",
                "ABB", "fr", null);
        }

        @Test
        @DisplayName("setupOauth : existingChannelId passed-through")
        void setupOauth_existingChannelId() {
            ChannexOauthSetupResponse expected = ChannexOauthSetupResponse.of(
                "https://channex.io/iframe", "pivot-1");
            when(importService.setupGlobalOauth(42L, "admin@clenzy.fr",
                "ABB", "fr", "chan-existing")).thenReturn(expected);

            controller.setupOauth(
                new ChannexConnectController.SetupOauthBody("ABB", "chan-existing"), "fr", jwt);

            verify(importService).setupGlobalOauth(42L, "admin@clenzy.fr",
                "ABB", "fr", "chan-existing");
        }
    }

    // ─── OTA channels ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("listConnectedOtaChannels + disconnectOtaChannel")
    class OtaChannels {

        @Test
        @DisplayName("listConnectedOtaChannels : delegue + retourne la liste")
        void listConnectedOta_delegates() {
            ChannexConnectedOta ota = new ChannexConnectedOta(
                "c-1", "My Airbnb", "AirBNB", true, true,
                "Studio", "p-1");
            when(importService.listConnectedOtaChannels(42L)).thenReturn(List.of(ota));

            var result = controller.listConnectedOtaChannels();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).channelId()).isEqualTo("c-1");
        }

        @Test
        @DisplayName("disconnectOtaChannel : delegue au service avec orgId tenant")
        void disconnectOta_delegates() {
            controller.disconnectOtaChannel("c-1");
            verify(importService).disconnectOtaChannel(42L, "c-1");
        }
    }

    // ─── Resync content ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("resyncContent + resyncAllContent")
    class ResyncContent {

        @Test
        @DisplayName("resyncContent : delegue au service avec orgId tenant")
        void resyncContent_delegates() {
            ChannexResyncContentResult expected = new ChannexResyncContentResult(
                100L, "Mon Studio", "Mon Studio Airbnb",
                List.of("WIFI"), List.of("noisecanceler"), 0);
            when(importService.resyncPropertyContent(100L, 42L)).thenReturn(expected);

            var result = controller.resyncContent(100L);

            assertThat(result.clenzyPropertyId()).isEqualTo(100L);
            assertThat(result.mappedAmenities()).contains("WIFI");
        }

        @Test
        @DisplayName("resyncAllContent : delegue + retourne liste vide possible")
        void resyncAllContent_delegates() {
            when(importService.resyncAllPropertiesContent(42L)).thenReturn(List.of());

            var result = controller.resyncAllContent();

            assertThat(result).isEmpty();
            verify(importService).resyncAllPropertiesContent(42L);
        }
    }

    // ─── Reviews + Messages + Stripe paid services ──────────────────────────

    @Nested
    @DisplayName("Reviews + Messages + Stripe paid services")
    class PaidServices {

        @Test
        @DisplayName("replyToReview : body null -> IllegalArgumentException")
        void replyToReview_nullBody() {
            assertThatThrownBy(() -> controller.replyToReview("r-1", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("text");
        }

        @Test
        @DisplayName("replyToReview : text vide -> IllegalArgumentException")
        void replyToReview_emptyText() {
            assertThatThrownBy(() -> controller.replyToReview("r-1",
                new ChannexConnectController.ReviewReplyBody("   ")))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("replyToReview : text null -> IllegalArgumentException")
        void replyToReview_nullText() {
            assertThatThrownBy(() -> controller.replyToReview("r-1",
                new ChannexConnectController.ReviewReplyBody(null)))
                .isInstanceOf(IllegalArgumentException.class);
        }
    }
}
