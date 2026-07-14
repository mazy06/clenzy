package com.clenzy.controller;

import com.clenzy.dto.QuoteRequestDto;
import com.clenzy.dto.QuoteResponseDto;
import com.clenzy.service.DocumentGeneratorService;
import com.clenzy.service.EmailService;
import com.clenzy.dto.WaitlistSignupDto;
import com.clenzy.service.NotificationService;
import com.clenzy.service.PlatformSettingsService;
import com.clenzy.service.PricingConfigService;
import com.clenzy.service.ReceivedFormService;
import com.clenzy.service.WaitlistService;
import com.clenzy.service.pricing.CleaningPricingEngine;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningInputs;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningQuote;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuoteControllerTest {

    @Mock private EmailService emailService;
    @Mock private PricingConfigService pricingConfigService;
    @Mock private ReceivedFormService receivedFormService;
    @Mock private NotificationService notificationService;
    @Mock private DocumentGeneratorService documentGeneratorService;
    @Mock private PlatformSettingsService platformSettingsService;
    @Mock private WaitlistService waitlistService;
    @Mock private CleaningPricingEngine cleaningPricingEngine;
    @Mock private HttpServletRequest httpRequest;

    private QuoteController controller;

    @BeforeEach
    void setUp() {
        controller = new QuoteController(emailService, pricingConfigService, receivedFormService,
                notificationService, documentGeneratorService, platformSettingsService,
                waitlistService, cleaningPricingEngine);
        // Par défaut, emails prospect activés (comportement nominal pré-toggle).
        lenient().when(platformSettingsService.isSendProspectDevisEmails()).thenReturn(true);
        lenient().when(httpRequest.getRemoteAddr()).thenReturn("127.0.0.1");
        lenient().when(httpRequest.getHeader(anyString())).thenReturn(null);
    }

    /** DTO prospect valide de référence (essentiel : 50 m², 3-4 voyageurs, 1 logement). */
    private QuoteRequestDto validDto() {
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
        return dto;
    }

    /**
     * Stubs de pricing post-moteur (P3, PLAN-MOTEUR-MENAGE.md) : le cœur du prix
     * vient de CleaningPricingEngine (ici quote de 85 € conseillé), la sur-couche
     * commerciale (countCoeff × freqCoeff, plancher, arrondi 5) reste sur
     * PricingConfigService.
     */
    private void stubPricing() {
        // lenient : certains tests surchargent ces stubs (coeffs, plancher, échec DB).
        lenient().when(cleaningPricingEngine.quote(any(CleaningInputs.class), eq(CleaningPricingEngine.STANDARD_CLEANING)))
                .thenReturn(new CleaningQuote(120,
                        BigDecimal.valueOf(85), BigDecimal.valueOf(70), BigDecimal.valueOf(100)));
        lenient().when(pricingConfigService.getPropertyCountCoeffs()).thenReturn(Map.of());
        lenient().when(pricingConfigService.getFrequencyCoeffs()).thenReturn(Map.of());
        lenient().when(pricingConfigService.getMinPrice()).thenReturn(25);
        lenient().when(receivedFormService.recordQuoteForm(any(QuoteRequestDto.class), anyString())).thenReturn(42L);
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
            stubPricing();
            QuoteRequestDto dto = validDto();

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenProspectEmailsDisabled_thenNoProspectEmail_butInfoNotified() {
            // Toggle plateforme OFF : aucun email/PDF envoyé au prospect, mais info@ notifié.
            when(platformSettingsService.isSendProspectDevisEmails()).thenReturn(false);
            stubPricing();
            QuoteRequestDto dto = validDto();

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            // Pas de génération/envoi de devis au prospect...
            verifyNoInteractions(documentGeneratorService);
            // ...mais info@clenzy.fr est notifié via le fallback interne.
            verify(emailService).sendQuoteRequestNotification(eq(dto), anyString(), anyInt(), isNull());
        }

        @Test
        void whenAddDevisLeadsToWaitlistEnabled_thenLeadAddedToWaitlist() {
            when(platformSettingsService.isAddDevisLeadsToWaitlist()).thenReturn(true);
            stubPricing();
            QuoteRequestDto dto = validDto();

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            // Le lead devis est versé dans la waitlist (email repris, source "devis").
            verify(waitlistService).register(
                    argThat((WaitlistSignupDto w) -> "jean@test.com".equals(w.email()) && "devis".equals(w.source())),
                    anyString());
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
        void whenRepositorySaveFails_thenInternalServerError() {
            stubPricing();
            QuoteRequestDto dto = validDto();
            when(receivedFormService.recordQuoteForm(any(QuoteRequestDto.class), anyString()))
                .thenThrow(new RuntimeException("DB unavailable"));

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        void whenEmailFails_thenStillOk() {
            stubPricing();
            QuoteRequestDto dto = validDto();
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
        void whenXForwardedFor_thenUsesFirstIp() {
            stubPricing();
            QuoteRequestDto dto = validDto();
            when(httpRequest.getHeader("X-Forwarded-For")).thenReturn("10.0.0.1, 192.168.1.1");

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenXRealIpHeader_thenUsesIt() {
            stubPricing();
            QuoteRequestDto dto = validDto();
            when(httpRequest.getHeader("X-Forwarded-For")).thenReturn(null);
            when(httpRequest.getHeader("X-Real-IP")).thenReturn("5.5.5.5");

            ResponseEntity<?> response = controller.submitQuoteRequest(dto, httpRequest);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenRateLimitExceeded_thenTooManyRequests() {
            stubPricing();
            QuoteRequestDto dto = validDto();

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
    @DisplayName("computePrice — moteur ménage + sur-couche commerciale (P3)")
    class PriceComputation {

        private QuoteResponseDto bodyOf(ResponseEntity<?> r) {
            return (QuoteResponseDto) r.getBody();
        }

        @Test
        void whenEssentiel_thenEnginePriceTimesPackageFactorRoundedTo5() {
            stubPricing();
            QuoteRequestDto dto = validDto(); // essentiel par défaut

            ResponseEntity<?> r = controller.submitQuoteRequest(dto, httpRequest);

            // Moteur 85 € × facteur essentiel 0.9 = 76,5 → arrondi 5 → 75 €.
            // (Ancienne formule : base essentiel × coeffs ≈ 30-50 €.)
            assertThat(bodyOf(r).getRecommendedPackage()).isEqualTo("essentiel");
            assertThat(bodyOf(r).getRecommendedRate()).isEqualTo(75);
        }

        @Test
        void whenPremium_thenPackageFactorIncreasesRate() {
            stubPricing();
            QuoteRequestDto dto = validDto();
            when(dto.getCalendarSync()).thenReturn("sync"); // → premium

            ResponseEntity<?> r = controller.submitQuoteRequest(dto, httpRequest);

            // Moteur 85 € × facteur premium 1.15 = 97,75 → arrondi 5 → 100 €.
            assertThat(bodyOf(r).getRecommendedPackage()).isEqualTo("premium");
            assertThat(bodyOf(r).getRecommendedRate()).isEqualTo(100);
        }

        @Test
        void whenCommercialCoeffsConfigured_thenAppliedOnEnginePrice() {
            stubPricing();
            when(pricingConfigService.getPropertyCountCoeffs()).thenReturn(Map.of("2", 0.95));
            when(pricingConfigService.getFrequencyCoeffs()).thenReturn(Map.of("weekly", 0.9));
            QuoteRequestDto dto = validDto();
            when(dto.getPropertyCount()).thenReturn("2"); // → confort (facteur 1.0)

            ResponseEntity<?> r = controller.submitQuoteRequest(dto, httpRequest);

            // 85 × 1.0 (confort) × 0.95 × 0.9 = 72,675 → arrondi 5 → 75 €.
            assertThat(bodyOf(r).getRecommendedPackage()).isEqualTo("confort");
            assertThat(bodyOf(r).getRecommendedRate()).isEqualTo(75);
        }

        @Test
        void whenEngineBelowFloor_thenLandingMinPriceApplies() {
            when(cleaningPricingEngine.quote(any(CleaningInputs.class), eq(CleaningPricingEngine.STANDARD_CLEANING)))
                    .thenReturn(new CleaningQuote(45,
                            BigDecimal.valueOf(30), BigDecimal.valueOf(30), BigDecimal.valueOf(35)));
            when(pricingConfigService.getPropertyCountCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getFrequencyCoeffs()).thenReturn(Map.of());
            when(pricingConfigService.getMinPrice()).thenReturn(50);
            when(receivedFormService.recordQuoteForm(any(QuoteRequestDto.class), anyString())).thenReturn(42L);
            QuoteRequestDto dto = validDto();

            ResponseEntity<?> r = controller.submitQuoteRequest(dto, httpRequest);

            // 30 × 0.9 = 27 → plancher landing 50 €.
            assertThat(bodyOf(r).getRecommendedRate()).isEqualTo(50);
        }

        @Test
        void whenGuestCapacityRange_thenEngineInputsApproximatedFromForm() {
            stubPricing();
            QuoteRequestDto dto = validDto();
            when(dto.getGuestCapacity()).thenReturn("7+");
            when(dto.getSurface()).thenReturn(120); // → premium (120 m² & 7+)

            controller.submitQuoteRequest(dto, httpRequest);

            // "7+" → 8 voyageurs, chambres = max(1, 8/2) = 4, SDB = 1, 1 niveau.
            ArgumentCaptor<CleaningInputs> captor = ArgumentCaptor.forClass(CleaningInputs.class);
            verify(cleaningPricingEngine).quote(captor.capture(), eq(CleaningPricingEngine.STANDARD_CLEANING));
            CleaningInputs inputs = captor.getValue();
            assertThat(inputs.maxGuests()).isEqualTo(8);
            assertThat(inputs.bedrooms()).isEqualTo(4);
            assertThat(inputs.bathrooms()).isEqualTo(1);
            assertThat(inputs.squareMeters()).isEqualTo(120);
            assertThat(inputs.floors()).isEqualTo(1);
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

        private String pkgOf(ResponseEntity<?> r) {
            return ((QuoteResponseDto) r.getBody()).getRecommendedPackage();
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
