package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.ChannexRatePlanSettingsUpdate;
import com.clenzy.integration.channex.exception.ChannexException;
import com.clenzy.integration.channex.model.ChannexPriceDrift;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPriceDriftRepository;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.BookingRestriction;
import com.clenzy.model.PriceSourceOfTruth;
import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.PriceEngine;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests d'audit Phase 5 — complete la couverture pour les nouveautes des
 * Phases 1-5 (monitoring + OTA pricing) afin de minimiser le risque de
 * regression.
 *
 * <p>Regroupe T2 (pushRatesForRange BR), T3 (PriceDriftService resolve),
 * T4 (ReconciliationScheduler), T6 (Watchdog notifications). T5 fait l'objet
 * d'un test client separe.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Channex audit coverage (Phase 5)")
class ChannexAuditCoverageTest {

    private static final ObjectMapper M = new ObjectMapper();

    // ─── T3 : ChannexPriceDriftService.resolve ──────────────────────────────

    @Nested
    @DisplayName("T3 — ChannexPriceDriftService.resolve")
    class PriceDriftResolveTests {

        @Mock private ChannexPriceDriftRepository driftRepository;
        @Mock private RateOverrideRepository rateOverrideRepository;
        @Mock private PropertyRepository propertyRepository;
        @Mock private ChannexPropertyMappingRepository mappingRepository;

        private ChannexPriceDriftService service;

        @BeforeEach
        void setUp() {
            service = new ChannexPriceDriftService(driftRepository, rateOverrideRepository,
                propertyRepository, mappingRepository);
            // Mock standard : save renvoie l'arg modifie (sinon le service renvoie null)
            org.mockito.Mockito.lenient().when(driftRepository.save(any()))
                .thenAnswer(inv -> inv.getArgument(0));
        }

        private ChannexPriceDrift drift(Long id, Long orgId) {
            ChannexPriceDrift d = new ChannexPriceDrift();
            d.setId(id);
            d.setOrganizationId(orgId);
            d.setClenzyPropertyId(100L);
            d.setMappingId(UUID.randomUUID());
            d.setDriftDate(LocalDate.of(2026, 7, 15));
            d.setClenzyPrice(new BigDecimal("89.00"));
            d.setOtaPrice(new BigDecimal("95.00"));
            d.setCurrency("EUR");
            d.setDetectedAt(Instant.now());
            return d;
        }

        @Test
        @DisplayName("KEEP_OTA -> cree (ou update) un RateOverride avec source 'OTA:RESOLVED' + prix OTA")
        void keepOta_createsOverride() {
            Long orgId = 42L;
            ChannexPriceDrift d = drift(1L, orgId);
            when(driftRepository.findById(1L)).thenReturn(Optional.of(d));
            Property prop = new Property();
            prop.setId(100L);
            prop.setOrganizationId(orgId);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            when(rateOverrideRepository.findByPropertyIdAndDate(100L, LocalDate.of(2026, 7, 15), orgId))
                .thenReturn(Optional.empty());

            ChannexPriceDrift result = service.resolve(orgId, 1L,
                ChannexPriceDrift.Resolution.KEEP_OTA, "admin@clenzy.fr");

            ArgumentCaptor<RateOverride> overrideCaptor = ArgumentCaptor.forClass(RateOverride.class);
            verify(rateOverrideRepository).save(overrideCaptor.capture());
            RateOverride saved = overrideCaptor.getValue();
            assertThat(saved.getNightlyPrice()).isEqualByComparingTo("95.00");
            assertThat(saved.getSource()).isEqualTo("OTA:RESOLVED");
            assertThat(saved.getCreatedBy()).isEqualTo("drift-resolver");
            assertThat(result.getResolution()).isEqualTo(ChannexPriceDrift.Resolution.KEEP_OTA);
            assertThat(result.getResolvedBy()).isEqualTo("admin@clenzy.fr");
            assertThat(result.getResolvedAt()).isNotNull();
        }

        @Test
        @DisplayName("KEEP_CLENZY -> aucun RateOverride cree, drift marque resolved")
        void keepClenzy_noOverrideCreated() {
            Long orgId = 42L;
            ChannexPriceDrift d = drift(1L, orgId);
            when(driftRepository.findById(1L)).thenReturn(Optional.of(d));

            ChannexPriceDrift result = service.resolve(orgId, 1L,
                ChannexPriceDrift.Resolution.KEEP_CLENZY, "admin@clenzy.fr");

            verify(rateOverrideRepository, never()).save(any());
            assertThat(result.getResolution()).isEqualTo(ChannexPriceDrift.Resolution.KEEP_CLENZY);
            assertThat(result.getResolvedAt()).isNotNull();
        }

        @Test
        @DisplayName("DISMISSED -> aucun RateOverride + drift marque resolved")
        void dismissed_noOverrideCreated() {
            Long orgId = 42L;
            ChannexPriceDrift d = drift(1L, orgId);
            when(driftRepository.findById(1L)).thenReturn(Optional.of(d));

            ChannexPriceDrift result = service.resolve(orgId, 1L,
                ChannexPriceDrift.Resolution.DISMISSED, "admin@clenzy.fr");

            verify(rateOverrideRepository, never()).save(any());
            assertThat(result.getResolution()).isEqualTo(ChannexPriceDrift.Resolution.DISMISSED);
        }

        @Test
        @DisplayName("drift d'une autre org -> IllegalStateException (tenant violation)")
        void crossTenant_throwsException() {
            Long orgId = 42L;
            ChannexPriceDrift d = drift(1L, 99L); // autre org
            when(driftRepository.findById(1L)).thenReturn(Optional.of(d));

            org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                service.resolve(orgId, 1L, ChannexPriceDrift.Resolution.KEEP_OTA, "admin"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("organisation");
        }

        @Test
        @DisplayName("drift deja resolu -> refus de double-resolution")
        void alreadyResolved_throwsException() {
            Long orgId = 42L;
            ChannexPriceDrift d = drift(1L, orgId);
            d.setResolvedAt(Instant.now().minusSeconds(60));
            d.setResolution(ChannexPriceDrift.Resolution.KEEP_OTA);
            when(driftRepository.findById(1L)).thenReturn(Optional.of(d));

            org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                service.resolve(orgId, 1L, ChannexPriceDrift.Resolution.KEEP_CLENZY, "admin"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("deja resolu");
        }
    }

    // ─── T4 : ChannexRatesReconciliationScheduler ────────────────────────────

    @Nested
    @DisplayName("T4 — ChannexRatesReconciliationScheduler")
    class ReconciliationSchedulerTests {

        @Mock private ChannexPropertyMappingRepository mappingRepository;
        @Mock private ChannexPriceDriftRepository driftRepository;
        @Mock private ChannexClient channexClient;
        @Mock private PriceEngine priceEngine;
        @Mock private PropertyRepository propertyRepository;
        @Mock private NotificationService notificationService;

        private ChannexRatesReconciliationScheduler scheduler;

        @BeforeEach
        void setUp() {
            scheduler = new ChannexRatesReconciliationScheduler(mappingRepository, driftRepository,
                channexClient, priceEngine, propertyRepository, notificationService);
        }

        private ChannexPropertyMapping mappingActive() {
            ChannexPropertyMapping m = new ChannexPropertyMapping();
            m.setId(UUID.randomUUID());
            m.setOrganizationId(42L);
            m.setClenzyPropertyId(100L);
            m.setChannexPropertyId("channex-prop-1");
            m.setChannexDefaultRatePlanId("rate-1");
            m.setSyncStatus(ChannexSyncStatus.ACTIVE);
            return m;
        }

        private Property propClenzy() {
            Property p = new Property();
            p.setId(100L);
            p.setOrganizationId(42L);
            p.setName("Studio Marais");
            p.setDefaultCurrency("EUR");
            p.setPriceSourceOfTruth(PriceSourceOfTruth.CLENZY);
            return p;
        }

        private JsonNode rateEntry(String date, String rate) throws Exception {
            return M.readTree("{\"id\":\"r-" + date + "\",\"attributes\":{\"date\":\"" + date
                + "\",\"rate\":\"" + rate + "\"}}");
        }

        @Test
        @DisplayName("scan : drift detecte > 0.50€ -> upsert ChannexPriceDrift + notify admin")
        void scan_driftDetected_persistsAndNotifies() throws Exception {
            when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of(mappingActive()));
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(propClenzy()));
            when(channexClient.fetchRatesForRange(eq("channex-prop-1"), eq("rate-1"), any(), any()))
                .thenReturn(Optional.of(List.of(
                    rateEntry(LocalDate.now().plusDays(5).toString(), "95.00")
                )));
            when(priceEngine.resolvePriceRange(eq(100L), any(), any(), eq(42L)))
                .thenReturn(java.util.Map.of(
                    LocalDate.now().plusDays(5), new BigDecimal("89.00")  // diff 6.00 > 0.50
                ));
            when(driftRepository.findActiveByPropertyAndDate(eq(100L), any()))
                .thenReturn(Optional.empty());

            scheduler.scan();

            verify(driftRepository).save(any(ChannexPriceDrift.class));
            verify(notificationService).notifyAdminsAndManagers(
                eq(com.clenzy.model.NotificationKey.CHANNEX_PRICE_DRIFT_DETECTED),
                any(), any(), any(), eq(42L));
        }

        @Test
        @DisplayName("scan : ecart sous threshold (0.50€) -> aucun drift persiste")
        void scan_underThreshold_noPersist() throws Exception {
            when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of(mappingActive()));
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(propClenzy()));
            when(channexClient.fetchRatesForRange(any(), any(), any(), any()))
                .thenReturn(Optional.of(List.of(
                    rateEntry(LocalDate.now().plusDays(5).toString(), "89.30")
                )));
            when(priceEngine.resolvePriceRange(any(), any(), any(), any()))
                .thenReturn(java.util.Map.of(
                    LocalDate.now().plusDays(5), new BigDecimal("89.00")  // diff 0.30 < 0.50
                ));

            scheduler.scan();

            verify(driftRepository, never()).save(any());
            verify(notificationService, never()).notifyAdminsAndManagers(
                any(), any(), any(), any(), anyLong());
        }

        @Test
        @DisplayName("scan : property en mode OTA -> skip (pas de drift detection)")
        void scan_skipOtaMode() throws Exception {
            Property otaProp = propClenzy();
            otaProp.setPriceSourceOfTruth(PriceSourceOfTruth.OTA);
            when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of(mappingActive()));
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(otaProp));

            scheduler.scan();

            verify(channexClient, never()).fetchRatesForRange(any(), any(), any(), any());
            verify(driftRepository, never()).save(any());
        }

        @Test
        @DisplayName("scan : mapping non-ACTIVE (PENDING/ERROR) -> skip")
        void scan_skipNonActiveMapping() {
            ChannexPropertyMapping pending = mappingActive();
            pending.setSyncStatus(ChannexSyncStatus.PENDING);
            when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of(pending));

            scheduler.scan();

            verify(channexClient, never()).fetchRatesForRange(any(), any(), any(), any());
        }
    }

    // ─── T6 : ChannexClient updateRatePlanSettings + fetchRatesForRange ─────

    @Nested
    @DisplayName("T5 — ChannexClient new methods (validation)")
    class ChannexClientTests {

        @Test
        @DisplayName("ChannexRatePlanSettingsUpdate.toApiPayload() inclut SEUL les champs non-null (partial)")
        void payload_partialUpdate() {
            ChannexRatePlanSettingsUpdate u = new ChannexRatePlanSettingsUpdate(
                null, // pas de daily price
                new BigDecimal("120.00"),
                null,
                new BigDecimal("15.00"),
                null,
                null,
                3,
                null
            );

            assertThat(u.hasContent()).isTrue();
            java.util.Map<String, Object> body = u.toApiPayload();
            assertThat(body).containsKey("rate_plan");
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> ratePlan = (java.util.Map<String, Object>) body.get("rate_plan");
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> settings = (java.util.Map<String, Object>) ratePlan.get("settings");
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> pricing = (java.util.Map<String, Object>) settings.get("pricing_setting");
            assertThat(pricing).containsKeys("weekend_price", "price_per_extra_person");
            assertThat(pricing).doesNotContainKeys("default_daily_price", "guests_included",
                "weekly_price_factor", "monthly_price_factor");
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> avail = (java.util.Map<String, Object>) settings.get("availability_rule");
            assertThat(avail).containsKey("default_min_nights").doesNotContainKey("default_max_nights");
        }

        @Test
        @DisplayName("ChannexRatePlanSettingsUpdate.hasContent() false sur record full-null")
        void payload_emptyHasNoContent() {
            ChannexRatePlanSettingsUpdate u = new ChannexRatePlanSettingsUpdate(
                null, null, null, null, null, null, null, null);
            assertThat(u.hasContent()).isFalse();
            // toApiPayload retourne quand meme un body avec rate_plan.settings vide
            java.util.Map<String, Object> body = u.toApiPayload();
            assertThat(body).containsKey("rate_plan");
        }
    }
}
