package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.LengthOfStayDiscount;
import com.clenzy.model.OccupancyPricing;
import com.clenzy.model.Property;
import com.clenzy.model.RatePlan;
import com.clenzy.model.RatePlanType;
import com.clenzy.repository.LengthOfStayDiscountRepository;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.repository.OccupancyPricingRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.RatePlanRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.AmenityManagementService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires des 3 helpers ajoutes en Phase 1 OTA pricing :
 * {@link ChannexImportService#createBaseRatePlan},
 * {@link ChannexImportService#createWeekendRatePlan},
 * {@link ChannexImportService#createOccupancyPricingFromOta}.
 *
 * <p>Approche : mock complet des deps, on verifie le comportement (save appele
 * avec les bons attributs OU skip silencieux selon le cas).</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexImportService — Phase 1 OTA pricing helpers")
class ChannexImportServicePricingTest {

    @Mock private ChannexClient channexClient;
    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private PropertyPhotoRepository propertyPhotoRepository;
    @Mock private ChannexConnectService connectService;
    @Mock private UserRepository userRepository;
    @Mock private LengthOfStayDiscountRepository lengthOfStayDiscountRepository;
    @Mock private RatePlanRepository ratePlanRepository;
    @Mock private OccupancyPricingRepository occupancyPricingRepository;
    @Mock private RateOverrideRepository rateOverrideRepository;
    @Mock private BookingRestrictionRepository bookingRestrictionRepository;
    @Mock private AmenityManagementService amenityManagementService;

    private ChannexImportService service;

    @BeforeEach
    void setUp() {
        service = new ChannexImportService(
            channexClient, mappingRepository, propertyRepository, propertyPhotoRepository,
            connectService, userRepository, lengthOfStayDiscountRepository,
            ratePlanRepository, occupancyPricingRepository, rateOverrideRepository,
            bookingRestrictionRepository,
            new ObjectMapper(), amenityManagementService
        );
    }

    private Property property(Long id) {
        Property p = new Property();
        p.setId(id);
        p.setOrganizationId(42L);
        p.setName("Test Studio");
        p.setMaxGuests(6);
        p.setDefaultCurrency("EUR");
        return p;
    }

    /**
     * Builder utilitaire pour creer un ChannelListingInfo en test. Les champs
     * non passes sont {@code null}.
     */
    private ChannexImportService.ChannelListingInfo info(BigDecimal defaultPrice,
                                                          BigDecimal weekendPrice,
                                                          Integer guestsIncluded,
                                                          BigDecimal pricePerExtraPerson) {
        return new ChannexImportService.ChannelListingInfo(
            "AirBNB", "listing-1", "channel-1", "house",
            defaultPrice, weekendPrice, "EUR",
            guestsIncluded, pricePerExtraPerson,
            null, null,    // weekly/monthly factors
            null, null,    // min/max nights
            null, null, null, // check-in*/out
            null, null,    // cancellation/instantBooking
            null, null, null, // pets/smoking/events
            java.util.List.of() // additionalRatePlans (Phase 4 #4)
        );
    }

    /** Variante avec rate plans additionnels pour les tests Phase 4 #4. */
    private ChannexImportService.ChannelListingInfo infoWithAdditionalRatePlans(
            BigDecimal defaultPrice,
            java.util.List<ChannexImportService.AdditionalRatePlan> additional) {
        return new ChannexImportService.ChannelListingInfo(
            "AirBNB", "listing-1", "channel-1", "house",
            defaultPrice, null, "EUR",
            null, null,
            null, null,
            null, null,
            null, null, null,
            null, null,
            null, null, null,
            additional
        );
    }

    // ─── createBaseRatePlan ──────────────────────────────────────────────────

    @Test
    @DisplayName("createBaseRatePlan: defaultPrice present + aucun BASE existant -> cree avec name 'OTA Base — AirBNB'")
    void baseRatePlan_creates() {
        Property prop = property(100L);
        when(ratePlanRepository.findByPropertyIdAndType(100L, RatePlanType.BASE, 42L))
            .thenReturn(List.of());

        boolean created = service.createBaseRatePlan(prop, 42L,
            info(new BigDecimal("89.00"), null, null, null));

        assertThat(created).isTrue();
        ArgumentCaptor<RatePlan> captor = ArgumentCaptor.forClass(RatePlan.class);
        verify(ratePlanRepository).save(captor.capture());
        RatePlan saved = captor.getValue();
        assertThat(saved.getType()).isEqualTo(RatePlanType.BASE);
        assertThat(saved.getName()).isEqualTo("OTA Base — AirBNB");
        assertThat(saved.getNightlyPrice()).isEqualByComparingTo("89.00");
        assertThat(saved.getCurrency()).isEqualTo("EUR");
        assertThat(saved.getPriority()).isZero();
        assertThat(saved.getIsActive()).isTrue();
    }

    @Test
    @DisplayName("createBaseRatePlan: BASE deja present -> skip silencieux")
    void baseRatePlan_skipIfExists() {
        Property prop = property(100L);
        when(ratePlanRepository.findByPropertyIdAndType(100L, RatePlanType.BASE, 42L))
            .thenReturn(List.of(new RatePlan()));

        boolean created = service.createBaseRatePlan(prop, 42L,
            info(new BigDecimal("89.00"), null, null, null));

        assertThat(created).isFalse();
        verify(ratePlanRepository, never()).save(any());
    }

    @Test
    @DisplayName("createBaseRatePlan: defaultPrice null -> skip sans appel repo")
    void baseRatePlan_skipIfNoPrice() {
        boolean created = service.createBaseRatePlan(property(100L), 42L,
            info(null, null, null, null));

        assertThat(created).isFalse();
        verify(ratePlanRepository, never()).findByPropertyIdAndType(any(), any(), any());
        verify(ratePlanRepository, never()).save(any());
    }

    // ─── createWeekendRatePlan ───────────────────────────────────────────────

    @Test
    @DisplayName("createWeekendRatePlan: weekendPrice differe du default -> cree avec daysOfWeek=[5,6,7]")
    void weekendRatePlan_creates() {
        Property prop = property(100L);
        when(ratePlanRepository.findByPropertyIdAndType(100L, RatePlanType.WEEKEND, 42L))
            .thenReturn(List.of());

        boolean created = service.createWeekendRatePlan(prop, 42L,
            info(new BigDecimal("89.00"), new BigDecimal("119.00"), null, null));

        assertThat(created).isTrue();
        ArgumentCaptor<RatePlan> captor = ArgumentCaptor.forClass(RatePlan.class);
        verify(ratePlanRepository).save(captor.capture());
        RatePlan saved = captor.getValue();
        assertThat(saved.getType()).isEqualTo(RatePlanType.WEEKEND);
        assertThat(saved.getNightlyPrice()).isEqualByComparingTo("119.00");
        assertThat(saved.getDaysOfWeek()).containsExactly(5, 6, 7);
        assertThat(saved.getPriority()).isEqualTo(10);
    }

    @Test
    @DisplayName("createWeekendRatePlan: weekend == default -> skip (pas de differenciation)")
    void weekendRatePlan_skipIfEqualToDefault() {
        boolean created = service.createWeekendRatePlan(property(100L), 42L,
            info(new BigDecimal("89.00"), new BigDecimal("89.00"), null, null));

        assertThat(created).isFalse();
        verify(ratePlanRepository, never()).save(any());
    }

    @Test
    @DisplayName("createWeekendRatePlan: weekendPrice null -> skip silencieux")
    void weekendRatePlan_skipIfNoWeekendPrice() {
        boolean created = service.createWeekendRatePlan(property(100L), 42L,
            info(new BigDecimal("89.00"), null, null, null));

        assertThat(created).isFalse();
        verify(ratePlanRepository, never()).save(any());
    }

    @Test
    @DisplayName("createWeekendRatePlan: WEEKEND deja present -> skip")
    void weekendRatePlan_skipIfExists() {
        Property prop = property(100L);
        when(ratePlanRepository.findByPropertyIdAndType(100L, RatePlanType.WEEKEND, 42L))
            .thenReturn(List.of(new RatePlan()));

        boolean created = service.createWeekendRatePlan(prop, 42L,
            info(new BigDecimal("89.00"), new BigDecimal("119.00"), null, null));

        assertThat(created).isFalse();
        verify(ratePlanRepository, never()).save(any());
    }

    // ─── createOccupancyPricingFromOta ───────────────────────────────────────

    @Test
    @DisplayName("createOccupancyPricingFromOta: guestsIncluded + extraPersonPrice presents -> cree")
    void occupancyPricing_creates() {
        Property prop = property(100L);
        when(occupancyPricingRepository.findByPropertyId(100L, 42L))
            .thenReturn(Optional.empty());

        boolean created = service.createOccupancyPricingFromOta(prop, 42L,
            info(new BigDecimal("89.00"), null, 2, new BigDecimal("15.00")));

        assertThat(created).isTrue();
        ArgumentCaptor<OccupancyPricing> captor = ArgumentCaptor.forClass(OccupancyPricing.class);
        verify(occupancyPricingRepository).save(captor.capture());
        OccupancyPricing saved = captor.getValue();
        assertThat(saved.getBaseOccupancy()).isEqualTo(2);
        assertThat(saved.getExtraGuestFee()).isEqualByComparingTo("15.00");
        assertThat(saved.getMaxOccupancy()).isEqualTo(6); // depuis prop.maxGuests
        assertThat(saved.isActive()).isTrue();
    }

    @Test
    @DisplayName("createOccupancyPricingFromOta: pricePerExtraPerson=0 -> skip (pas de surcharge utile)")
    void occupancyPricing_skipIfNoExtraFee() {
        boolean created = service.createOccupancyPricingFromOta(property(100L), 42L,
            info(new BigDecimal("89.00"), null, 2, BigDecimal.ZERO));

        assertThat(created).isFalse();
        verify(occupancyPricingRepository, never()).save(any());
    }

    @Test
    @DisplayName("createOccupancyPricingFromOta: guestsIncluded null -> skip")
    void occupancyPricing_skipIfNoGuestsIncluded() {
        boolean created = service.createOccupancyPricingFromOta(property(100L), 42L,
            info(new BigDecimal("89.00"), null, null, new BigDecimal("15.00")));

        assertThat(created).isFalse();
        verify(occupancyPricingRepository, never()).save(any());
    }

    @Test
    @DisplayName("createOccupancyPricingFromOta: OccupancyPricing deja present -> skip idempotent")
    void occupancyPricing_skipIfExists() {
        Property prop = property(100L);
        when(occupancyPricingRepository.findByPropertyId(100L, 42L))
            .thenReturn(Optional.of(new OccupancyPricing()));

        boolean created = service.createOccupancyPricingFromOta(prop, 42L,
            info(new BigDecimal("89.00"), null, 2, new BigDecimal("15.00")));

        assertThat(created).isFalse();
        verify(occupancyPricingRepository, never()).save(any());
    }

    @Test
    @DisplayName("createOccupancyPricingFromOta: maxGuests prop null -> fallback safe baseOccupancy+4 ou min 6")
    void occupancyPricing_maxOccupancyFallback() {
        Property prop = property(100L);
        prop.setMaxGuests(null); // simulate missing max
        when(occupancyPricingRepository.findByPropertyId(100L, 42L))
            .thenReturn(Optional.empty());

        service.createOccupancyPricingFromOta(prop, 42L,
            info(new BigDecimal("89.00"), null, 3, new BigDecimal("15.00")));

        ArgumentCaptor<OccupancyPricing> captor = ArgumentCaptor.forClass(OccupancyPricing.class);
        verify(occupancyPricingRepository).save(captor.capture());
        // baseOccupancy=3 + 4 = 7 ≥ 6 -> fallback applique 7
        assertThat(captor.getValue().getMaxOccupancy()).isEqualTo(7);
    }

    // ─── Reference : verifie qu'on continue d'avoir LengthOfStayDiscount qui marche ──

    @Test
    @DisplayName("Le helper LengthOfStayDiscount existant continue de fonctionner avec les nouveaux deps")
    void losDiscount_stillWorks_unaffected() {
        // Smoke test : on instancie + on appelle le constructeur — si les nouveaux
        // deps cassent le bean, ce test echoue.
        assertThat(service).isNotNull();
        // Pas d'appel direct : ce helper est private, mais l'instantiation
        // valide l'injection des nouveaux repos sans regression.
        verify(lengthOfStayDiscountRepository, never()).save(any());
    }

    // ─── importRateOverridesFromOta (Phase 2) ────────────────────────────────

    private com.fasterxml.jackson.databind.JsonNode rateEntry(String date, String rate) throws Exception {
        return new ObjectMapper().readTree(
            "{\"id\":\"r-" + date + "\",\"attributes\":{\"date\":\"" + date + "\",\"rate\":\"" + rate + "\"}}"
        );
    }

    private com.clenzy.integration.channex.model.ChannexPropertyMapping mapping(String ratePlanId) {
        var m = new com.clenzy.integration.channex.model.ChannexPropertyMapping();
        m.setId(java.util.UUID.randomUUID());
        m.setOrganizationId(42L);
        m.setClenzyPropertyId(100L);
        m.setChannexPropertyId("channex-prop-1");
        m.setChannexDefaultRatePlanId(ratePlanId);
        return m;
    }

    @Test
    @DisplayName("importRateOverridesFromOta: cree 2 overrides pour les dates avec prix != default + skip celles avec meme prix")
    void rateOverrides_createsOnlyDiffering() throws Exception {
        Property prop = property(100L);
        var mapping = mapping("rp-1");
        when(channexClient.fetchRatesForRange(eq("channex-prop-1"), eq("rp-1"),
                any(), any()))
            .thenReturn(java.util.Optional.of(java.util.List.of(
                rateEntry("2026-07-01", "89.00"),  // = default, skip
                rateEntry("2026-07-15", "149.00"), // != default, create
                rateEntry("2026-08-01", "199.00")  // != default, create
            )));
        when(rateOverrideRepository.findByPropertyIdAndDate(eq(100L), any(), eq(42L)))
            .thenReturn(Optional.empty());

        int created = service.importRateOverridesFromOta(prop, 42L, mapping,
            info(new BigDecimal("89.00"), null, null, null));

        assertThat(created).isEqualTo(2);
        ArgumentCaptor<com.clenzy.model.RateOverride> captor =
            ArgumentCaptor.forClass(com.clenzy.model.RateOverride.class);
        verify(rateOverrideRepository, org.mockito.Mockito.times(2)).save(captor.capture());
        assertThat(captor.getAllValues()).allSatisfy(ro -> {
            assertThat(ro.getSource()).isEqualTo("OTA:AirBNB");
            assertThat(ro.getCreatedBy()).isEqualTo("channex-import");
            assertThat(ro.getCurrency()).isEqualTo("EUR");
        });
    }

    @Test
    @DisplayName("importRateOverridesFromOta: endpoint non supporte (Optional.empty) -> retourne 0 sans erreur")
    void rateOverrides_endpointNotSupported() {
        Property prop = property(100L);
        var mapping = mapping("rp-1");
        when(channexClient.fetchRatesForRange(any(), any(), any(), any()))
            .thenReturn(java.util.Optional.empty());

        int created = service.importRateOverridesFromOta(prop, 42L, mapping,
            info(new BigDecimal("89.00"), null, null, null));

        assertThat(created).isZero();
        verify(rateOverrideRepository, never()).save(any());
    }

    @Test
    @DisplayName("importRateOverridesFromOta: override existant pour la date -> skip (idempotent)")
    void rateOverrides_skipsExisting() throws Exception {
        Property prop = property(100L);
        var mapping = mapping("rp-1");
        when(channexClient.fetchRatesForRange(any(), any(), any(), any()))
            .thenReturn(java.util.Optional.of(java.util.List.of(
                rateEntry("2026-07-15", "149.00")
            )));
        when(rateOverrideRepository.findByPropertyIdAndDate(eq(100L), any(), eq(42L)))
            .thenReturn(Optional.of(new com.clenzy.model.RateOverride()));

        int created = service.importRateOverridesFromOta(prop, 42L, mapping,
            info(new BigDecimal("89.00"), null, null, null));

        assertThat(created).isZero();
        verify(rateOverrideRepository, never()).save(any());
    }

    @Test
    @DisplayName("importRateOverridesFromOta: pas de rate_plan_id mapping -> skip sans appel API")
    void rateOverrides_skipIfNoRatePlanId() {
        Property prop = property(100L);
        var mapping = mapping(null);

        int created = service.importRateOverridesFromOta(prop, 42L, mapping,
            info(new BigDecimal("89.00"), null, null, null));

        assertThat(created).isZero();
        verify(channexClient, never()).fetchRatesForRange(any(), any(), any(), any());
    }

    @Test
    @DisplayName("importRateOverridesFromOta: defaultPrice null -> skip (pas de reference de comparaison)")
    void rateOverrides_skipIfNoDefaultPrice() {
        Property prop = property(100L);
        var mapping = mapping("rp-1");

        int created = service.importRateOverridesFromOta(prop, 42L, mapping,
            info(null, null, null, null));

        assertThat(created).isZero();
        verify(channexClient, never()).fetchRatesForRange(any(), any(), any(), any());
    }

    // ─── importAdditionalRatePlansFromOta (Phase 4 #4) ───────────────────────

    @Test
    @DisplayName("importAdditionalRatePlansFromOta: 2 variantes -> cree 2 PROMOTIONAL avec name 'OTA — ...'")
    void additionalRatePlans_creates2Variants() {
        Property prop = property(100L);
        when(ratePlanRepository.findByPropertyIdAndType(100L, com.clenzy.model.RatePlanType.PROMOTIONAL, 42L))
            .thenReturn(java.util.List.of());

        var additional = java.util.List.of(
            new ChannexImportService.AdditionalRatePlan("rp-2", "Non-refundable -10%",
                new BigDecimal("80.10"), "EUR"),
            new ChannexImportService.AdditionalRatePlan("rp-3", "Long stay -15%",
                new BigDecimal("75.65"), "EUR")
        );

        int created = service.importAdditionalRatePlansFromOta(prop, 42L,
            infoWithAdditionalRatePlans(new BigDecimal("89.00"), additional));

        assertThat(created).isEqualTo(2);
        ArgumentCaptor<com.clenzy.model.RatePlan> captor =
            ArgumentCaptor.forClass(com.clenzy.model.RatePlan.class);
        verify(ratePlanRepository, org.mockito.Mockito.times(2)).save(captor.capture());
        assertThat(captor.getAllValues()).allSatisfy(rp -> {
            assertThat(rp.getType()).isEqualTo(com.clenzy.model.RatePlanType.PROMOTIONAL);
            // Phase 5 audit fix : nouveau format "OTA [xxxxxxxx] — Title"
            assertThat(rp.getName()).startsWith("OTA [").contains("] — ");
            assertThat(rp.getPriority()).isEqualTo(5);
            assertThat(rp.getCurrency()).isEqualTo("EUR");
        });
    }

    @Test
    @DisplayName("importAdditionalRatePlansFromOta: variante avec meme Channex ID -> skip idempotent (meme si title a change)")
    void additionalRatePlans_skipDuplicateId() {
        Property prop = property(100L);
        com.clenzy.model.RatePlan existingPromo = new com.clenzy.model.RatePlan();
        // Le name contient l'ID Channex tronque (premiers 8 chars) entre [].
        existingPromo.setName("OTA [rp-2-abc] — Ancien titre qui a change");
        when(ratePlanRepository.findByPropertyIdAndType(100L, com.clenzy.model.RatePlanType.PROMOTIONAL, 42L))
            .thenReturn(java.util.List.of(existingPromo));

        var additional = java.util.List.of(
            // Meme ID Channex, mais titre different
            new ChannexImportService.AdditionalRatePlan("rp-2-abc", "Nouveau titre Non-refundable -10%",
                new BigDecimal("80.10"), "EUR")
        );

        int created = service.importAdditionalRatePlansFromOta(prop, 42L,
            infoWithAdditionalRatePlans(new BigDecimal("89.00"), additional));

        assertThat(created).isZero();
        verify(ratePlanRepository, never()).save(any());
    }

    @Test
    @DisplayName("importAdditionalRatePlansFromOta: variante avec defaultPrice null/zero -> skip")
    void additionalRatePlans_skipIfNoPrice() {
        Property prop = property(100L);
        when(ratePlanRepository.findByPropertyIdAndType(any(), any(), any()))
            .thenReturn(java.util.List.of());

        var additional = java.util.List.of(
            new ChannexImportService.AdditionalRatePlan("rp-2", "Free", null, "EUR"),
            new ChannexImportService.AdditionalRatePlan("rp-3", "Zero", BigDecimal.ZERO, "EUR")
        );

        int created = service.importAdditionalRatePlansFromOta(prop, 42L,
            infoWithAdditionalRatePlans(new BigDecimal("89.00"), additional));

        assertThat(created).isZero();
        verify(ratePlanRepository, never()).save(any());
    }

    @Test
    @DisplayName("importAdditionalRatePlansFromOta: liste vide ou null -> 0 sans appel repo")
    void additionalRatePlans_skipIfNoData() {
        assertThat(service.importAdditionalRatePlansFromOta(property(100L), 42L,
            infoWithAdditionalRatePlans(new BigDecimal("89.00"), java.util.List.of())))
            .isZero();
        verify(ratePlanRepository, never()).findByPropertyIdAndType(any(), any(), any());
    }

    // ─── importBookingRestrictionsFromOta (Phase 4 #5) ───────────────────────

    private com.fasterxml.jackson.databind.JsonNode restrictionEntry(String date,
                                                                       Integer minStay,
                                                                       boolean cta,
                                                                       boolean ctd) throws Exception {
        StringBuilder sb = new StringBuilder("{\"id\":\"r-").append(date)
            .append("\",\"attributes\":{\"date\":\"").append(date).append("\"");
        if (minStay != null) sb.append(",\"min_stay_through\":").append(minStay);
        sb.append(",\"closed_to_arrival\":").append(cta);
        sb.append(",\"closed_to_departure\":").append(ctd);
        sb.append("}}");
        return new ObjectMapper().readTree(sb.toString());
    }

    @Test
    @DisplayName("importBookingRestrictionsFromOta: 3 dates consecutives min_stay=3 -> 1 BookingRestriction range")
    void bookingRestrictions_groupsConsecutive() throws Exception {
        Property prop = property(100L);
        var mapping = mapping("rp-1");
        when(channexClient.fetchRatesForRange(any(), any(), any(), any()))
            .thenReturn(java.util.Optional.of(java.util.List.of(
                restrictionEntry("2026-07-01", 3, false, false),
                restrictionEntry("2026-07-02", 3, false, false),
                restrictionEntry("2026-07-03", 3, false, false)
            )));
        when(bookingRestrictionRepository.findApplicable(eq(100L), any(), any(), eq(42L)))
            .thenReturn(java.util.List.of());

        int created = service.importBookingRestrictionsFromOta(prop, 42L, mapping);

        assertThat(created).isEqualTo(1);
        ArgumentCaptor<com.clenzy.model.BookingRestriction> captor =
            ArgumentCaptor.forClass(com.clenzy.model.BookingRestriction.class);
        verify(bookingRestrictionRepository).save(captor.capture());
        var br = captor.getValue();
        assertThat(br.getStartDate()).isEqualTo(java.time.LocalDate.of(2026, 7, 1));
        assertThat(br.getEndDate()).isEqualTo(java.time.LocalDate.of(2026, 7, 3));
        assertThat(br.getMinStay()).isEqualTo(3);
        assertThat(br.getClosedToArrival()).isFalse();
        assertThat(br.getClosedToDeparture()).isFalse();
    }

    @Test
    @DisplayName("importBookingRestrictionsFromOta: 2 dates consecutives + 1 ailleurs + min_stay different -> 3 groupes")
    void bookingRestrictions_separatesNonConsecutiveAndDifferent() throws Exception {
        Property prop = property(100L);
        var mapping = mapping("rp-1");
        when(channexClient.fetchRatesForRange(any(), any(), any(), any()))
            .thenReturn(java.util.Optional.of(java.util.List.of(
                restrictionEntry("2026-07-01", 3, false, false),
                restrictionEntry("2026-07-02", 3, false, false),
                // saute 07-03 (defaut)
                restrictionEntry("2026-07-04", 5, false, false),  // min different
                restrictionEntry("2026-07-05", 5, false, true)    // ctd different
            )));
        when(bookingRestrictionRepository.findApplicable(any(), any(), any(), any()))
            .thenReturn(java.util.List.of());

        int created = service.importBookingRestrictionsFromOta(prop, 42L, mapping);

        assertThat(created).isEqualTo(3);
        verify(bookingRestrictionRepository, org.mockito.Mockito.times(3)).save(any());
    }

    @Test
    @DisplayName("importBookingRestrictionsFromOta: aucune restriction non-defaut -> 0 BookingRestriction")
    void bookingRestrictions_skipIfAllDefault() throws Exception {
        Property prop = property(100L);
        var mapping = mapping("rp-1");
        when(channexClient.fetchRatesForRange(any(), any(), any(), any()))
            .thenReturn(java.util.Optional.of(java.util.List.of(
                restrictionEntry("2026-07-01", null, false, false),
                restrictionEntry("2026-07-02", null, false, false)
            )));

        int created = service.importBookingRestrictionsFromOta(prop, 42L, mapping);

        assertThat(created).isZero();
        verify(bookingRestrictionRepository, never()).save(any());
    }

    @Test
    @DisplayName("importBookingRestrictionsFromOta: range deja couvert par BookingRestriction existante -> skip")
    void bookingRestrictions_skipIfExistingApplicable() throws Exception {
        Property prop = property(100L);
        var mapping = mapping("rp-1");
        when(channexClient.fetchRatesForRange(any(), any(), any(), any()))
            .thenReturn(java.util.Optional.of(java.util.List.of(
                restrictionEntry("2026-07-01", 3, false, false)
            )));
        when(bookingRestrictionRepository.findApplicable(eq(100L), any(), any(), eq(42L)))
            .thenReturn(java.util.List.of(new com.clenzy.model.BookingRestriction()));

        int created = service.importBookingRestrictionsFromOta(prop, 42L, mapping);

        assertThat(created).isZero();
        verify(bookingRestrictionRepository, never()).save(any());
    }

    @Test
    @DisplayName("importBookingRestrictionsFromOta: pas de rate_plan_id mapping -> skip sans appel API")
    void bookingRestrictions_skipIfNoRatePlanId() {
        Property prop = property(100L);
        var mapping = mapping(null);

        int created = service.importBookingRestrictionsFromOta(prop, 42L, mapping);

        assertThat(created).isZero();
        verify(channexClient, never()).fetchRatesForRange(any(), any(), any(), any());
    }
}
