package com.clenzy.controller;

import com.clenzy.dto.rate.*;
import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.AdvancedRateManager;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.RateDistributionService;
import com.clenzy.service.RateManagerService;
import com.clenzy.service.ReservationService;
import com.clenzy.service.YieldManagementScheduler;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires de RateManagerController.
 *
 * NOTE : depuis le refactor T-ARCH-01, le controller n'injecte plus aucun
 * repository — il delegue tout a RateManagerService. Pour preserver les
 * assertions historiques, le controller est construit sur des services REELS
 * (RateManagerService + ReservationService pour la regle d'acces propriete)
 * eux-memes poses sur les repositories mockes.
 */
@ExtendWith(MockitoExtension.class)
class RateManagerControllerTest {

    @Mock private AdvancedRateManager advancedRateManager;
    @Mock private RateDistributionService rateDistributionService;
    @Mock private YieldManagementScheduler yieldManagementScheduler;
    @Mock private PriceEngine priceEngine;
    @Mock private ChannelRateModifierRepository channelRateModifierRepository;
    @Mock private LengthOfStayDiscountRepository lengthOfStayDiscountRepository;
    @Mock private OccupancyPricingRepository occupancyPricingRepository;
    @Mock private YieldRuleRepository yieldRuleRepository;
    @Mock private RateAuditLogRepository rateAuditLogRepository;
    @Mock private RateOverrideRepository rateOverrideRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private TenantContext tenantContext;

    private RateManagerController controller;
    private Jwt jwt;

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 100L;
    private static final String KEYCLOAK_ID = "kc-user-1";

    @BeforeEach
    void setUp() {
        controller = buildController(yieldManagementScheduler);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", KEYCLOAK_ID)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    /**
     * Controller construit sur des services reels poses sur les mocks
     * (seuls reservationRepository/userRepository/tenantContext/propertyRepository
     * sont touches par validatePropertyAccess — le reste de ReservationService
     * est inutilise ici).
     */
    private RateManagerController buildController(YieldManagementScheduler scheduler) {
        ReservationService reservationService = new ReservationService(
                null, userRepository, tenantContext, null, null, null, null, null,
                null, null, null, null, null, null, propertyRepository, null, null);
        RateManagerService rateManagerService = new RateManagerService(
                advancedRateManager, rateDistributionService, scheduler, priceEngine,
                channelRateModifierRepository, lengthOfStayDiscountRepository,
                occupancyPricingRepository, yieldRuleRepository, rateAuditLogRepository,
                rateOverrideRepository, propertyRepository, reservationService, tenantContext,
                new com.clenzy.service.access.OrganizationAccessGuard(tenantContext));
        return new RateManagerController(rateManagerService);
    }

    private Property buildProperty(Long id, Long orgId) {
        Property p = new Property();
        p.setId(id);
        p.setOrganizationId(orgId);
        return p;
    }

    private Property buildPropertyWithOwner(Long id, Long orgId, User owner) {
        Property p = buildProperty(id, orgId);
        p.setOwner(owner);
        return p;
    }

    private User buildUser(Long id, UserRole role) {
        User u = new User();
        u.setId(id);
        u.setKeycloakId(KEYCLOAK_ID);
        u.setRole(role);
        u.setOrganizationId(ORG_ID);
        return u;
    }

    /**
     * Stub la sequence requise pour passer validatePropertyAccess en SUPER_ADMIN.
     */
    private void setupSuperAdminAccess(Long propertyId, Long orgId) {
        Property property = buildProperty(propertyId, orgId);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(orgId);
        when(tenantContext.isSuperAdmin()).thenReturn(true);
    }

    private void setupOwnerAccess(Long propertyId, Long orgId, Long userId) {
        User user = buildUser(userId, UserRole.HOST);
        Property property = buildPropertyWithOwner(propertyId, orgId, user);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(orgId);
        when(tenantContext.isSuperAdmin()).thenReturn(false);
        when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(user));
    }

    // ===== Calendar =====

    @Nested
    @DisplayName("getRateCalendar")
    class GetRateCalendar {
        @Test
        void whenAuthorized_thenReturnsCalendar() {
            setupSuperAdminAccess(PROPERTY_ID, ORG_ID);
            LocalDate from = LocalDate.of(2026, 5, 1);
            LocalDate to = LocalDate.of(2026, 5, 7);

            RateCalendarDto dto = new RateCalendarDto(
                    PROPERTY_ID, from, BigDecimal.valueOf(100),
                    Map.of(), null, null, null, null);
            when(advancedRateManager.getRateCalendar(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(List.of(dto));

            ResponseEntity<List<RateCalendarDto>> response = controller.getRateCalendar(
                    PROPERTY_ID, from, to, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        void whenPropertyDifferentOrg_thenThrowsAccessDenied() {
            Property property = buildProperty(PROPERTY_ID, 999L);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);

            assertThatThrownBy(() -> controller.getRateCalendar(
                    PROPERTY_ID, LocalDate.now(), LocalDate.now().plusDays(7), jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        void whenPropertyNotFound_thenThrowsNotFound() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.getRateCalendar(
                    PROPERTY_ID, LocalDate.now(), LocalDate.now().plusDays(7), jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("getChannelRates")
    class GetChannelRates {
        @Test
        void whenAuthorized_thenReturnsChannelPrices() {
            setupSuperAdminAccess(PROPERTY_ID, ORG_ID);
            LocalDate from = LocalDate.of(2026, 5, 1);
            LocalDate to = LocalDate.of(2026, 5, 3);

            Map<LocalDate, BigDecimal> prices = new LinkedHashMap<>();
            prices.put(from, BigDecimal.valueOf(110));
            when(advancedRateManager.resolveChannelPriceRange(
                    PROPERTY_ID, from, to, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(prices);

            ResponseEntity<Map<LocalDate, BigDecimal>> response = controller.getChannelRates(
                    PROPERTY_ID, ChannelName.AIRBNB, from, to, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    // ===== Distribute =====

    @Nested
    @DisplayName("distributeRates")
    class DistributeRates {
        @Test
        void whenAuthorized_thenReturnsResult() {
            setupSuperAdminAccess(PROPERTY_ID, ORG_ID);
            LocalDate from = LocalDate.now();
            LocalDate to = from.plusDays(7);

            Map<ChannelName, SyncResult> results = Map.of(
                    ChannelName.AIRBNB, SyncResult.success(7, 100L)
            );
            when(rateDistributionService.distributeRates(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(results);

            ResponseEntity<RateDistributionResultDto> response = controller.distributeRates(
                    PROPERTY_ID, from, to, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().propertyId()).isEqualTo(PROPERTY_ID);
            assertThat(response.getBody().channelResults()).containsKey(ChannelName.AIRBNB);
        }
    }

    @Nested
    @DisplayName("distributeBulk")
    class DistributeBulk {
        @Test
        void whenInvoked_thenReturnsAccepted() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            LocalDate from = LocalDate.now();
            LocalDate to = from.plusDays(7);

            ResponseEntity<Void> response = controller.distributeBulk(from, to, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(202);
            verify(rateDistributionService).distributeRatesForAllProperties(ORG_ID, from, to);
        }
    }

    // ===== Channel Rate Modifiers =====

    @Nested
    @DisplayName("Channel modifiers CRUD")
    class ChannelModifiers {
        @Test
        void getModifiers_returnsList() {
            setupSuperAdminAccess(PROPERTY_ID, ORG_ID);

            ChannelRateModifier modifier = new ChannelRateModifier();
            modifier.setId(10L);
            modifier.setChannelName(ChannelName.BOOKING);
            modifier.setModifierType(ChannelRateModifier.ModifierType.PERCENTAGE);
            modifier.setModifierValue(BigDecimal.valueOf(10));
            modifier.setActive(true);
            modifier.setPriority(1);
            modifier.setStartDate(LocalDate.of(2026, 1, 1));
            modifier.setEndDate(LocalDate.of(2026, 12, 31));
            when(channelRateModifierRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(modifier));

            ResponseEntity<List<ChannelRateModifierDto>> response = controller.getModifiers(
                    PROPERTY_ID, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).channelName()).isEqualTo("BOOKING");
        }

        @Test
        void createModifier_validDto_savesAndReturns() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            Property property = buildProperty(PROPERTY_ID, ORG_ID);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

            ChannelRateModifierDto dto = new ChannelRateModifierDto(
                    null, PROPERTY_ID, "AIRBNB", "PERCENTAGE",
                    BigDecimal.valueOf(15), "test", true, 5,
                    "2026-01-01", "2026-12-31");

            when(channelRateModifierRepository.save(any())).thenAnswer(inv -> {
                ChannelRateModifier m = inv.getArgument(0);
                m.setId(42L);
                return m;
            });

            ResponseEntity<ChannelRateModifierDto> response = controller.createModifier(dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().id()).isEqualTo(42L);
            assertThat(response.getBody().channelName()).isEqualTo("AIRBNB");
        }

        @Test
        void createModifier_withNullPropertyId_doesNotValidateAccess() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);

            ChannelRateModifierDto dto = new ChannelRateModifierDto(
                    null, null, "AIRBNB", "PERCENTAGE",
                    BigDecimal.valueOf(10), null, null, null, null, null);

            when(channelRateModifierRepository.save(any())).thenAnswer(inv -> {
                ChannelRateModifier m = inv.getArgument(0);
                m.setId(1L);
                return m;
            });

            ResponseEntity<ChannelRateModifierDto> response = controller.createModifier(dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(propertyRepository, never()).findById(any());
        }

        @Test
        void updateModifier_existsWithProperty_updatesFields() {
            Property property = buildProperty(PROPERTY_ID, ORG_ID);
            ChannelRateModifier existing = new ChannelRateModifier();
            existing.setId(10L);
            existing.setProperty(property);
            existing.setChannelName(ChannelName.AIRBNB);
            existing.setModifierType(ChannelRateModifier.ModifierType.PERCENTAGE);
            existing.setModifierValue(BigDecimal.valueOf(5));

            when(channelRateModifierRepository.findById(10L)).thenReturn(Optional.of(existing));
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            when(channelRateModifierRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ChannelRateModifierDto dto = new ChannelRateModifierDto(
                    10L, null, "BOOKING", "FIXED_AMOUNT",
                    BigDecimal.valueOf(20), "updated", false, 2,
                    "2026-06-01", "2026-06-30");

            ResponseEntity<ChannelRateModifierDto> response = controller.updateModifier(10L, dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().channelName()).isEqualTo("BOOKING");
            assertThat(response.getBody().modifierValue()).isEqualByComparingTo("20");
            assertThat(response.getBody().description()).isEqualTo("updated");
        }

        @Test
        void updateModifier_notFound_throws() {
            when(channelRateModifierRepository.findById(99L)).thenReturn(Optional.empty());

            ChannelRateModifierDto dto = new ChannelRateModifierDto(
                    99L, null, null, null, null, null, null, null, null, null);

            assertThatThrownBy(() -> controller.updateModifier(99L, dto, jwt))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void deleteModifier_exists_deletes() {
            ChannelRateModifier existing = new ChannelRateModifier();
            existing.setId(10L);
            // Org alignee au tenant : OrganizationAccessGuard est fail-closed (org NULL -> refus).
            existing.setOrganizationId(ORG_ID);
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(channelRateModifierRepository.findById(10L)).thenReturn(Optional.of(existing));

            ResponseEntity<Void> response = controller.deleteModifier(10L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(channelRateModifierRepository).delete(existing);
        }

        @Test
        void deleteModifier_notFound_throws() {
            when(channelRateModifierRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.deleteModifier(99L, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    // ===== LOS Discounts =====

    @Nested
    @DisplayName("LOS Discounts CRUD")
    class LosDiscounts {
        @Test
        void getLosDiscounts_returnsList() {
            setupSuperAdminAccess(PROPERTY_ID, ORG_ID);

            LengthOfStayDiscount d = new LengthOfStayDiscount();
            d.setId(1L);
            d.setMinNights(7);
            d.setMaxNights(30);
            d.setDiscountType(LengthOfStayDiscount.DiscountType.PERCENTAGE);
            d.setDiscountValue(BigDecimal.valueOf(10));
            d.setActive(true);
            when(lengthOfStayDiscountRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(d));

            ResponseEntity<List<LengthOfStayDiscountDto>> response = controller.getLosDiscounts(
                    PROPERTY_ID, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).minNights()).isEqualTo(7);
        }

        @Test
        void createLosDiscount_returnsCreated() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            Property property = buildProperty(PROPERTY_ID, ORG_ID);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

            LengthOfStayDiscountDto dto = new LengthOfStayDiscountDto(
                    null, PROPERTY_ID, 7, 30, "PERCENTAGE",
                    BigDecimal.valueOf(15), true, "2026-01-01", "2026-12-31");

            when(lengthOfStayDiscountRepository.save(any())).thenAnswer(inv -> {
                LengthOfStayDiscount d = inv.getArgument(0);
                d.setId(50L);
                return d;
            });

            ResponseEntity<LengthOfStayDiscountDto> response = controller.createLosDiscount(dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().id()).isEqualTo(50L);
            assertThat(response.getBody().discountType()).isEqualTo("PERCENTAGE");
        }

        @Test
        void updateLosDiscount_existsWithProperty_updates() {
            Property property = buildProperty(PROPERTY_ID, ORG_ID);
            LengthOfStayDiscount existing = new LengthOfStayDiscount();
            existing.setId(50L);
            existing.setProperty(property);
            existing.setMinNights(5);
            when(lengthOfStayDiscountRepository.findById(50L)).thenReturn(Optional.of(existing));
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            when(lengthOfStayDiscountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            LengthOfStayDiscountDto dto = new LengthOfStayDiscountDto(
                    50L, null, 14, 60, "FIXED_PER_NIGHT",
                    BigDecimal.valueOf(20), false, "2026-06-01", "2026-12-31");

            ResponseEntity<LengthOfStayDiscountDto> response = controller.updateLosDiscount(50L, dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().minNights()).isEqualTo(14);
            assertThat(response.getBody().discountType()).isEqualTo("FIXED_PER_NIGHT");
        }

        @Test
        void updateLosDiscount_notFound_throws() {
            when(lengthOfStayDiscountRepository.findById(99L)).thenReturn(Optional.empty());

            LengthOfStayDiscountDto dto = new LengthOfStayDiscountDto(
                    99L, null, 7, null, null, null, null, null, null);

            assertThatThrownBy(() -> controller.updateLosDiscount(99L, dto, jwt))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void deleteLosDiscount_exists_deletes() {
            LengthOfStayDiscount existing = new LengthOfStayDiscount();
            existing.setId(50L);
            // Org alignee au tenant : OrganizationAccessGuard est fail-closed (org NULL -> refus).
            existing.setOrganizationId(ORG_ID);
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(lengthOfStayDiscountRepository.findById(50L)).thenReturn(Optional.of(existing));

            ResponseEntity<Void> response = controller.deleteLosDiscount(50L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(lengthOfStayDiscountRepository).delete(existing);
        }
    }

    // ===== Occupancy =====

    @Nested
    @DisplayName("Occupancy pricing")
    class OccupancyPricingTests {
        @Test
        void getOccupancyPricing_exists_returnsDto() {
            setupSuperAdminAccess(PROPERTY_ID, ORG_ID);

            OccupancyPricing pricing = new OccupancyPricing();
            pricing.setId(1L);
            pricing.setBaseOccupancy(2);
            pricing.setExtraGuestFee(BigDecimal.valueOf(15));
            pricing.setMaxOccupancy(6);
            pricing.setActive(true);
            when(occupancyPricingRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(pricing));

            ResponseEntity<OccupancyPricingDto> response = controller.getOccupancyPricing(
                    PROPERTY_ID, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().baseOccupancy()).isEqualTo(2);
        }

        @Test
        void getOccupancyPricing_notFound_returnsNoContent() {
            setupSuperAdminAccess(PROPERTY_ID, ORG_ID);
            when(occupancyPricingRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.empty());

            ResponseEntity<OccupancyPricingDto> response = controller.getOccupancyPricing(
                    PROPERTY_ID, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(204);
        }

        @Test
        void upsertOccupancyPricing_createsNew() {
            setupSuperAdminAccess(PROPERTY_ID, ORG_ID);
            when(occupancyPricingRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.empty());
            when(occupancyPricingRepository.save(any())).thenAnswer(inv -> {
                OccupancyPricing p = inv.getArgument(0);
                p.setId(1L);
                return p;
            });

            OccupancyPricingDto dto = new OccupancyPricingDto(
                    null, PROPERTY_ID, 2, BigDecimal.valueOf(20), 8,
                    BigDecimal.valueOf(50), true);

            ResponseEntity<OccupancyPricingDto> response = controller.upsertOccupancyPricing(
                    PROPERTY_ID, dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().baseOccupancy()).isEqualTo(2);
            assertThat(response.getBody().maxOccupancy()).isEqualTo(8);
        }

        @Test
        void upsertOccupancyPricing_updatesExisting() {
            setupSuperAdminAccess(PROPERTY_ID, ORG_ID);
            OccupancyPricing existing = new OccupancyPricing();
            existing.setId(1L);
            existing.setBaseOccupancy(1);
            when(occupancyPricingRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(existing));
            when(occupancyPricingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            OccupancyPricingDto dto = new OccupancyPricingDto(
                    1L, PROPERTY_ID, 4, BigDecimal.valueOf(25), 10,
                    BigDecimal.valueOf(30), false);

            ResponseEntity<OccupancyPricingDto> response = controller.upsertOccupancyPricing(
                    PROPERTY_ID, dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().baseOccupancy()).isEqualTo(4);
        }

        @Test
        void upsertOccupancyPricing_propertyNotFound_throws() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            Property propertyForValidation = buildProperty(PROPERTY_ID, ORG_ID);
            // Validation step succeeds, but second findById (inside upsert) fails - simulate it twice
            when(propertyRepository.findById(PROPERTY_ID))
                    .thenReturn(Optional.of(propertyForValidation))
                    .thenReturn(Optional.empty());
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            org.mockito.Mockito.lenient().when(occupancyPricingRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.empty());

            OccupancyPricingDto dto = new OccupancyPricingDto(
                    null, PROPERTY_ID, 2, BigDecimal.valueOf(15), 6,
                    null, true);

            assertThatThrownBy(() -> controller.upsertOccupancyPricing(PROPERTY_ID, dto, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    // ===== Yield Rules =====

    @Nested
    @DisplayName("Yield rules CRUD")
    class YieldRules {
        @Test
        void getYieldRules_returnsList() {
            setupSuperAdminAccess(PROPERTY_ID, ORG_ID);
            YieldRule rule = new YieldRule();
            rule.setId(1L);
            rule.setName("High season");
            rule.setRuleType(YieldRule.RuleType.OCCUPANCY_THRESHOLD);
            rule.setTriggerCondition("{\"occupancyAbove\":80}");
            rule.setAdjustmentType(YieldRule.AdjustmentType.PERCENTAGE);
            rule.setAdjustmentValue(BigDecimal.valueOf(15));
            rule.setActive(true);
            when(yieldRuleRepository.findAllByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(rule));

            ResponseEntity<List<YieldRuleDto>> response = controller.getYieldRules(PROPERTY_ID, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).name()).isEqualTo("High season");
        }

        @Test
        void createYieldRule_returnsSaved() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            Property property = buildProperty(PROPERTY_ID, ORG_ID);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

            YieldRuleDto dto = new YieldRuleDto(
                    null, PROPERTY_ID, "Test rule", "OCCUPANCY_THRESHOLD",
                    "{}", "PERCENTAGE", BigDecimal.TEN,
                    BigDecimal.valueOf(50), BigDecimal.valueOf(500),
                    true, 1);

            when(yieldRuleRepository.save(any())).thenAnswer(inv -> {
                YieldRule r = inv.getArgument(0);
                r.setId(10L);
                return r;
            });

            ResponseEntity<YieldRuleDto> response = controller.createYieldRule(dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().id()).isEqualTo(10L);
            assertThat(response.getBody().name()).isEqualTo("Test rule");
        }

        @Test
        void updateYieldRule_existsWithProperty_updates() {
            Property property = buildProperty(PROPERTY_ID, ORG_ID);
            YieldRule existing = new YieldRule();
            existing.setId(10L);
            existing.setProperty(property);
            existing.setName("Old name");
            when(yieldRuleRepository.findById(10L)).thenReturn(Optional.of(existing));
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            when(yieldRuleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            YieldRuleDto dto = new YieldRuleDto(
                    10L, null, "New name", "DAYS_BEFORE_ARRIVAL",
                    "{\"days\":7}", "FIXED_AMOUNT", BigDecimal.valueOf(20),
                    BigDecimal.valueOf(100), BigDecimal.valueOf(800),
                    false, 5);

            ResponseEntity<YieldRuleDto> response = controller.updateYieldRule(10L, dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().name()).isEqualTo("New name");
            assertThat(response.getBody().ruleType()).isEqualTo("DAYS_BEFORE_ARRIVAL");
        }

        @Test
        void updateYieldRule_notFound_throws() {
            when(yieldRuleRepository.findById(999L)).thenReturn(Optional.empty());

            YieldRuleDto dto = new YieldRuleDto(
                    999L, null, null, null, null, null, null, null, null, null, null);

            assertThatThrownBy(() -> controller.updateYieldRule(999L, dto, jwt))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void deleteYieldRule_exists_deletes() {
            YieldRule rule = new YieldRule();
            rule.setId(10L);
            // Org alignee au tenant : OrganizationAccessGuard est fail-closed (org NULL -> refus).
            rule.setOrganizationId(ORG_ID);
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(yieldRuleRepository.findById(10L)).thenReturn(Optional.of(rule));

            ResponseEntity<Void> response = controller.deleteYieldRule(10L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(yieldRuleRepository).delete(rule);
        }

        @Test
        void evaluateYieldRules_schedulerAvailable_triggers() {
            setupSuperAdminAccess(PROPERTY_ID, ORG_ID);

            ResponseEntity<Void> response = controller.evaluateYieldRules(PROPERTY_ID, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(202);
            verify(yieldManagementScheduler).evaluateForProperty(PROPERTY_ID, ORG_ID);
        }

        @Test
        void evaluateYieldRules_schedulerNull_returnsBadRequest() {
            setupSuperAdminAccess(PROPERTY_ID, ORG_ID);
            RateManagerController noSchedulerController = buildController(null);

            ResponseEntity<Void> response = noSchedulerController.evaluateYieldRules(PROPERTY_ID, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    // ===== Bulk Update =====

    @Nested
    @DisplayName("bulkUpdate")
    class BulkUpdate {
        @Test
        void percentageAdjustment_appliesAndSavesOverrides() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            Property property = buildProperty(PROPERTY_ID, ORG_ID);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

            LocalDate from = LocalDate.of(2026, 5, 1);
            LocalDate to = LocalDate.of(2026, 5, 3);
            when(priceEngine.resolvePrice(eq(PROPERTY_ID), any(LocalDate.class), eq(ORG_ID)))
                    .thenReturn(BigDecimal.valueOf(100));

            BulkRateUpdateRequest request = new BulkRateUpdateRequest(
                    List.of(PROPERTY_ID), from, to,
                    "PERCENTAGE", BigDecimal.valueOf(10));

            ResponseEntity<Void> response = controller.bulkUpdate(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(202);

            ArgumentCaptor<RateOverride> captor = ArgumentCaptor.forClass(RateOverride.class);
            verify(rateOverrideRepository, times(3)).save(captor.capture());
            // +10% on 100 = 110
            assertThat(captor.getValue().getNightlyPrice()).isEqualByComparingTo("110");
            verify(rateAuditLogRepository, times(3)).save(any(RateAuditLog.class));
        }

        @Test
        void fixedAdjustment_addsValueToCurrentPrice() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            Property property = buildProperty(PROPERTY_ID, ORG_ID);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

            LocalDate day = LocalDate.of(2026, 5, 1);
            when(priceEngine.resolvePrice(eq(PROPERTY_ID), eq(day), eq(ORG_ID)))
                    .thenReturn(BigDecimal.valueOf(100));

            BulkRateUpdateRequest request = new BulkRateUpdateRequest(
                    List.of(PROPERTY_ID), day, day,
                    "FIXED", BigDecimal.valueOf(25));

            controller.bulkUpdate(request, jwt);

            ArgumentCaptor<RateOverride> captor = ArgumentCaptor.forClass(RateOverride.class);
            verify(rateOverrideRepository).save(captor.capture());
            assertThat(captor.getValue().getNightlyPrice()).isEqualByComparingTo("125");
        }

        @Test
        void unknownAdjustmentType_keepsCurrentPrice() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            Property property = buildProperty(PROPERTY_ID, ORG_ID);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

            LocalDate day = LocalDate.of(2026, 5, 1);
            when(priceEngine.resolvePrice(eq(PROPERTY_ID), eq(day), eq(ORG_ID)))
                    .thenReturn(BigDecimal.valueOf(100));

            BulkRateUpdateRequest request = new BulkRateUpdateRequest(
                    List.of(PROPERTY_ID), day, day,
                    "WEIRD_TYPE", BigDecimal.valueOf(50));

            controller.bulkUpdate(request, jwt);

            ArgumentCaptor<RateOverride> captor = ArgumentCaptor.forClass(RateOverride.class);
            verify(rateOverrideRepository).save(captor.capture());
            assertThat(captor.getValue().getNightlyPrice()).isEqualByComparingTo("100");
        }

        @Test
        void nullCurrentPrice_skipsDate() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            Property property = buildProperty(PROPERTY_ID, ORG_ID);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

            LocalDate day = LocalDate.of(2026, 5, 1);
            when(priceEngine.resolvePrice(eq(PROPERTY_ID), eq(day), eq(ORG_ID)))
                    .thenReturn(null);

            BulkRateUpdateRequest request = new BulkRateUpdateRequest(
                    List.of(PROPERTY_ID), day, day,
                    "PERCENTAGE", BigDecimal.TEN);

            controller.bulkUpdate(request, jwt);

            verify(rateOverrideRepository, never()).save(any());
            verify(rateAuditLogRepository, never()).save(any());
        }

        @Test
        void percentageNegativeAdjustment_doesNotGoBelowZero() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            Property property = buildProperty(PROPERTY_ID, ORG_ID);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

            LocalDate day = LocalDate.of(2026, 5, 1);
            when(priceEngine.resolvePrice(eq(PROPERTY_ID), eq(day), eq(ORG_ID)))
                    .thenReturn(BigDecimal.valueOf(100));

            BulkRateUpdateRequest request = new BulkRateUpdateRequest(
                    List.of(PROPERTY_ID), day, day,
                    "PERCENTAGE", BigDecimal.valueOf(-200));

            controller.bulkUpdate(request, jwt);

            ArgumentCaptor<RateOverride> captor = ArgumentCaptor.forClass(RateOverride.class);
            verify(rateOverrideRepository).save(captor.capture());
            assertThat(captor.getValue().getNightlyPrice()).isEqualByComparingTo("0");
        }
    }

    // ===== Audit Log =====

    @Nested
    @DisplayName("getAuditLog")
    class GetAuditLog {
        @Test
        void returnsHistory() {
            setupSuperAdminAccess(PROPERTY_ID, ORG_ID);
            LocalDate from = LocalDate.of(2026, 1, 1);
            LocalDate to = LocalDate.of(2026, 12, 31);

            RateAuditLog log = new RateAuditLog(
                    ORG_ID, PROPERTY_ID, from,
                    BigDecimal.valueOf(100), BigDecimal.valueOf(120),
                    "MANUAL", KEYCLOAK_ID, null);
            when(rateAuditLogRepository.findByPropertyIdAndDateRange(
                    PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(List.of(log));

            ResponseEntity<List<RateAuditLogDto>> response = controller.getAuditLog(
                    PROPERTY_ID, from, to, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    // ===== Ownership validation =====

    @Nested
    @DisplayName("validatePropertyAccess")
    class ValidatePropertyAccess {

        @Test
        void platformStaff_isAllowed() {
            User staff = buildUser(1L, UserRole.SUPER_MANAGER);
            Property property = buildPropertyWithOwner(PROPERTY_ID, ORG_ID, staff);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(staff));
            when(channelRateModifierRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of());

            ResponseEntity<List<ChannelRateModifierDto>> response = controller.getModifiers(PROPERTY_ID, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void owner_isAllowed() {
            setupOwnerAccess(PROPERTY_ID, ORG_ID, 5L);
            when(channelRateModifierRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of());

            ResponseEntity<List<ChannelRateModifierDto>> response = controller.getModifiers(PROPERTY_ID, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void nonOwnerNonStaff_isDenied() {
            User otherUser = buildUser(2L, UserRole.HOST);
            User owner = buildUser(99L, UserRole.HOST);
            owner.setId(99L);
            Property property = buildPropertyWithOwner(PROPERTY_ID, ORG_ID, owner);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(otherUser));

            assertThatThrownBy(() -> controller.getModifiers(PROPERTY_ID, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        void userNotFound_isDenied() {
            Property property = buildProperty(PROPERTY_ID, ORG_ID);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.getModifiers(PROPERTY_ID, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }
}
