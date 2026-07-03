package com.clenzy.service;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.model.PricingConfig;
import com.clenzy.repository.PricingConfigRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PricingConfigServiceTest {

    @Mock private PricingConfigRepository repository;

    private TenantContext tenantContext;
    private PricingConfigService service;
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        service = new PricingConfigService(repository, new ObjectMapper(), tenantContext);
    }

    @AfterEach
    void tearDown() {
        // TenantContext est un ThreadLocal statique : nettoyage obligatoire
        tenantContext.clear();
    }

    // ===== GET CURRENT CONFIG =====

    @Nested
    class GetCurrentConfig {

        @Test
        void whenNoConfigInDb_thenReturnsDefaults() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            PricingConfigDto result = service.getCurrentConfig();

            assertThat(result.getBasePriceEssentiel()).isEqualTo(50);
            assertThat(result.getBasePriceConfort()).isEqualTo(75);
            assertThat(result.getBasePricePremium()).isEqualTo(100);
            assertThat(result.getMinPrice()).isEqualTo(50);
            assertThat(result.getPropertyTypeCoeffs()).containsKey("studio");
        }

        @Test
        void whenConfigExists_thenMapsToDto() {
            PricingConfig config = new PricingConfig();
            config.setId(1L);
            config.setBasePriceEssentiel(60);
            config.setBasePriceConfort(80);
            config.setBasePricePremium(110);
            config.setMinPrice(45);
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.of(config));

            PricingConfigDto result = service.getCurrentConfig();

            assertThat(result.getBasePriceEssentiel()).isEqualTo(60);
            assertThat(result.getBasePriceConfort()).isEqualTo(80);
        }
    }

    // ===== SUPPLEMENT IA PAR FORFAIT (campagne X5) =====

    @Nested
    class AiMonthlySurcharge {

        @Test
        void whenNoConfigInDb_thenReturnsGridDefaultsPerForfait() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            assertThat(service.getAiMonthlySurchargeCents("essentiel")).isEqualTo(900);
            assertThat(service.getAiMonthlySurchargeCents("confort")).isEqualTo(2900);
            assertThat(service.getAiMonthlySurchargeCents("premium")).isEqualTo(7900);
        }

        @Test
        void whenForfaitNullOrUnknown_thenFallsBackToEssentiel() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            assertThat(service.getAiMonthlySurchargeCents(null)).isEqualTo(900);
            assertThat(service.getAiMonthlySurchargeCents("inconnu")).isEqualTo(900);
        }

        @Test
        void whenConfigOverridesSurcharge_thenDbValueWins() {
            PricingConfig config = new PricingConfig();
            config.setAiSurchargeConfortCents(1900);
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.of(config));

            assertThat(service.getAiMonthlySurchargeCents("confort")).isEqualTo(1900);
            // Colonnes NULL → defaut grille conserve
            assertThat(service.getAiMonthlySurchargeCents("premium")).isEqualTo(7900);
        }
    }

    // ===== ORG SCOPING (Z5-BUGS-06) =====

    @Nested
    class OrgScoping {

        @Test
        void whenNoTenantResolved_thenFallsBackToLatestGlobalConfig() {
            // Arrange : contexte public (landing/devis) sans organisation
            tenantContext.clear();
            PricingConfig config = new PricingConfig();
            config.setId(7L);
            config.setBasePriceEssentiel(65);
            when(repository.findTopByOrderByIdDesc()).thenReturn(Optional.of(config));

            // Act
            PricingConfigDto result = service.getCurrentConfig();

            // Assert
            assertThat(result.getBasePriceEssentiel()).isEqualTo(65);
            verify(repository, never()).findTopByOrganizationIdOrderByIdDesc(any());
        }

        @Test
        void whenTenantResolved_thenQueriesOnlyOwnOrg() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            service.getCurrentConfig();

            verify(repository).findTopByOrganizationIdOrderByIdDesc(ORG_ID);
            verify(repository, never()).findTopByOrderByIdDesc();
        }

        @Test
        void whenUpdatingConfig_thenNeverFetchesAnotherOrgRow() {
            // Arrange : aucune config pour l'org courante — l'ancienne
            // findTopByOrderByIdDesc aurait pu ramener la ligne d'une autre org
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            when(repository.save(any(PricingConfig.class))).thenAnswer(inv -> inv.getArgument(0));

            PricingConfigDto dto = new PricingConfigDto();
            dto.setBasePriceEssentiel(55);

            // Act
            service.updateConfig(dto);

            // Assert : nouvelle ligne pour l'org courante, jamais de lookup global
            ArgumentCaptor<PricingConfig> captor = ArgumentCaptor.forClass(PricingConfig.class);
            verify(repository).save(captor.capture());
            assertThat(captor.getValue().getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(captor.getValue().getId()).isNull();
            verify(repository, never()).findTopByOrderByIdDesc();
        }

        @Test
        void whenTenantResolved_thenCacheKeyIsOrgScoped() {
            assertThat(service.currentTenantCacheKey()).isEqualTo("org:" + ORG_ID);
        }

        @Test
        void whenNoTenant_thenCacheKeyIsPlatform() {
            tenantContext.clear();
            assertThat(service.currentTenantCacheKey()).isEqualTo("platform");
        }
    }

    // ===== UPDATE CONFIG =====

    @Nested
    class UpdateConfig {

        @Test
        void whenValidDto_thenSaves() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.of(new PricingConfig()));
            when(repository.save(any(PricingConfig.class))).thenAnswer(inv -> {
                PricingConfig c = inv.getArgument(0);
                c.setId(1L);
                return c;
            });

            PricingConfigDto dto = new PricingConfigDto();
            dto.setBasePriceEssentiel(55);
            dto.setBasePriceConfort(80);
            dto.setBasePricePremium(105);
            dto.setMinPrice(40);

            PricingConfigDto result = service.updateConfig(dto);

            verify(repository).save(any(PricingConfig.class));
        }

        @Test
        void whenBasePriceNegative_thenThrows() {
            PricingConfigDto dto = new PricingConfigDto();
            dto.setBasePriceEssentiel(-1);

            assertThatThrownBy(() -> service.updateConfig(dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("basePriceEssentiel");
        }

        @Test
        void whenBasePriceTooHigh_thenThrows() {
            PricingConfigDto dto = new PricingConfigDto();
            dto.setBasePriceConfort(200_000);

            assertThatThrownBy(() -> service.updateConfig(dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("basePriceConfort");
        }

        @Test
        void whenMinPriceNegative_thenThrows() {
            PricingConfigDto dto = new PricingConfigDto();
            dto.setMinPrice(-5);

            assertThatThrownBy(() -> service.updateConfig(dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("minPrice");
        }

        @Test
        void whenCoeffOutOfBounds_thenThrows() {
            PricingConfigDto dto = new PricingConfigDto();
            dto.setPropertyTypeCoeffs(Map.of("studio", 0.001));

            assertThatThrownBy(() -> service.updateConfig(dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("propertyTypeCoeffs");
        }
    }

    // ===== SURFACE COEFF =====

    @Nested
    class GetSurfaceCoeff {

        @Test
        void whenSmallSurface_thenReturnsLowerCoeff() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            double coeff = service.getSurfaceCoeff(30);

            assertThat(coeff).isEqualTo(0.85);
        }

        @Test
        void whenMediumSurface_thenReturns1_0() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            double coeff = service.getSurfaceCoeff(50);

            assertThat(coeff).isEqualTo(1.0);
        }

        @Test
        void whenLargeSurface_thenReturnsHigherCoeff() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            double coeff = service.getSurfaceCoeff(150);

            assertThat(coeff).isEqualTo(1.35);
        }
    }

    // ===== BASE PRICES =====

    @Nested
    class GetBasePrices {

        @Test
        void whenNoConfig_thenReturnsDefaults() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            Map<String, Integer> prices = service.getBasePrices();

            assertThat(prices).containsEntry("essentiel", 50);
            assertThat(prices).containsEntry("confort", 75);
            assertThat(prices).containsEntry("premium", 100);
        }
    }

    // ============= EXTENDED =============

    @Nested
    class GetCoeffsHelpers {

        @Test
        void getPropertyTypeCoeffs_returnsDefaults_whenEmpty() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            Map<String, Double> coeffs = service.getPropertyTypeCoeffs();
            assertThat(coeffs).containsKey("studio").containsKey("villa");
        }

        @Test
        void getPropertyCountCoeffs_returnsDefaults_whenEmpty() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            assertThat(service.getPropertyCountCoeffs()).containsKey("1").containsKey("6+");
        }

        @Test
        void getGuestCapacityCoeffs_returnsDefaults_whenEmpty() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            assertThat(service.getGuestCapacityCoeffs()).containsKey("1-2").containsKey("7+");
        }

        @Test
        void getFrequencyCoeffs_returnsDefaults_whenEmpty() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            assertThat(service.getFrequencyCoeffs()).containsKey("tres-frequent");
        }

        @Test
        void getMinPrice_returnsDefault_whenEmpty() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            assertThat(service.getMinPrice()).isEqualTo(50);
        }
    }

    // ===== PMS PRICING =====

    @Nested
    class PmsPricing {

        @Test
        void getPmsMonthlyPriceCents_defaultWhenEmpty() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            assertThat(service.getPmsMonthlyPriceCents()).isEqualTo(3000);
        }

        @Test
        void getPmsSyncPriceCents_defaultWhenEmpty() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            assertThat(service.getPmsSyncPriceCents()).isEqualTo(1500);
        }

        @Test
        void getPmsPerSeatPriceCents_defaultWhenEmpty() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            assertThat(service.getPmsPerSeatPriceCents()).isEqualTo(1000);
        }

        @Test
        void getPmsFreeSeats_defaultWhenEmpty() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            assertThat(service.getPmsFreeSeats()).isEqualTo(1);
        }

        @Test
        void computeMonthlyPmsCost_zeroSeats() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            assertThat(service.computeMonthlyPmsCostCents(0)).isEqualTo(3000);
        }

        @Test
        void computeMonthlyPmsCost_oneSeatFree() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            assertThat(service.computeMonthlyPmsCostCents(1)).isEqualTo(3000);
        }

        @Test
        void computeMonthlyPmsCost_extraSeats_billed() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            // 1 free + 3 billable * 1000 = 3000 + 3000 = 6000
            assertThat(service.computeMonthlyPmsCostCents(4)).isEqualTo(6000);
        }
    }

    // ===== UPDATE — extended validation =====

    @Nested
    class UpdateValidation {

        @Test
        void whenBasePremiumTooHigh_thenThrows() {
            PricingConfigDto dto = new PricingConfigDto();
            dto.setBasePricePremium(200_000);
            assertThatThrownBy(() -> service.updateConfig(dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("basePricePremium");
        }

        @Test
        void whenMinPriceTooHigh_thenThrows() {
            PricingConfigDto dto = new PricingConfigDto();
            dto.setMinPrice(200_000);
            assertThatThrownBy(() -> service.updateConfig(dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("minPrice");
        }

        @Test
        void whenPmsMonthlyTooHigh_thenThrows() {
            PricingConfigDto dto = new PricingConfigDto();
            dto.setPmsMonthlyPriceCents(20_000_00);
            assertThatThrownBy(() -> service.updateConfig(dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("pmsMonthlyPriceCents");
        }

        @Test
        void whenPmsSyncNegative_thenThrows() {
            PricingConfigDto dto = new PricingConfigDto();
            dto.setPmsSyncPriceCents(-1);
            assertThatThrownBy(() -> service.updateConfig(dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("pmsSyncPriceCents");
        }

        @Test
        void whenPmsPerSeatTooHigh_thenThrows() {
            PricingConfigDto dto = new PricingConfigDto();
            dto.setPmsPerSeatPriceCents(20_000_00);
            assertThatThrownBy(() -> service.updateConfig(dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("pmsPerSeatPriceCents");
        }

        @Test
        void whenPmsFreeSeatsNegative_thenThrows() {
            PricingConfigDto dto = new PricingConfigDto();
            dto.setPmsFreeSeats(-1);
            assertThatThrownBy(() -> service.updateConfig(dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("pmsFreeSeats");
        }

        @Test
        void whenPropertyCountCoeffsOutOfBounds_thenThrows() {
            PricingConfigDto dto = new PricingConfigDto();
            dto.setPropertyCountCoeffs(Map.of("2", 200.0));
            assertThatThrownBy(() -> service.updateConfig(dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("propertyCountCoeffs");
        }

        @Test
        void whenGuestCapacityCoeffsOutOfBounds_thenThrows() {
            PricingConfigDto dto = new PricingConfigDto();
            dto.setGuestCapacityCoeffs(Map.of("3-4", -0.5));
            assertThatThrownBy(() -> service.updateConfig(dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("guestCapacityCoeffs");
        }

        @Test
        void whenFrequencyCoeffsNull_thenThrows() {
            PricingConfigDto dto = new PricingConfigDto();
            java.util.HashMap<String, Double> map = new java.util.HashMap<>();
            map.put("regulier", null);
            dto.setFrequencyCoeffs(map);
            assertThatThrownBy(() -> service.updateConfig(dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("frequencyCoeffs");
        }
    }

    // ===== computeDevisQuote =====

    @Nested
    class ComputeDevisQuote {

        @Test
        void whenSyncCalendar_thenRecommendsPremium() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            var quote = service.computeDevisQuote("appartement", "1", "1-2", 30,
                    java.util.List.of(), "sync", "regulier");

            assertThat(quote.forfaitId()).isEqualTo("premium");
            assertThat(quote.forfaitLabel()).isEqualTo("Premium");
        }

        @Test
        void whenManualCalendar_thenPmsUsesBaseMonthlyPrice() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            var quote = service.computeDevisQuote("appartement", "1", "1-2", 30,
                    java.util.List.of(), "manual", "regulier");

            // Pas de synchro auto -> tarif PMS de base (defaut 3000 cents = 30 EUR)
            assertThat(quote.pmsSyncIncluded()).isFalse();
            assertThat(quote.pmsMonthlyPrice()).isEqualTo(30);
            // Formule 2 (menage + PMS) = menage seul + abonnement PMS
            assertThat(quote.monthlyTotalWithPms()).isEqualTo(quote.monthlyTotalCleaningOnly() + 30);
        }

        @Test
        void whenSyncCalendar_thenPmsUsesSyncPriceAndFlagSet() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            var quote = service.computeDevisQuote("appartement", "1", "1-2", 30,
                    java.util.List.of(), "sync", "regulier");

            // Synchro auto demandee -> tarif PMS "avec synchro" (defaut 1500 cents = 15 EUR)
            assertThat(quote.pmsSyncIncluded()).isTrue();
            assertThat(quote.pmsMonthlyPrice()).isEqualTo(15);
            assertThat(quote.monthlyTotalWithPms()).isEqualTo(quote.monthlyTotalCleaningOnly() + 15);
            // Le PMS est remise en annuel (17 %), pas le menage.
            assertThat(quote.pmsAnnualWithDiscount()).isLessThan(quote.pmsAnnualWithoutDiscount());
            assertThat(quote.pmsAnnualSavings()).isEqualTo(
                    quote.pmsAnnualWithoutDiscount() - quote.pmsAnnualWithDiscount());
        }

        @Test
        void whenMultipleProperties_thenRecommendsPremium() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            var quote = service.computeDevisQuote("appartement", "6+", "1-2", 30,
                    java.util.List.of(), "manual", "regulier");

            assertThat(quote.forfaitId()).isEqualTo("premium");
        }

        @Test
        void whenManyServices_thenRecommendsPremium() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            var quote = service.computeDevisQuote("appartement", "1", "1-2", 30,
                    java.util.List.of("a", "b", "c", "d", "e"), "manual", "regulier");

            assertThat(quote.forfaitId()).isEqualTo("premium");
        }

        @Test
        void whenLargeSurfaceAndManyGuests_thenRecommendsPremium() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            var quote = service.computeDevisQuote("appartement", "1", "7+", 120,
                    java.util.List.of(), "manual", "regulier");

            assertThat(quote.forfaitId()).isEqualTo("premium");
        }

        @Test
        void whenTwoProperties_thenRecommendsConfort() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            var quote = service.computeDevisQuote("appartement", "2", "1-2", 30,
                    java.util.List.of(), "manual", "regulier");

            assertThat(quote.forfaitId()).isEqualTo("confort");
        }

        @Test
        void whenThreeServices_thenRecommendsConfort() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            var quote = service.computeDevisQuote("appartement", "1", "1-2", 30,
                    java.util.List.of("a", "b", "c"), "manual", "regulier");

            assertThat(quote.forfaitId()).isEqualTo("confort");
        }

        @Test
        void whenMediumSurface_thenConfort() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            var quote = service.computeDevisQuote("appartement", "1", "1-2", 60,
                    java.util.List.of(), "manual", "regulier");

            assertThat(quote.forfaitId()).isEqualTo("confort");
        }

        @Test
        void whenSmallSetup_thenEssentiel() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());

            var quote = service.computeDevisQuote("appartement", "1", "1-2", 30,
                    java.util.List.of(), "manual", "regulier");

            assertThat(quote.forfaitId()).isEqualTo("essentiel");
            assertThat(quote.interventionsPerMonth()).isEqualTo(3);
            assertThat(quote.annualDiscountPercent()).isEqualTo(17);
        }

        @Test
        void whenTresFrequent_then8InterventionsPerMonth() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            var quote = service.computeDevisQuote("appartement", "1", "1-2", 30,
                    java.util.List.of(), "manual", "tres-frequent");
            assertThat(quote.interventionsPerMonth()).isEqualTo(8);
        }

        @Test
        void whenFrequent_then4InterventionsPerMonth() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            var quote = service.computeDevisQuote("appartement", "1", "1-2", 30,
                    java.util.List.of(), "manual", "frequent");
            assertThat(quote.interventionsPerMonth()).isEqualTo(4);
        }

        @Test
        void whenOccasionnel_then2InterventionsPerMonth() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            var quote = service.computeDevisQuote("appartement", "1", "1-2", 30,
                    java.util.List.of(), "manual", "occasionnel");
            assertThat(quote.interventionsPerMonth()).isEqualTo(2);
        }

        @Test
        void whenRare_then1InterventionPerMonth() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            var quote = service.computeDevisQuote("appartement", "1", "1-2", 30,
                    java.util.List.of(), "manual", "rare");
            assertThat(quote.interventionsPerMonth()).isEqualTo(1);
        }

        @Test
        void whenNullFrequency_thenDefaultsTo4() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            var quote = service.computeDevisQuote("appartement", "1", "1-2", 30,
                    java.util.List.of(), "manual", null);
            assertThat(quote.interventionsPerMonth()).isEqualTo(4);
        }
    }

    // ===== Entity-to-DTO mapping with values =====

    @Nested
    class EntityMappingExtended {

        @Test
        void whenConfigHasValidJson_thenMapsAllFields() {
            PricingConfig config = new PricingConfig();
            config.setId(1L);
            config.setBasePriceEssentiel(60);
            config.setMinPrice(45);
            config.setPmsMonthlyPriceCents(5000);
            config.setAutomationBasicSurcharge(10);
            config.setAutomationFullSurcharge(20);
            config.setPropertyTypeCoeffs("{\"villa\":1.5}");
            config.setSurfaceTiers("[{\"maxSurface\":50,\"coeff\":0.9,\"label\":\"<50m2\"}]");
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.of(config));

            PricingConfigDto result = service.getCurrentConfig();

            assertThat(result.getAutomationBasicSurcharge()).isEqualTo(10);
            assertThat(result.getAutomationFullSurcharge()).isEqualTo(20);
            assertThat(result.getPropertyTypeCoeffs()).containsEntry("villa", 1.5);
            assertThat(result.getSurfaceTiers()).hasSize(1);
        }

        @Test
        void whenInvalidJson_thenFallbackToDefaults() {
            PricingConfig config = new PricingConfig();
            config.setPropertyTypeCoeffs("not-json");
            config.setSurfaceTiers("invalid");
            config.setForfaitConfigs("{bad}");
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.of(config));

            PricingConfigDto result = service.getCurrentConfig();

            // Defaults applied
            assertThat(result.getPropertyTypeCoeffs()).containsKey("studio");
            assertThat(result.getForfaitConfigs()).isEmpty();
        }
    }

    // ===== Surface coeff edge cases =====

    @Nested
    class SurfaceCoeffEdgeCases {

        @Test
        void whenVeryLargeSurface_thenReturnsLastTier() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            double coeff = service.getSurfaceCoeff(200);
            assertThat(coeff).isEqualTo(1.35); // tier with null maxSurface
        }

        @Test
        void whenEdgeSurface40_thenReturns1_0() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            // 40 is NOT < 40, so falls to next tier (60 → 1.0)
            double coeff = service.getSurfaceCoeff(40);
            assertThat(coeff).isEqualTo(1.0);
        }
    }

    @Nested
    class UpdateFullFields {
        @Test
        void whenAllFieldsProvided_thenAllAppliedToEntity() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.of(new PricingConfig()));
            when(repository.save(any(PricingConfig.class))).thenAnswer(inv -> {
                PricingConfig c = inv.getArgument(0);
                c.setId(1L);
                return c;
            });

            PricingConfigDto dto = new PricingConfigDto();
            dto.setBasePriceEssentiel(55);
            dto.setBasePriceConfort(80);
            dto.setBasePricePremium(105);
            dto.setMinPrice(40);
            dto.setPmsMonthlyPriceCents(3500);
            dto.setPmsSyncPriceCents(2000);
            dto.setPmsPerSeatPriceCents(1500);
            dto.setPmsFreeSeats(2);
            dto.setAutomationBasicSurcharge(10);
            dto.setAutomationFullSurcharge(25);
            dto.setPropertyTypeCoeffs(Map.of("studio", 1.0));
            dto.setPropertyCountCoeffs(Map.of("1", 1.0));
            dto.setGuestCapacityCoeffs(Map.of("1-2", 0.95));
            dto.setFrequencyCoeffs(Map.of("regulier", 0.92));
            dto.setSurfaceTiers(java.util.List.of(new PricingConfigDto.SurfaceTier(50, 0.9, "<50")));
            dto.setForfaitConfigs(new java.util.ArrayList<>());
            dto.setTravauxConfig(new java.util.ArrayList<>());
            dto.setExterieurConfig(new java.util.ArrayList<>());
            dto.setBlanchisserieConfig(new java.util.ArrayList<>());
            dto.setCommissionConfigs(new java.util.ArrayList<>());
            dto.setAvailablePrestations(new java.util.ArrayList<>());
            dto.setAvailableSurcharges(new java.util.ArrayList<>());

            service.updateConfig(dto);
            verify(repository).save(any(PricingConfig.class));
        }
    }

    @Nested
    class ComputeInterventionPrice {
        @Test
        void whenLargePremium_thenReturnsRoundedToFive() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            var quote = service.computeDevisQuote("villa", "1", "7+", 150,
                    java.util.List.of(), "sync", "tres-frequent");
            assertThat(quote.interventionPrice() % 5).isEqualTo(0);
            assertThat(quote.interventionPrice()).isGreaterThanOrEqualTo(50);
        }

        @Test
        void whenAllNonzero_thenComputedCorrectly() {
            when(repository.findTopByOrganizationIdOrderByIdDesc(ORG_ID)).thenReturn(Optional.empty());
            var quote = service.computeDevisQuote("appartement", "1", "1-2", 30,
                    java.util.List.of(), "manual", "regulier");
            assertThat(quote.monthlyTotalCleaningOnly()).isGreaterThan(0);
            assertThat(quote.monthlyTotalWithPms()).isGreaterThan(quote.monthlyTotalCleaningOnly());
            assertThat(quote.annualTotalWithPms()).isGreaterThan(0);
            assertThat(quote.annualCleaningCost()).isGreaterThan(0);
            assertThat(quote.pmsAnnualSavings()).isGreaterThan(0);
        }
    }
}
