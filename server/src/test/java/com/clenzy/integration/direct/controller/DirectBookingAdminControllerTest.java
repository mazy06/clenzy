package com.clenzy.integration.direct.controller;

import com.clenzy.integration.direct.model.DirectBookingConfiguration;
import com.clenzy.integration.direct.model.PromoCode;
import com.clenzy.integration.direct.repository.DirectBookingConfigRepository;
import com.clenzy.integration.direct.repository.PromoCodeRepository;
import com.clenzy.integration.direct.service.DirectBookingWidgetService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DirectBookingAdminControllerTest {

    @Mock private DirectBookingConfigRepository configRepository;
    @Mock private PromoCodeRepository promoCodeRepository;
    @Mock private DirectBookingWidgetService widgetService;

    private TenantContext tenantContext;
    private DirectBookingAdminController controller;

    private static final Long ORG_ID = 5L;
    private static final Long PROPERTY_ID = 100L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        // Service admin reel sur repositories mockes (refactor T-ARCH-01)
        controller = new DirectBookingAdminController(
                new com.clenzy.integration.direct.service.DirectBookingAdminService(
                        configRepository, promoCodeRepository),
                widgetService, tenantContext);
    }

    // ===================================================================
    // getWidgetConfig
    // ===================================================================

    @Nested
    @DisplayName("getWidgetConfig")
    class GetWidgetConfig {

        @Test
        @DisplayName("returns widget service result")
        void returnsConfig() {
            Map<String, Object> cfg = Map.of("propertyId", PROPERTY_ID, "enabled", true);
            when(widgetService.getWidgetConfig(PROPERTY_ID, ORG_ID)).thenReturn(cfg);

            ResponseEntity<Map<String, Object>> response = controller.getWidgetConfig(PROPERTY_ID);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).containsEntry("enabled", true);
        }
    }

    // ===================================================================
    // updateWidgetConfig
    // ===================================================================

    @Nested
    @DisplayName("updateWidgetConfig")
    class UpdateWidgetConfig {

        @Test
        @DisplayName("creates new config when none exists")
        void noExisting_createsNew() {
            when(configRepository.findByPropertyIdAndOrganizationId(PROPERTY_ID, ORG_ID))
                .thenReturn(Optional.empty());
            when(configRepository.save(any(DirectBookingConfiguration.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            DirectBookingConfiguration update = new DirectBookingConfiguration();
            update.setEnabled(true);
            update.setWidgetThemeColor("#FF0000");
            update.setWidgetLogo("logo.png");
            update.setCustomCss(".x{}");
            update.setTermsAndConditionsUrl("https://t/");
            update.setCancellationPolicyText("p");
            update.setConfirmationEmailTemplate("tpl");
            update.setAutoConfirm(true);
            update.setRequirePayment(false);
            update.setAllowedCurrencies("EUR,USD");

            ResponseEntity<DirectBookingConfiguration> response =
                controller.updateWidgetConfig(PROPERTY_ID, update);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            DirectBookingConfiguration saved = response.getBody();
            assertThat(saved.getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(saved.getPropertyId()).isEqualTo(PROPERTY_ID);
            assertThat(saved.getWidgetThemeColor()).isEqualTo("#FF0000");
            assertThat(saved.isAutoConfirm()).isTrue();
            assertThat(saved.isRequirePayment()).isFalse();
            assertThat(saved.getAllowedCurrencies()).isEqualTo("EUR,USD");
        }

        @Test
        @DisplayName("updates existing config")
        void existing_updates() {
            DirectBookingConfiguration existing = new DirectBookingConfiguration(ORG_ID, PROPERTY_ID);
            existing.setId(42L);
            existing.setWidgetThemeColor("#000");
            when(configRepository.findByPropertyIdAndOrganizationId(PROPERTY_ID, ORG_ID))
                .thenReturn(Optional.of(existing));
            when(configRepository.save(any(DirectBookingConfiguration.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            DirectBookingConfiguration update = new DirectBookingConfiguration();
            update.setWidgetThemeColor("#FFFFFF");
            update.setEnabled(false);

            ResponseEntity<DirectBookingConfiguration> response =
                controller.updateWidgetConfig(PROPERTY_ID, update);

            assertThat(response.getBody().getId()).isEqualTo(42L);
            assertThat(response.getBody().getWidgetThemeColor()).isEqualTo("#FFFFFF");
            assertThat(response.getBody().isEnabled()).isFalse();
        }
    }

    // ===================================================================
    // listPromoCodes
    // ===================================================================

    @Nested
    @DisplayName("listPromoCodes")
    class ListPromoCodes {

        @Test
        @DisplayName("returns list from repository scoped to org")
        void returnsListScoped() {
            PromoCode p = new PromoCode(ORG_ID, "WELCOME", PromoCode.DiscountType.PERCENTAGE, BigDecimal.TEN);
            when(promoCodeRepository.findAllByOrganizationId(ORG_ID)).thenReturn(List.of(p));

            ResponseEntity<List<PromoCode>> response = controller.listPromoCodes();

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).getCode()).isEqualTo("WELCOME");
        }
    }

    // ===================================================================
    // createPromoCode
    // ===================================================================

    @Nested
    @DisplayName("createPromoCode")
    class CreatePromoCode {

        @Test
        @DisplayName("sets orgId, resets uses to 0 and saves")
        void setsOrgAndSaves() {
            when(promoCodeRepository.save(any(PromoCode.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            PromoCode input = new PromoCode();
            input.setCode("PROMO");
            input.setCurrentUses(99);  // should be reset
            input.setDiscountType(PromoCode.DiscountType.FIXED_AMOUNT);
            input.setDiscountValue(BigDecimal.valueOf(20));

            ResponseEntity<PromoCode> response = controller.createPromoCode(input);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(response.getBody().getCurrentUses()).isZero();
        }
    }

    // ===================================================================
    // updatePromoCode
    // ===================================================================

    @Nested
    @DisplayName("updatePromoCode")
    class UpdatePromoCode {

        @Test
        @DisplayName("updates existing promo code")
        void existing_updates() {
            PromoCode existing = new PromoCode(ORG_ID, "OLD", PromoCode.DiscountType.PERCENTAGE, BigDecimal.TEN);
            existing.setId(7L);
            when(promoCodeRepository.findById(7L)).thenReturn(Optional.of(existing));
            when(promoCodeRepository.save(any(PromoCode.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            PromoCode update = new PromoCode();
            update.setCode("NEW");
            update.setDiscountType(PromoCode.DiscountType.FIXED_AMOUNT);
            update.setDiscountValue(BigDecimal.valueOf(50));
            update.setMinNights(3);
            update.setMaxUses(100);
            update.setActive(false);
            update.setPropertyId(PROPERTY_ID);

            ResponseEntity<PromoCode> response = controller.updatePromoCode(7L, update);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().getCode()).isEqualTo("NEW");
            assertThat(response.getBody().getDiscountType()).isEqualTo(PromoCode.DiscountType.FIXED_AMOUNT);
            assertThat(response.getBody().getMinNights()).isEqualTo(3);
            assertThat(response.getBody().getMaxUses()).isEqualTo(100);
            assertThat(response.getBody().isActive()).isFalse();
            assertThat(response.getBody().getPropertyId()).isEqualTo(PROPERTY_ID);
        }

        @Test
        @DisplayName("throws when promo code not found")
        void notFound_throws() {
            when(promoCodeRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.updatePromoCode(99L, new PromoCode()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("introuvable");
        }

        @Test
        @DisplayName("throws when promo code belongs to another org")
        void wrongOrg_throws() {
            PromoCode owned = new PromoCode(999L, "X", PromoCode.DiscountType.PERCENTAGE, BigDecimal.TEN);
            owned.setId(7L);
            when(promoCodeRepository.findById(7L)).thenReturn(Optional.of(owned));

            assertThatThrownBy(() -> controller.updatePromoCode(7L, new PromoCode()))
                .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ===================================================================
    // deactivatePromoCode
    // ===================================================================

    @Nested
    @DisplayName("deactivatePromoCode")
    class Deactivate {

        @Test
        @DisplayName("marks code as inactive on success")
        void success_marksInactive() {
            PromoCode existing = new PromoCode(ORG_ID, "OLD", PromoCode.DiscountType.PERCENTAGE, BigDecimal.TEN);
            existing.setId(7L);
            existing.setActive(true);
            when(promoCodeRepository.findById(7L)).thenReturn(Optional.of(existing));
            when(promoCodeRepository.save(any(PromoCode.class)))
                .thenAnswer(inv -> inv.getArgument(0));

            ResponseEntity<Void> response = controller.deactivatePromoCode(7L);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
            assertThat(existing.isActive()).isFalse();
            verify(promoCodeRepository).save(existing);
        }

        @Test
        @DisplayName("throws when not found")
        void notFound_throws() {
            when(promoCodeRepository.findById(7L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.deactivatePromoCode(7L))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("throws when promo code belongs to another org")
        void wrongOrg_throws() {
            PromoCode owned = new PromoCode(999L, "X", PromoCode.DiscountType.PERCENTAGE, BigDecimal.TEN);
            owned.setId(7L);
            when(promoCodeRepository.findById(7L)).thenReturn(Optional.of(owned));

            assertThatThrownBy(() -> controller.deactivatePromoCode(7L))
                .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ===================================================================
    // getEmbedCode
    // ===================================================================

    @Nested
    @DisplayName("getEmbedCode")
    class GetEmbedCode {

        @Test
        @DisplayName("returns embed code from service")
        void returnsEmbedCode() {
            when(widgetService.getEmbedCode(PROPERTY_ID, ORG_ID)).thenReturn("<script>...</script>");

            ResponseEntity<Map<String, String>> response = controller.getEmbedCode(PROPERTY_ID);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).containsEntry("embedCode", "<script>...</script>");
        }
    }
}
