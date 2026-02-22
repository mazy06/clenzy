package com.clenzy.service;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.model.PricingConfig;
import com.clenzy.repository.PricingConfigRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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

    // ===== GET CURRENT CONFIG =====

    @Nested
    class GetCurrentConfig {

        @Test
        void whenNoConfigInDb_thenReturnsDefaults() {
            when(repository.findTopByOrderByIdDesc()).thenReturn(Optional.empty());

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
            when(repository.findTopByOrderByIdDesc()).thenReturn(Optional.of(config));

            PricingConfigDto result = service.getCurrentConfig();

            assertThat(result.getBasePriceEssentiel()).isEqualTo(60);
            assertThat(result.getBasePriceConfort()).isEqualTo(80);
        }
    }

    // ===== UPDATE CONFIG =====

    @Nested
    class UpdateConfig {

        @Test
        void whenValidDto_thenSaves() {
            when(repository.findTopByOrderByIdDesc()).thenReturn(Optional.of(new PricingConfig()));
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
            when(repository.findTopByOrderByIdDesc()).thenReturn(Optional.empty());

            double coeff = service.getSurfaceCoeff(30);

            assertThat(coeff).isEqualTo(0.85);
        }

        @Test
        void whenMediumSurface_thenReturns1_0() {
            when(repository.findTopByOrderByIdDesc()).thenReturn(Optional.empty());

            double coeff = service.getSurfaceCoeff(50);

            assertThat(coeff).isEqualTo(1.0);
        }

        @Test
        void whenLargeSurface_thenReturnsHigherCoeff() {
            when(repository.findTopByOrderByIdDesc()).thenReturn(Optional.empty());

            double coeff = service.getSurfaceCoeff(150);

            assertThat(coeff).isEqualTo(1.35);
        }
    }

    // ===== BASE PRICES =====

    @Nested
    class GetBasePrices {

        @Test
        void whenNoConfig_thenReturnsDefaults() {
            when(repository.findTopByOrderByIdDesc()).thenReturn(Optional.empty());

            Map<String, Integer> prices = service.getBasePrices();

            assertThat(prices).containsEntry("essentiel", 50);
            assertThat(prices).containsEntry("confort", 75);
            assertThat(prices).containsEntry("premium", 100);
        }
    }
}
