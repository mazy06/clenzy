package com.clenzy.controller;

import com.clenzy.dto.QuoteRequestDto;
import com.clenzy.repository.ReceivedFormRepository;
import com.clenzy.service.EmailService;
import com.clenzy.service.NotificationService;
import com.clenzy.service.PricingConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuoteControllerTest {

    @Mock private EmailService emailService;
    @Mock private PricingConfigService pricingConfigService;
    @Mock private ReceivedFormRepository receivedFormRepository;
    @Mock private NotificationService notificationService;
    @Mock private HttpServletRequest httpRequest;

    private QuoteController controller;

    @BeforeEach
    void setUp() {
        controller = new QuoteController(emailService, pricingConfigService, receivedFormRepository,
                new ObjectMapper(), notificationService);
        lenient().when(httpRequest.getRemoteAddr()).thenReturn("127.0.0.1");
        lenient().when(httpRequest.getHeader(anyString())).thenReturn(null);
    }

    @Nested
    @DisplayName("getPricingInfo")
    class PricingInfo {
        @Test
        void whenCalled_thenReturnsConfig() {
            var config = mock(com.clenzy.dto.PricingConfigDto.class);
            when(config.getBasePriceEssentiel()).thenReturn(30);
            when(config.getBasePriceConfort()).thenReturn(45);
            when(config.getBasePricePremium()).thenReturn(65);
            when(config.getMinPrice()).thenReturn(25);
            when(config.getPmsMonthlyPriceCents()).thenReturn(990);
            when(config.getPmsSyncPriceCents()).thenReturn(500);
            when(config.getPropertyTypeCoeffs()).thenReturn(Map.of());
            when(config.getPropertyCountCoeffs()).thenReturn(Map.of());
            when(config.getGuestCapacityCoeffs()).thenReturn(Map.of());
            when(config.getFrequencyCoeffs()).thenReturn(Map.of());
            when(config.getSurfaceTiers()).thenReturn(java.util.List.of());
            when(pricingConfigService.getCurrentConfig()).thenReturn(config);

            ResponseEntity<Map<String, Object>> response = controller.getPricingInfo();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("basePriceEssentiel", 30);
        }
    }

    @Nested
    @DisplayName("submitQuoteRequest")
    class Submit {
        @Test
        void whenValidRequest_thenReturnsOk() {
            QuoteRequestDto dto = mock(QuoteRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean Dupont");
            when(dto.getEmail()).thenReturn("jean@test.com");
            when(dto.getCity()).thenReturn("Paris");
            when(dto.getPostalCode()).thenReturn("75001");
            when(dto.getPropertyType()).thenReturn("apartment");
            when(dto.getCalendarSync()).thenReturn("manual");
            when(dto.getSurface()).thenReturn(50);
            when(dto.getGuestCapacity()).thenReturn("3-4");
            when(dto.getPropertyCount()).thenReturn("1");
            when(dto.getBookingFrequency()).thenReturn("weekly");

            // Mock pricing config
            when(pricingConfigService.getBasePrices()).thenReturn(Map.of("essentiel", 30));
            when(pricingConfigService.getPropertyTypeCoeffs()).thenReturn(Map.of("apartment", 1.0));
            when(pricingConfigService.getPropertyCountCoeffs()).thenReturn(Map.of("1", 1.0));
            when(pricingConfigService.getGuestCapacityCoeffs()).thenReturn(Map.of("3-4", 1.0));
            when(pricingConfigService.getSurfaceCoeff(50)).thenReturn(1.0);
            when(pricingConfigService.getFrequencyCoeffs()).thenReturn(Map.of("weekly", 1.0));
            when(pricingConfigService.getMinPrice()).thenReturn(25);

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenMissingName_thenBadRequest() {
            QuoteRequestDto dto = mock(QuoteRequestDto.class);
            when(dto.getFullName()).thenReturn("");

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenInvalidEmail_thenBadRequest() {
            QuoteRequestDto dto = mock(QuoteRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean");
            when(dto.getEmail()).thenReturn("invalid");

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenMissingCity_thenBadRequest() {
            QuoteRequestDto dto = mock(QuoteRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean");
            when(dto.getEmail()).thenReturn("jean@test.com");
            when(dto.getCity()).thenReturn("");

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenMissingPropertyType_thenBadRequest() {
            QuoteRequestDto dto = mock(QuoteRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean");
            when(dto.getEmail()).thenReturn("jean@test.com");
            when(dto.getCity()).thenReturn("Paris");
            when(dto.getPostalCode()).thenReturn("75001");
            when(dto.getPropertyType()).thenReturn("");

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }
}
