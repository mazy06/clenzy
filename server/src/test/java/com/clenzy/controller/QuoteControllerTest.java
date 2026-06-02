package com.clenzy.controller;

import com.clenzy.dto.QuoteRequestDto;
import com.clenzy.model.ReceivedForm;
import com.clenzy.repository.ReceivedFormRepository;
import com.clenzy.service.DocumentGeneratorService;
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
    @Mock private DocumentGeneratorService documentGeneratorService;
    @Mock private HttpServletRequest httpRequest;

    private QuoteController controller;

    @BeforeEach
    void setUp() {
        controller = new QuoteController(emailService, pricingConfigService, receivedFormRepository,
                new ObjectMapper(), notificationService, documentGeneratorService);
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

            // ReceivedForm save retourne maintenant un form persiste (le controleur
            // utilise l'id du form sauve pour les logs des etapes suivantes)
            when(receivedFormRepository.save(any(ReceivedForm.class))).thenAnswer(invocation -> {
                ReceivedForm form = invocation.getArgument(0);
                form.setId(42L);
                return form;
            });

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

        @Test
        void whenMissingPostalCode_thenBadRequest() {
            QuoteRequestDto dto = mock(QuoteRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean");
            when(dto.getEmail()).thenReturn("jean@test.com");
            when(dto.getCity()).thenReturn("Paris");
            when(dto.getPostalCode()).thenReturn("");

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenNullName_thenBadRequest() {
            QuoteRequestDto dto = mock(QuoteRequestDto.class);
            when(dto.getFullName()).thenReturn(null);

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenBlankEmail_thenBadRequest() {
            QuoteRequestDto dto = mock(QuoteRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean");
            when(dto.getEmail()).thenReturn("   ");

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenRepositorySaveFails_thenInternalServerError() throws Exception {
            QuoteRequestDto dto = mock(QuoteRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean");
            when(dto.getEmail()).thenReturn("jean@test.com");
            when(dto.getCity()).thenReturn("Paris");
            when(dto.getPostalCode()).thenReturn("75001");
            when(dto.getPropertyType()).thenReturn("apartment");
            when(dto.getCalendarSync()).thenReturn("manual");
            when(dto.getSurface()).thenReturn(40);
            when(dto.getGuestCapacity()).thenReturn("3-4");
            when(dto.getPropertyCount()).thenReturn("1");
            when(dto.getBookingFrequency()).thenReturn("weekly");

            when(pricingConfigService.getBasePrices()).thenReturn(Map.of("essentiel", 30));
            when(pricingConfigService.getPropertyTypeCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getPropertyCountCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getGuestCapacityCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getSurfaceCoeff(40)).thenReturn(1.0);
            when(pricingConfigService.getFrequencyCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getMinPrice()).thenReturn(25);
            when(receivedFormRepository.save(any(ReceivedForm.class)))
                .thenThrow(new RuntimeException("DB unavailable"));

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        void whenEmailFails_thenStillOk() {
            QuoteRequestDto dto = mock(QuoteRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean");
            when(dto.getEmail()).thenReturn("jean@test.com");
            when(dto.getCity()).thenReturn("Paris");
            when(dto.getPostalCode()).thenReturn("75001");
            when(dto.getPropertyType()).thenReturn("apartment");
            when(dto.getCalendarSync()).thenReturn("manual");
            when(dto.getSurface()).thenReturn(40);
            when(dto.getGuestCapacity()).thenReturn("3-4");
            when(dto.getPropertyCount()).thenReturn("1");
            when(dto.getBookingFrequency()).thenReturn("weekly");

            when(pricingConfigService.getBasePrices()).thenReturn(Map.of("essentiel", 30));
            when(pricingConfigService.getPropertyTypeCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getPropertyCountCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getGuestCapacityCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getSurfaceCoeff(40)).thenReturn(1.0);
            when(pricingConfigService.getFrequencyCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getMinPrice()).thenReturn(25);
            when(receivedFormRepository.save(any(ReceivedForm.class))).thenAnswer(inv -> {
                ReceivedForm f = inv.getArgument(0);
                f.setId(7L);
                return f;
            });
            // La génération/envoi du devis (avec info@ en CC) ne doit pas bloquer
            // la réponse au prospect si elle échoue.
            doThrow(new RuntimeException("PDF/email KO")).when(documentGeneratorService)
                .generateFromEvent(any(), anyLong(), any(), anyString(), any());

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);
            // Email failure does not block: 200 OK still returned.
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            // Filet : l'échec d'envoi au prospect déclenche la notification interne à info@.
            verify(emailService).sendQuoteRequestNotification(any(), anyString(), anyInt(), any());
        }

        @Test
        void whenXForwardedFor_thenUsesFirstIp() throws Exception {
            QuoteRequestDto dto = mock(QuoteRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean");
            when(dto.getEmail()).thenReturn("jean@test.com");
            when(dto.getCity()).thenReturn("Paris");
            when(dto.getPostalCode()).thenReturn("75001");
            when(dto.getPropertyType()).thenReturn("apartment");
            when(dto.getCalendarSync()).thenReturn("manual");
            when(dto.getSurface()).thenReturn(40);
            when(dto.getGuestCapacity()).thenReturn("3-4");
            when(dto.getPropertyCount()).thenReturn("1");
            when(dto.getBookingFrequency()).thenReturn("weekly");

            when(pricingConfigService.getBasePrices()).thenReturn(Map.of("essentiel", 30));
            when(pricingConfigService.getPropertyTypeCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getPropertyCountCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getGuestCapacityCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getSurfaceCoeff(40)).thenReturn(1.0);
            when(pricingConfigService.getFrequencyCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getMinPrice()).thenReturn(25);
            when(receivedFormRepository.save(any(ReceivedForm.class))).thenAnswer(inv -> {
                ReceivedForm f = inv.getArgument(0); f.setId(1L); return f;
            });
            when(httpRequest.getHeader("X-Forwarded-For")).thenReturn("10.0.0.1, 192.168.1.1");

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenXRealIpHeader_thenUsesIt() throws Exception {
            QuoteRequestDto dto = mock(QuoteRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean");
            when(dto.getEmail()).thenReturn("jean@test.com");
            when(dto.getCity()).thenReturn("Paris");
            when(dto.getPostalCode()).thenReturn("75001");
            when(dto.getPropertyType()).thenReturn("apartment");
            when(dto.getCalendarSync()).thenReturn("manual");
            when(dto.getSurface()).thenReturn(40);
            when(dto.getGuestCapacity()).thenReturn("3-4");
            when(dto.getPropertyCount()).thenReturn("1");
            when(dto.getBookingFrequency()).thenReturn("weekly");

            when(pricingConfigService.getBasePrices()).thenReturn(Map.of("essentiel", 30));
            when(pricingConfigService.getPropertyTypeCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getPropertyCountCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getGuestCapacityCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getSurfaceCoeff(40)).thenReturn(1.0);
            when(pricingConfigService.getFrequencyCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getMinPrice()).thenReturn(25);
            when(receivedFormRepository.save(any(ReceivedForm.class))).thenAnswer(inv -> {
                ReceivedForm f = inv.getArgument(0); f.setId(1L); return f;
            });
            when(httpRequest.getHeader("X-Forwarded-For")).thenReturn(null);
            when(httpRequest.getHeader("X-Real-IP")).thenReturn("5.5.5.5");

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenRateLimitExceeded_thenTooManyRequests() throws Exception {
            QuoteRequestDto dto = mock(QuoteRequestDto.class);
            when(dto.getFullName()).thenReturn("Jean");
            when(dto.getEmail()).thenReturn("jean@test.com");
            when(dto.getCity()).thenReturn("Paris");
            when(dto.getPostalCode()).thenReturn("75001");
            when(dto.getPropertyType()).thenReturn("apartment");
            when(dto.getCalendarSync()).thenReturn("manual");
            when(dto.getSurface()).thenReturn(40);
            when(dto.getGuestCapacity()).thenReturn("3-4");
            when(dto.getPropertyCount()).thenReturn("1");
            when(dto.getBookingFrequency()).thenReturn("weekly");

            when(pricingConfigService.getBasePrices()).thenReturn(Map.of("essentiel", 30));
            when(pricingConfigService.getPropertyTypeCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getPropertyCountCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getGuestCapacityCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getSurfaceCoeff(anyInt())).thenReturn(1.0);
            when(pricingConfigService.getFrequencyCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getMinPrice()).thenReturn(25);
            when(receivedFormRepository.save(any(ReceivedForm.class))).thenAnswer(inv -> {
                ReceivedForm f = inv.getArgument(0); f.setId(1L); return f;
            });

            // Fire 5 successful submissions
            for (int i = 0; i < 5; i++) {
                ResponseEntity<?> r = controller.submitQuoteRequest(dto, httpRequest);
                assertThat(r.getStatusCode().value()).isEqualTo(200);
            }
            // 6th should hit rate limit (max=5/hour)
            ResponseEntity<?> finalAttempt = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(finalAttempt.getStatusCode().value()).isEqualTo(429);
        }
    }

    @Nested
    @DisplayName("computeRecommendedPackage paths")
    class PackageComputation {

        private QuoteRequestDto baseDto() {
            QuoteRequestDto dto = mock(QuoteRequestDto.class);
            when(dto.getFullName()).thenReturn("J");
            when(dto.getEmail()).thenReturn("j@x.com");
            when(dto.getCity()).thenReturn("Paris");
            when(dto.getPostalCode()).thenReturn("75001");
            when(dto.getPropertyType()).thenReturn("apartment");
            when(dto.getCalendarSync()).thenReturn("manual");
            when(dto.getSurface()).thenReturn(40);
            when(dto.getGuestCapacity()).thenReturn("3-4");
            when(dto.getPropertyCount()).thenReturn("1");
            when(dto.getBookingFrequency()).thenReturn("weekly");
            return dto;
        }

        private void stubPricing() {
            when(pricingConfigService.getBasePrices()).thenReturn(
                Map.of("essentiel", 30, "confort", 45, "premium", 65));
            when(pricingConfigService.getPropertyTypeCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getPropertyCountCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getGuestCapacityCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getSurfaceCoeff(anyInt())).thenReturn(1.0);
            when(pricingConfigService.getFrequencyCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getMinPrice()).thenReturn(25);
            when(receivedFormRepository.save(any(ReceivedForm.class))).thenAnswer(inv -> {
                ReceivedForm f = inv.getArgument(0); f.setId(1L); return f;
            });
        }

        private String pkgOf(ResponseEntity<?> r) {
            return ((com.clenzy.dto.QuoteResponseDto) r.getBody()).getRecommendedPackage();
        }

        @Test
        void whenCalendarSyncIsSync_thenPremium() {
            stubPricing();
            QuoteRequestDto dto = baseDto();
            when(dto.getCalendarSync()).thenReturn("sync");

            ResponseEntity<?> r = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(pkgOf(r)).isEqualTo("premium");
        }

        @Test
        void whenLargeProperty_thenPremium() {
            stubPricing();
            QuoteRequestDto dto = baseDto();
            when(dto.getSurface()).thenReturn(120);
            when(dto.getGuestCapacity()).thenReturn("7+");

            ResponseEntity<?> r = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(pkgOf(r)).isEqualTo("premium");
        }

        @Test
        void whenMultipleProperties_thenPremium() {
            stubPricing();
            QuoteRequestDto dto = baseDto();
            when(dto.getPropertyCount()).thenReturn("6+");

            ResponseEntity<?> r = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(pkgOf(r)).isEqualTo("premium");
        }

        @Test
        void whenTwoProperties_thenConfort() {
            stubPricing();
            QuoteRequestDto dto = baseDto();
            when(dto.getPropertyCount()).thenReturn("2");

            ResponseEntity<?> r = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(pkgOf(r)).isEqualTo("confort");
        }

        @Test
        void whenLargeSurface_thenConfort() {
            stubPricing();
            QuoteRequestDto dto = baseDto();
            when(dto.getSurface()).thenReturn(80);

            ResponseEntity<?> r = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(pkgOf(r)).isEqualTo("confort");
        }

        @Test
        void whenMediumCapacity_thenConfort() {
            stubPricing();
            QuoteRequestDto dto = baseDto();
            when(dto.getGuestCapacity()).thenReturn("5-6");

            ResponseEntity<?> r = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(pkgOf(r)).isEqualTo("confort");
        }

        @Test
        void whenDefaultCase_thenEssentiel() {
            stubPricing();
            QuoteRequestDto dto = baseDto();

            ResponseEntity<?> r = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(pkgOf(r)).isEqualTo("essentiel");
        }

        @Test
        void whenManyServices_thenPremium() {
            stubPricing();
            QuoteRequestDto dto = baseDto();
            when(dto.getServices()).thenReturn(java.util.List.of("a","b","c","d","e"));

            ResponseEntity<?> r = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(pkgOf(r)).isEqualTo("premium");
        }

        @Test
        void whenModerateServices_thenConfort() {
            stubPricing();
            QuoteRequestDto dto = baseDto();
            when(dto.getServices()).thenReturn(java.util.List.of("a","b","c"));

            ResponseEntity<?> r = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(pkgOf(r)).isEqualTo("confort");
        }
    }
}
