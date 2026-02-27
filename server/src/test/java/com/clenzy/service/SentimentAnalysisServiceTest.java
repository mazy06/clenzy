package com.clenzy.service;

import com.clenzy.model.ReviewTag;
import com.clenzy.model.SentimentLabel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SentimentAnalysisServiceTest {

    private SentimentAnalysisService service;

    @BeforeEach
    void setUp() {
        service = new SentimentAnalysisService();
    }

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
