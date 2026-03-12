package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiProviderException;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.config.ai.AnthropicProvider;
import com.clenzy.dto.AiIntentDetectionDto;
import com.clenzy.dto.AiSuggestedResponseDto;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.service.AiKeyResolver.KeySource;
import com.clenzy.service.AiKeyResolver.ResolvedKey;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiMessagingServiceTest {

    @Mock
    private AiProperties aiProperties;

    @Mock
    private AnthropicProvider anthropicProvider;

    @Mock
    private AiAnonymizationService anonymizationService;

    @Mock
    private AiTokenBudgetService tokenBudgetService;

    @Mock
    private AiKeyResolver aiKeyResolver;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private AiMessagingService service;

    // ─── Rule-based: detectIntent ─────────────────────────────────────

    @Nested
    class DetectIntent {

        @Test
        void checkIn() {
            assertEquals("CHECK_IN", service.detectIntent("Bonjour, a quelle heure est le check-in ?"));
        }

        @Test
        void checkOut() {
            assertEquals("CHECK_OUT", service.detectIntent("When do I need to checkout?"));
        }

        @Test
        void wifi() {
            assertEquals("WIFI", service.detectIntent("Quel est le mot de passe du wifi ?"));
        }

        @Test
        void parking() {
            assertEquals("PARKING", service.detectIntent("Ou est-ce que je peux garer ma voiture ?"));
        }

        @Test
        void problem() {
            assertEquals("PROBLEM", service.detectIntent("Il y a un probleme, le robinet est casse"));
        }

        @Test
        void amenities() {
            assertEquals("AMENITIES", service.detectIntent("A quelle heure ouvre la piscine ?"));
        }

        @Test
        void location() {
            assertEquals("LOCATION", service.detectIntent("Y a-t-il un supermarche ou une pharmacie a proximite ?"));
        }

        @Test
        void extension() {
            assertEquals("EXTENSION", service.detectIntent("Je voudrais prolonger mon sejour d'une nuit supplementaire"));
        }

        @Test
        void unknown() {
            assertEquals("UNKNOWN", service.detectIntent("Ceci est un message aleatoire sans intention"));
        }

        @Test
        void nullOrBlank() {
            assertEquals("UNKNOWN", service.detectIntent(null));
            assertEquals("UNKNOWN", service.detectIntent(""));
            assertEquals("UNKNOWN", service.detectIntent("   "));
        }
    }

    // ─── Rule-based: generateSuggestedResponse ────────────────────────

    @Nested
    class SuggestResponse {

        @Test
        void replacesVariables() {
            Map<String, String> vars = Map.of(
                "wifi_name", "ClenzyWifi",
                "wifi_password", "secret123"
            );
            String response = service.generateSuggestedResponse("Quel est le wifi password ?", vars);
            assertTrue(response.contains("ClenzyWifi"));
            assertTrue(response.contains("secret123"));
            assertFalse(response.contains("{wifi_name}"));
        }

        @Test
        void unreplacedVarsShowPlaceholder() {
            String response = service.generateSuggestedResponse("check-in time?", Map.of());
            assertTrue(response.contains("[a configurer]"));
            assertFalse(response.contains("{check_in_time}"));
        }

        @Test
        void unknownIntentDefaultMessage() {
            String response = service.generateSuggestedResponse("blabla random", Map.of());
            assertTrue(response.contains("Merci pour votre message"));
        }
    }

    // ─── Rule-based: isUrgent ─────────────────────────────────────────

    @Nested
    class IsUrgent {

        @Test
        void detectsUrgentKeywords() {
            assertTrue(service.isUrgent("C'est urgent, il y a une fuite d'eau !"));
            assertTrue(service.isUrgent("There is a fire emergency"));
            assertTrue(service.isUrgent("I'm locked out of the apartment"));
            assertTrue(service.isUrgent("Il y a un danger"));
        }

        @Test
        void normalMessageNotUrgent() {
            assertFalse(service.isUrgent("Bonjour, a quelle heure est le check-in ?"));
            assertFalse(service.isUrgent("Merci pour tout, super sejour !"));
        }

        @Test
        void nullReturnsFalse() {
            assertFalse(service.isUrgent(null));
        }
    }

    // ─── Rule-based: analyzeSentiment ─────────────────────────────────

    @Nested
    class AnalyzeSentiment {

        @Test
        void positiveMessage() {
            double score = service.analyzeSentiment("Merci beaucoup, c'est super et parfait !");
            assertTrue(score > 0, "Positive message should have positive score");
        }

        @Test
        void negativeMessage() {
            double score = service.analyzeSentiment("C'est terrible, l'appartement est sale et j'suis decu");
            assertTrue(score < 0, "Negative message should have negative score");
        }

        @Test
        void neutralMessage() {
            double score = service.analyzeSentiment("Bonjour, a quelle heure est le checkout ?");
            assertEquals(0.0, score);
        }

        @Test
        void nullOrBlank() {
            assertEquals(0.0, service.analyzeSentiment(null));
            assertEquals(0.0, service.analyzeSentiment(""));
            assertEquals(0.0, service.analyzeSentiment("   "));
        }

        @Test
        void cappedAtOne() {
            double score = service.analyzeSentiment("merci thank great super excellent parfait perfect love amazing wonderful");
            assertTrue(score <= 1.0);
            assertTrue(score > 0);
        }
    }

    // ─── AI-powered ───────────────────────────────────────────────────

    @Nested
    class AiPowered {

        private static final ResolvedKey PLATFORM_KEY = new ResolvedKey("sk-platform", null, KeySource.PLATFORM);

        private void enableMessagingAi() {
            AiProperties.Features features = new AiProperties.Features();
            features.setMessagingAi(true);
            when(aiProperties.getFeatures()).thenReturn(features);
        }

        private void disableMessagingAi() {
            AiProperties.Features features = new AiProperties.Features();
            features.setMessagingAi(false);
            when(aiProperties.getFeatures()).thenReturn(features);
        }

        // ── detectIntentAi ──

        @Test
        void detectIntentAi_featureFlagDisabled_throws() {
            disableMessagingAi();

            assertThrows(AiNotConfiguredException.class,
                () -> service.detectIntentAi("Hello", 1L));
        }

        @Test
        void detectIntentAi_validResponse_parsesCorrectly() {
            enableMessagingAi();
            when(aiKeyResolver.resolve(1L, "anthropic")).thenReturn(PLATFORM_KEY);
            when(anonymizationService.anonymize(any())).thenReturn("Hello");
            when(anthropicProvider.chat(any(AiRequest.class))).thenReturn(
                new AiResponse(
                    """
                    {"intent":"CHECK_IN","confidence":0.95,"language":"en","entities":["3pm"],"urgent":false}
                    """,
                    50, 80, 130, "claude-3-haiku", "end_turn"
                )
            );
            when(anthropicProvider.name()).thenReturn("anthropic");

            AiIntentDetectionDto result = service.detectIntentAi("Hello, what's the check-in time?", 1L);

            assertEquals("CHECK_IN", result.intent());
            assertEquals(0.95, result.confidence(), 0.01);
            assertEquals("en", result.language());
            assertFalse(result.urgent());
            assertTrue(result.entities().contains("3pm"));
        }

        @Test
        void detectIntentAi_callsAnonymization() {
            enableMessagingAi();
            when(aiKeyResolver.resolve(1L, "anthropic")).thenReturn(PLATFORM_KEY);
            when(anonymizationService.anonymize("My email is john@test.com")).thenReturn("My email is [EMAIL]");
            when(anthropicProvider.chat(any(AiRequest.class))).thenReturn(
                new AiResponse(
                    """
                    {"intent":"UNKNOWN","confidence":0.5,"language":"en","entities":[],"urgent":false}
                    """,
                    30, 40, 70, "claude-3-haiku", "end_turn"
                )
            );
            when(anthropicProvider.name()).thenReturn("anthropic");

            service.detectIntentAi("My email is john@test.com", 1L);

            verify(anonymizationService).anonymize("My email is john@test.com");
        }

        @Test
        void detectIntentAi_budgetExceeded_throws() {
            enableMessagingAi();
            when(anthropicProvider.name()).thenReturn("anthropic");
            when(aiKeyResolver.resolve(1L, "anthropic")).thenReturn(PLATFORM_KEY);
            doThrow(new IllegalStateException("Token budget exceeded"))
                .when(tokenBudgetService).requireBudget(1L, AiFeature.MESSAGING, KeySource.PLATFORM);

            assertThrows(IllegalStateException.class,
                () -> service.detectIntentAi("Hello", 1L));
        }

        @Test
        void detectIntentAi_recordsUsage() {
            enableMessagingAi();
            when(aiKeyResolver.resolve(1L, "anthropic")).thenReturn(PLATFORM_KEY);
            when(anonymizationService.anonymize(any())).thenReturn("Hello");
            AiResponse response = new AiResponse(
                """
                {"intent":"WIFI","confidence":0.9,"language":"en","entities":[],"urgent":false}
                """,
                40, 60, 100, "claude-3-haiku", "end_turn"
            );
            when(anthropicProvider.chat(any(AiRequest.class))).thenReturn(response);
            when(anthropicProvider.name()).thenReturn("anthropic");

            service.detectIntentAi("What's the wifi?", 1L);

            verify(tokenBudgetService).recordUsage(eq(1L), eq(AiFeature.MESSAGING), eq("anthropic"), eq(response));
        }

        // ── generateSuggestedResponseAi ──

        @Test
        void suggestResponseAi_featureFlagDisabled_throws() {
            disableMessagingAi();

            assertThrows(AiNotConfiguredException.class,
                () -> service.generateSuggestedResponseAi("Bonjour", "context", "fr", 1L));
        }

        @Test
        void suggestResponseAi_validResponse_parsesCorrectly() {
            enableMessagingAi();
            when(aiKeyResolver.resolve(1L, "anthropic")).thenReturn(PLATFORM_KEY);
            when(anonymizationService.anonymize(any())).thenReturn("Bonjour");
            when(anthropicProvider.chat(any(AiRequest.class))).thenReturn(
                new AiResponse(
                    """
                    {"response":"Bienvenue ! Nous sommes ravis de vous accueillir.","tone":"friendly","language":"fr","alternatives":["Bonjour et bienvenue !","Nous vous souhaitons un agreable sejour."]}
                    """,
                    60, 100, 160, "claude-3-haiku", "end_turn"
                )
            );
            when(anthropicProvider.name()).thenReturn("anthropic");

            AiSuggestedResponseDto result = service.generateSuggestedResponseAi("Bonjour", null, "fr", 1L);

            assertEquals("friendly", result.tone());
            assertEquals("fr", result.language());
            assertNotNull(result.response());
            assertEquals(2, result.alternatives().size());
        }

        @Test
        void suggestResponseAi_invalidJson_throwsProviderException() {
            enableMessagingAi();
            when(aiKeyResolver.resolve(1L, "anthropic")).thenReturn(PLATFORM_KEY);
            when(anonymizationService.anonymize(any())).thenReturn("Hello");
            when(anthropicProvider.chat(any(AiRequest.class))).thenReturn(
                new AiResponse("not valid json {{{", 20, 10, 30, "claude-3-haiku", "end_turn")
            );
            when(anthropicProvider.name()).thenReturn("anthropic");

            assertThrows(AiProviderException.class,
                () -> service.generateSuggestedResponseAi("Hello", null, "en", 1L));
        }

        @Test
        void suggestResponseAi_budgetExceeded_throws() {
            enableMessagingAi();
            when(anthropicProvider.name()).thenReturn("anthropic");
            when(aiKeyResolver.resolve(2L, "anthropic")).thenReturn(PLATFORM_KEY);
            doThrow(new IllegalStateException("Token budget exceeded"))
                .when(tokenBudgetService).requireBudget(2L, AiFeature.MESSAGING, KeySource.PLATFORM);

            assertThrows(IllegalStateException.class,
                () -> service.generateSuggestedResponseAi("Hello", null, "en", 2L));
        }
    }
}
