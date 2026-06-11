package com.clenzy.service;

import com.clenzy.dto.rate.ChannelRateModifierDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelRateModifier;
import com.clenzy.model.LengthOfStayDiscount;
import com.clenzy.model.Property;
import com.clenzy.model.YieldRule;
import com.clenzy.repository.ChannelRateModifierRepository;
import com.clenzy.repository.LengthOfStayDiscountRepository;
import com.clenzy.repository.OccupancyPricingRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateAuditLogRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.YieldRuleRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests du controle d'ownership ajoute par le refactor T-ARCH-01 de
 * RateManagerController : les regles tarifaires chargees par findById
 * (qui contourne le filtre Hibernate) sont validees contre l'organisation
 * du requester — y compris les regles org-wide SANS propriete porteuse,
 * qui n'avaient AUCUNE validation auparavant (faille IDOR cross-org).
 *
 * Le reste du comportement (CRUD, bulk, calendrier) est couvert par
 * RateManagerControllerTest, construit sur ce service reel.
 */
@ExtendWith(MockitoExtension.class)
class RateManagerServiceTest {

    @Mock private AdvancedRateManager advancedRateManager;
    @Mock private RateDistributionService rateDistributionService;
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

    private RateManagerService service;

    private static final Long ORG_ID = 1L;
    private static final Long OTHER_ORG_ID = 999L;
    private static final String KEYCLOAK_ID = "kc-user-1";

    @BeforeEach
    void setUp() {
        ReservationService reservationService = new ReservationService(
                null, userRepository, tenantContext, null, null, null, null, null,
                null, null, null, null, null, null, propertyRepository, null, null);
        service = new RateManagerService(
                advancedRateManager, rateDistributionService, null, priceEngine,
                channelRateModifierRepository, lengthOfStayDiscountRepository,
                occupancyPricingRepository, yieldRuleRepository, rateAuditLogRepository,
                rateOverrideRepository, propertyRepository, reservationService, tenantContext);
    }

    private void setupRegularUserInOrg(Long orgId) {
        when(tenantContext.isSuperAdmin()).thenReturn(false);
        when(tenantContext.isSystemOrg()).thenReturn(false);
        when(tenantContext.getOrganizationId()).thenReturn(orgId);
    }

    @Nested
    @DisplayName("Regles org-wide (sans propriete) — controle d'org ajoute")
    class OrgWideRules {

        @Test
        void whenUpdatingModifierOfOtherOrg_thenAccessDenied() {
            ChannelRateModifier modifier = new ChannelRateModifier();
            modifier.setId(10L);
            modifier.setOrganizationId(OTHER_ORG_ID);
            when(channelRateModifierRepository.findById(10L)).thenReturn(Optional.of(modifier));
            setupRegularUserInOrg(ORG_ID);

            ChannelRateModifierDto dto = new ChannelRateModifierDto(
                    10L, null, null, null, null, null, null, null, null, null);

            assertThatThrownBy(() -> service.updateModifier(10L, dto, KEYCLOAK_ID))
                    .isInstanceOf(AccessDeniedException.class);
            verify(channelRateModifierRepository, never()).save(any());
        }

        @Test
        void whenDeletingModifierOfOtherOrg_thenAccessDenied() {
            ChannelRateModifier modifier = new ChannelRateModifier();
            modifier.setId(10L);
            modifier.setOrganizationId(OTHER_ORG_ID);
            when(channelRateModifierRepository.findById(10L)).thenReturn(Optional.of(modifier));
            setupRegularUserInOrg(ORG_ID);

            assertThatThrownBy(() -> service.deleteModifier(10L, KEYCLOAK_ID))
                    .isInstanceOf(AccessDeniedException.class);
            verify(channelRateModifierRepository, never()).delete(any());
        }

        @Test
        void whenDeletingLosDiscountOfOtherOrg_thenAccessDenied() {
            LengthOfStayDiscount discount = new LengthOfStayDiscount();
            discount.setId(50L);
            discount.setOrganizationId(OTHER_ORG_ID);
            when(lengthOfStayDiscountRepository.findById(50L)).thenReturn(Optional.of(discount));
            setupRegularUserInOrg(ORG_ID);

            assertThatThrownBy(() -> service.deleteLosDiscount(50L, KEYCLOAK_ID))
                    .isInstanceOf(AccessDeniedException.class);
            verify(lengthOfStayDiscountRepository, never()).delete(any());
        }

        @Test
        void whenDeletingYieldRuleOfOtherOrg_thenAccessDenied() {
            YieldRule rule = new YieldRule();
            rule.setId(20L);
            rule.setOrganizationId(OTHER_ORG_ID);
            when(yieldRuleRepository.findById(20L)).thenReturn(Optional.of(rule));
            setupRegularUserInOrg(ORG_ID);

            assertThatThrownBy(() -> service.deleteYieldRule(20L, KEYCLOAK_ID))
                    .isInstanceOf(AccessDeniedException.class);
            verify(yieldRuleRepository, never()).delete(any());
        }

        @Test
        void whenSuperAdmin_thenCrossOrgModifierIsUpdatable() {
            ChannelRateModifier modifier = new ChannelRateModifier();
            modifier.setId(10L);
            modifier.setOrganizationId(OTHER_ORG_ID);
            modifier.setChannelName(ChannelName.AIRBNB);
            modifier.setModifierType(ChannelRateModifier.ModifierType.PERCENTAGE);
            modifier.setModifierValue(BigDecimal.TEN);
            when(channelRateModifierRepository.findById(10L)).thenReturn(Optional.of(modifier));
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            when(channelRateModifierRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ChannelRateModifierDto dto = new ChannelRateModifierDto(
                    10L, null, null, null, BigDecimal.valueOf(20), null, null, null, null, null);

            ChannelRateModifierDto result = service.updateModifier(10L, dto, KEYCLOAK_ID);

            assertThat(result.modifierValue()).isEqualByComparingTo("20");
        }

        @Test
        void whenSameOrg_thenModifierIsDeletable() {
            ChannelRateModifier modifier = new ChannelRateModifier();
            modifier.setId(10L);
            modifier.setOrganizationId(ORG_ID);
            when(channelRateModifierRepository.findById(10L)).thenReturn(Optional.of(modifier));
            setupRegularUserInOrg(ORG_ID);

            service.deleteModifier(10L, KEYCLOAK_ID);

            verify(channelRateModifierRepository).delete(modifier);
        }
    }

    @Nested
    @DisplayName("Regles liees a une propriete d'une autre org")
    class PropertyBackedRules {

        @Test
        void whenUpdatingModifierWhosePropertyIsInOtherOrg_thenAccessDenied() {
            Property property = new Property();
            property.setId(100L);
            property.setOrganizationId(OTHER_ORG_ID);

            ChannelRateModifier modifier = new ChannelRateModifier();
            modifier.setId(10L);
            modifier.setProperty(property);
            when(channelRateModifierRepository.findById(10L)).thenReturn(Optional.of(modifier));
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);

            ChannelRateModifierDto dto = new ChannelRateModifierDto(
                    10L, null, null, null, null, null, null, null, null, null);

            assertThatThrownBy(() -> service.updateModifier(10L, dto, KEYCLOAK_ID))
                    .isInstanceOf(AccessDeniedException.class);
            verify(channelRateModifierRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("Regle introuvable")
    class NotFound {

        @Test
        void whenModifierDoesNotExist_thenNotFound() {
            when(channelRateModifierRepository.findById(404L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deleteModifier(404L, KEYCLOAK_ID))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void whenYieldRuleDoesNotExist_thenNotFound() {
            when(yieldRuleRepository.findById(404L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deleteYieldRule(404L, KEYCLOAK_ID))
                    .isInstanceOf(NotFoundException.class);
        }
    }
}
