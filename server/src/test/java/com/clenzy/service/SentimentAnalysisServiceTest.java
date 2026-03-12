package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiProviderException;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.config.ai.AnthropicProvider;
import com.clenzy.dto.AiSentimentResultDto;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.model.ReviewTag;
import com.clenzy.model.SentimentLabel;
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

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SentimentAnalysisServiceTest {

    @Mock private AiProperties aiProperties;
    @Mock private AnthropicProvider anthropicProvider;
    @Mock private AiAnonymizationService anonymizationService;
    @Mock private AiTokenBudgetService tokenBudgetService;
    @Mock private AiKeyResolver aiKeyResolver;
    @Spy  private ObjectMapper objectMapper = new ObjectMapper();
    @InjectMocks private SentimentAnalysisService service;

    // ─── Rule-based ───────────────────────────────────────────────────

    @Nested
    class RuleBased {

        @Test
        void analyze_positiveEnglishText_returnsPositive() {
            var result = service.analyze("Amazing place, very clean and comfortable. Perfect location!", "en");
            assertEquals(SentimentLabel.POSITIVE, result.label());
            assertTrue(result.score() > 0.2);
        }

        @Test
        void analyze_negativeEnglishText_returnsNegative() {
            var result = service.analyze("Terrible experience. Dirty room with horrible smell and broken furniture.", "en");
            assertEquals(SentimentLabel.NEGATIVE, result.label());
            assertTrue(result.score() < -0.2);
        }

        @Test
        void analyze_neutralText_returnsNeutral() {
            var result = service.analyze("The room was okay. Nothing special to report about the stay.", "en");
            assertEquals(SentimentLabel.NEUTRAL, result.label());
        }

        @Test
        void analyze_frenchPositiveText_returnsPositive() {
            var result = service.analyze("Magnifique appartement, tres propre et confortable. Parfait!", "fr");
            assertEquals(SentimentLabel.POSITIVE, result.label());
            assertTrue(result.score() > 0);
        }

        @Test
        void analyze_frenchNegativeText_returnsNegative() {
            var result = service.analyze("Terrible. Appartement sale et bruyant, tres decevant.", "fr");
            assertEquals(SentimentLabel.NEGATIVE, result.label());
            assertTrue(result.score() < 0);
        }

        @Test
        void analyze_spanishText_returnsCorrectSentiment() {
            var result = service.analyze("Excelente lugar, muy limpio y comodo. Perfecto!", "es");
            assertEquals(SentimentLabel.POSITIVE, result.label());
        }

        @Test
        void analyze_germanText_returnsCorrectSentiment() {
            var result = service.analyze("Ausgezeichnet, sehr sauber und bequem. Perfekt!", "de");
            assertEquals(SentimentLabel.POSITIVE, result.label());
        }

        @Test
        void analyze_nullText_returnsNeutral() {
            var result = service.analyze(null, "en");
            assertEquals(SentimentLabel.NEUTRAL, result.label());
            assertEquals(0.0, result.score());
            assertTrue(result.tags().isEmpty());
        }

        @Test
        void analyze_emptyText_returnsNeutral() {
            var result = service.analyze("", "en");
            assertEquals(SentimentLabel.NEUTRAL, result.label());
            assertEquals(0.0, result.score());
        }

        @Test
        void analyze_unknownLanguage_fallsBackToEnglish() {
            var result = service.analyze("Amazing and perfect place!", "xx");
            assertEquals(SentimentLabel.POSITIVE, result.label());
        }

        @Test
        void analyze_extractsCleanlinessTag() {
            var result = service.analyze("The place was spotless and very clean!", "en");
            assertTrue(result.tags().contains(ReviewTag.CLEANLINESS));
        }

        @Test
        void analyze_extractsLocationTag() {
            var result = service.analyze("Great location, very central neighborhood.", "en");
            assertTrue(result.tags().contains(ReviewTag.LOCATION));
        }

        @Test
        void analyze_extractsMultipleTags() {
            var result = service.analyze("Clean kitchen, great location, comfortable bed, fast wifi.", "en");
            assertTrue(result.tags().contains(ReviewTag.CLEANLINESS));
            assertTrue(result.tags().contains(ReviewTag.LOCATION));
            assertTrue(result.tags().contains(ReviewTag.COMFORT));
            assertTrue(result.tags().contains(ReviewTag.AMENITIES));
        }

        @Test
        void extractTags_returnsTagsFromText() {
            List<ReviewTag> tags = service.extractTags("The bed was comfortable and the kitchen was well equipped", "en");
            assertTrue(tags.contains(ReviewTag.COMFORT));
            assertTrue(tags.contains(ReviewTag.AMENITIES));
        }

        @Test
        void analyze_scoreIsClamped() {
            var result = service.analyze("perfect amazing excellent wonderful fantastic superb outstanding", "en");
            assertTrue(result.score() <= 1.0);
            assertTrue(result.score() >= -1.0);
        }

        @Test
        void analyze_nullLanguage_fallsBackToEnglish() {
            var result = service.analyze("Amazing place!", null);
            assertEquals(SentimentLabel.POSITIVE, result.label());
        }

        @Test
        void analyze_languageWithRegion_normalizesCorrectly() {
            var result = service.analyze("Magnifique et parfait!", "fr-FR");
            assertEquals(SentimentLabel.POSITIVE, result.label());
        }
    }

    // ─── AI-powered ───────────────────────────────────────────────────

    @Nested
    class AiPowered {

        private static final ResolvedKey PLATFORM_KEY = new ResolvedKey("sk-platform", null, KeySource.PLATFORM);

        private void enableSentimentAi() {
            AiProperties.Features features = new AiProperties.Features();
            features.setSentimentAi(true);
            when(aiProperties.getFeatures()).thenReturn(features);
        }

        private void disableSentimentAi() {
            AiProperties.Features features = new AiProperties.Features();
            features.setSentimentAi(false);
            when(aiProperties.getFeatures()).thenReturn(features);
        }

        @Test
        void featureFlagDisabled_throws() {
            disableSentimentAi();

            assertThrows(AiNotConfiguredException.class,
                () -> service.analyzeAi("Great place!", "en", 1L));
        }

        @Test
        void validResponse_parsesCorrectly() {
            enableSentimentAi();
            when(aiKeyResolver.resolve(1L, "anthropic")).thenReturn(PLATFORM_KEY);
            when(anonymizationService.anonymize(any())).thenReturn("Great place!");
            when(anthropicProvider.chat(any(AiRequest.class))).thenReturn(
                new AiResponse(
                    """
                    {"score":0.85,"label":"POSITIVE","themes":["cleanliness","comfort"],"actionableInsights":["Maintain cleaning standards"],"suggestedResponse":"Thank you for your kind words!"}
                    """,
                    40, 80, 120, "claude-3-haiku", "end_turn"
                )
            );
            when(anthropicProvider.name()).thenReturn("anthropic");

            AiSentimentResultDto result = service.analyzeAi("Great place!", "en", 1L);

            assertEquals(0.85, result.score(), 0.01);
            assertEquals("POSITIVE", result.label());
            assertEquals(2, result.themes().size());
            assertTrue(result.themes().contains("cleanliness"));
            assertNotNull(result.suggestedResponse());
        }

        @Test
        void callsAnonymization() {
            enableSentimentAi();
            when(aiKeyResolver.resolve(1L, "anthropic")).thenReturn(PLATFORM_KEY);
            when(anonymizationService.anonymize("My email john@test.com review")).thenReturn("My email [EMAIL] review");
            when(anthropicProvider.chat(any(AiRequest.class))).thenReturn(
                new AiResponse(
                    """
                    {"score":0.0,"label":"NEUTRAL","themes":[],"actionableInsights":[],"suggestedResponse":"Thank you."}
                    """,
                    20, 30, 50, "claude-3-haiku", "end_turn"
                )
            );
            when(anthropicProvider.name()).thenReturn("anthropic");

            service.analyzeAi("My email john@test.com review", "en", 1L);

            verify(anonymizationService).anonymize("My email john@test.com review");
        }

        @Test
        void budgetExceeded_throws() {
            enableSentimentAi();
            when(anthropicProvider.name()).thenReturn("anthropic");
            when(aiKeyResolver.resolve(1L, "anthropic")).thenReturn(PLATFORM_KEY);
            doThrow(new IllegalStateException("Token budget exceeded"))
                .when(tokenBudgetService).requireBudget(1L, AiFeature.SENTIMENT, KeySource.PLATFORM);

            assertThrows(IllegalStateException.class,
                () -> service.analyzeAi("Great place!", "en", 1L));
        }

        @Test
        void recordsUsage() {
            enableSentimentAi();
            when(aiKeyResolver.resolve(1L, "anthropic")).thenReturn(PLATFORM_KEY);
            when(anonymizationService.anonymize(any())).thenReturn("Great");
            AiResponse response = new AiResponse(
                """
                {"score":0.5,"label":"POSITIVE","themes":[],"actionableInsights":[],"suggestedResponse":"Thanks!"}
                """,
                30, 50, 80, "claude-3-haiku", "end_turn"
            );
            when(anthropicProvider.chat(any(AiRequest.class))).thenReturn(response);
            when(anthropicProvider.name()).thenReturn("anthropic");

            service.analyzeAi("Great", "en", 1L);

            verify(tokenBudgetService).recordUsage(eq(1L), eq(AiFeature.SENTIMENT), eq("anthropic"), eq(response));
        }

        @Test
        void invalidJson_throwsProviderException() {
            enableSentimentAi();
            when(aiKeyResolver.resolve(1L, "anthropic")).thenReturn(PLATFORM_KEY);
            when(anonymizationService.anonymize(any())).thenReturn("Hello");
            when(anthropicProvider.chat(any(AiRequest.class))).thenReturn(
                new AiResponse("invalid json", 10, 5, 15, "claude-3-haiku", "end_turn")
            );
            when(anthropicProvider.name()).thenReturn("anthropic");

            assertThrows(AiProviderException.class,
                () -> service.analyzeAi("Hello", "en", 1L));
        }
    }
}
