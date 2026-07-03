package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.RateParityReport;
import com.clenzy.integration.channex.model.ChannexOtaChannel;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexOtaChannelRepository;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.PriceEngine;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("RateParityService (S2 — parite tarifaire local vs canaux Channex)")
class RateParityServiceTest {

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 42L;
    private static final String CHANNEX_PROPERTY_ID = "chx-prop-1";
    private static final String RATE_PLAN_ID = "chx-rp-1";

    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private ChannexOtaChannelRepository otaChannelRepository;
    @Mock private ChannexClient channexClient;
    @Mock private PriceEngine priceEngine;
    @Mock private PropertyRepository propertyRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private RateParityService service;

    @BeforeEach
    void setUp() {
        service = new RateParityService(mappingRepository, otaChannelRepository,
                channexClient, priceEngine, propertyRepository, new BigDecimal("2"));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Stub complet propertyRepository.findById → mock Property de l'org donnee.
     * Le mock est cree et stubbe AVANT le when() externe (jamais d'imbrication
     * de stubbing dans un thenReturn — UnfinishedStubbing sinon).
     */
    private void givenProperty(Long orgId) {
        Property property = mock(Property.class);
        when(property.getOrganizationId()).thenReturn(orgId);
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
    }

    private ChannexPropertyMapping activeMapping() {
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setOrganizationId(ORG_ID);
        mapping.setClenzyPropertyId(PROPERTY_ID);
        mapping.setChannexPropertyId(CHANNEX_PROPERTY_ID);
        mapping.setChannexRoomTypeId("chx-rt-1");
        mapping.setChannexDefaultRatePlanId(RATE_PLAN_ID);
        mapping.setSyncStatus(ChannexSyncStatus.ACTIVE);
        return mapping;
    }

    private JsonNode rateEntry(LocalDate date, String rate) {
        ObjectNode attrs = objectMapper.createObjectNode();
        attrs.put("date", date.toString());
        attrs.put("rate", rate);
        ObjectNode entry = objectMapper.createObjectNode();
        entry.set("attributes", attrs);
        return entry;
    }

    private void givenLocalPrices(Map<LocalDate, BigDecimal> prices) {
        when(priceEngine.resolvePriceRange(eq(PROPERTY_ID), any(LocalDate.class),
                any(LocalDate.class), eq(ORG_ID))).thenReturn(prices);
    }

    private void givenChannexRates(List<JsonNode> entries) {
        when(channexClient.fetchRatesForRange(eq(CHANNEX_PROPERTY_ID), eq(RATE_PLAN_ID),
                any(LocalDate.class), any(LocalDate.class))).thenReturn(Optional.of(entries));
    }

    private ChannexOtaChannel otaChannel(String otaType, boolean enabled) {
        ChannexOtaChannel channel = new ChannexOtaChannel();
        channel.setOtaType(otaType);
        channel.setEnabled(enabled);
        return channel;
    }

    // ─── Detection de disparite ──────────────────────────────────────────────

    @Test
    @DisplayName("ecart au-dessus du seuil (10% > 2%) -> jour en disparite avec ecart et echantillon")
    void whenDeviationAboveThreshold_thenDayFlaggedWithSample() {
        LocalDate today = LocalDate.now();
        givenProperty(ORG_ID);
        when(mappingRepository.findByClenzyPropertyId(PROPERTY_ID, ORG_ID))
                .thenReturn(Optional.of(activeMapping()));
        givenLocalPrices(Map.of(today, new BigDecimal("100.00")));
        givenChannexRates(List.of(rateEntry(today, "110.00")));
        when(otaChannelRepository.findByMappingId(any(UUID.class))).thenReturn(List.of());

        RateParityReport report = service.checkParity(PROPERTY_ID, ORG_ID, 30);

        assertThat(report.note()).isNull();
        assertThat(report.hasDisparity()).isTrue();
        assertThat(report.channels()).hasSize(1);
        RateParityReport.ChannelParity parity = report.channels().get(0);
        assertThat(parity.daysCompared()).isEqualTo(1);
        assertThat(parity.daysInDisparity()).isEqualTo(1);
        assertThat(parity.maxDeviationPercent()).isEqualByComparingTo("10.00");
        assertThat(parity.sampleDates()).hasSize(1);
        RateParityReport.DisparitySample sample = parity.sampleDates().get(0);
        assertThat(sample.date()).isEqualTo(today);
        assertThat(sample.localPrice()).isEqualByComparingTo("100.00");
        assertThat(sample.channelPrice()).isEqualByComparingTo("110.00");
        assertThat(sample.deviationPercent()).isEqualByComparingTo("10.00");
    }

    @Test
    @DisplayName("ecart au seuil exact (2.00% pour un seuil de 2%) -> PAS de disparite (strictement superieur)")
    void whenDeviationAtOrBelowThreshold_thenNoDisparity() {
        LocalDate today = LocalDate.now();
        givenProperty(ORG_ID);
        when(mappingRepository.findByClenzyPropertyId(PROPERTY_ID, ORG_ID))
                .thenReturn(Optional.of(activeMapping()));
        givenLocalPrices(Map.of(today, new BigDecimal("100.00")));
        givenChannexRates(List.of(rateEntry(today, "102.00")));
        when(otaChannelRepository.findByMappingId(any(UUID.class))).thenReturn(List.of());

        RateParityReport report = service.checkParity(PROPERTY_ID, ORG_ID, 30);

        assertThat(report.hasDisparity()).isFalse();
        RateParityReport.ChannelParity parity = report.channels().get(0);
        assertThat(parity.daysCompared()).isEqualTo(1);
        assertThat(parity.daysInDisparity()).isZero();
        assertThat(parity.maxDeviationPercent()).isEqualByComparingTo("2.00");
        assertThat(parity.sampleDates()).isEmpty();
    }

    @Test
    @DisplayName("jours sans prix local exploitable (null) -> non comparables, ignores")
    void whenLocalPriceMissing_thenDayNotCompared() {
        LocalDate today = LocalDate.now();
        LocalDate tomorrow = today.plusDays(1);
        givenProperty(ORG_ID);
        when(mappingRepository.findByClenzyPropertyId(PROPERTY_ID, ORG_ID))
                .thenReturn(Optional.of(activeMapping()));
        Map<LocalDate, BigDecimal> localPrices = new LinkedHashMap<>();
        localPrices.put(today, new BigDecimal("100.00"));
        localPrices.put(tomorrow, null); // PriceEngine : null si aucun tarif applicable
        givenLocalPrices(localPrices);
        givenChannexRates(List.of(rateEntry(today, "150.00"), rateEntry(tomorrow, "150.00")));
        when(otaChannelRepository.findByMappingId(any(UUID.class))).thenReturn(List.of());

        RateParityReport report = service.checkParity(PROPERTY_ID, ORG_ID, 30);

        RateParityReport.ChannelParity parity = report.channels().get(0);
        assertThat(parity.daysCompared()).isEqualTo(1);
        assertThat(parity.daysInDisparity()).isEqualTo(1);
    }

    // ─── Declinaison par canal ───────────────────────────────────────────────

    @Test
    @DisplayName("2 canaux OTA actifs + 1 desactive -> une ligne par canal actif, chiffres partages")
    void whenMultipleChannels_thenOneParityLinePerEnabledChannel() {
        LocalDate today = LocalDate.now();
        givenProperty(ORG_ID);
        when(mappingRepository.findByClenzyPropertyId(PROPERTY_ID, ORG_ID))
                .thenReturn(Optional.of(activeMapping()));
        givenLocalPrices(Map.of(today, new BigDecimal("100.00")));
        givenChannexRates(List.of(rateEntry(today, "120.00")));
        when(otaChannelRepository.findByMappingId(any(UUID.class))).thenReturn(List.of(
                otaChannel("airbnb", true),
                otaChannel("booking_com", true),
                otaChannel("vrbo", false)));

        RateParityReport report = service.checkParity(PROPERTY_ID, ORG_ID, 30);

        assertThat(report.channels()).extracting(RateParityReport.ChannelParity::channel)
                .containsExactly("airbnb", "booking_com");
        assertThat(report.channels()).allSatisfy(parity -> {
            assertThat(parity.ratePlanId()).isEqualTo(RATE_PLAN_ID);
            assertThat(parity.daysInDisparity()).isEqualTo(1);
            assertThat(parity.maxDeviationPercent()).isEqualByComparingTo("20.00");
        });
        assertThat(report.channelsInDisparity()).containsExactly("airbnb", "booking_com");
    }

    @Test
    @DisplayName("aucun canal OTA enregistre -> repli pseudo-canal 'channex'")
    void whenNoOtaChannel_thenFallbackChannel() {
        LocalDate today = LocalDate.now();
        givenProperty(ORG_ID);
        when(mappingRepository.findByClenzyPropertyId(PROPERTY_ID, ORG_ID))
                .thenReturn(Optional.of(activeMapping()));
        givenLocalPrices(Map.of(today, new BigDecimal("100.00")));
        givenChannexRates(List.of(rateEntry(today, "100.00")));
        when(otaChannelRepository.findByMappingId(any(UUID.class))).thenReturn(List.of());

        RateParityReport report = service.checkParity(PROPERTY_ID, ORG_ID, 30);

        assertThat(report.channels()).extracting(RateParityReport.ChannelParity::channel)
                .containsExactly(RateParityService.FALLBACK_CHANNEL);
    }

    // ─── Cas degrades ────────────────────────────────────────────────────────

    @Test
    @DisplayName("pas de mapping Channex -> rapport vide avec note, aucun appel Channex")
    void whenNoMapping_thenEmptyReportWithNote() {
        givenProperty(ORG_ID);
        when(mappingRepository.findByClenzyPropertyId(PROPERTY_ID, ORG_ID))
                .thenReturn(Optional.empty());

        RateParityReport report = service.checkParity(PROPERTY_ID, ORG_ID, null);

        assertThat(report.note()).contains("Aucun mapping Channex");
        assertThat(report.channels()).isEmpty();
        assertThat(report.hasDisparity()).isFalse();
        verifyNoInteractions(channexClient, priceEngine);
    }

    @Test
    @DisplayName("lecture Channex indisponible (Optional.empty) -> rapport vide avec note")
    void whenChannexUnavailable_thenEmptyReportWithNote() {
        givenProperty(ORG_ID);
        when(mappingRepository.findByClenzyPropertyId(PROPERTY_ID, ORG_ID))
                .thenReturn(Optional.of(activeMapping()));
        givenLocalPrices(Map.of(LocalDate.now(), new BigDecimal("100.00")));
        when(channexClient.fetchRatesForRange(eq(CHANNEX_PROPERTY_ID), eq(RATE_PLAN_ID),
                any(LocalDate.class), any(LocalDate.class))).thenReturn(Optional.empty());

        RateParityReport report = service.checkParity(PROPERTY_ID, ORG_ID, 30);

        assertThat(report.note()).contains("indisponible");
        assertThat(report.channels()).isEmpty();
    }

    @Test
    @DisplayName("mapping non ACTIVE -> rapport vide avec note, aucun appel Channex")
    void whenMappingNotActive_thenEmptyReportWithNote() {
        givenProperty(ORG_ID);
        ChannexPropertyMapping mapping = activeMapping();
        mapping.setSyncStatus(ChannexSyncStatus.ERROR);
        when(mappingRepository.findByClenzyPropertyId(PROPERTY_ID, ORG_ID))
                .thenReturn(Optional.of(mapping));

        RateParityReport report = service.checkParity(PROPERTY_ID, ORG_ID, 30);

        assertThat(report.note()).contains("non actif");
        verifyNoInteractions(channexClient, priceEngine);
    }

    // ─── Securite ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("propriete d'une autre org -> AccessDeniedException (ownership)")
    void whenPropertyNotInOrg_thenAccessDenied() {
        givenProperty(999L);

        assertThatThrownBy(() -> service.checkParity(PROPERTY_ID, ORG_ID, 30))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(channexClient, priceEngine, mappingRepository);
    }

    @Test
    @DisplayName("propriete introuvable -> IllegalStateException")
    void whenPropertyMissing_thenIllegalState() {
        when(propertyRepository.findById(anyLong())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.checkParity(PROPERTY_ID, ORG_ID, 30))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("introuvable");
    }
}
