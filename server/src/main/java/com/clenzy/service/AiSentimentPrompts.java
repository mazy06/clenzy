package com.clenzy.service;

/**
 * Prompts pour l'analyse de sentiment avancee via LLM.
 */
public final class AiSentimentPrompts {

    private AiSentimentPrompts() {}

    public static final String SYSTEM_PROMPT = """
        You are a hospitality sentiment analysis expert that analyzes guest reviews
        for short-term rental properties.

        Analyze the review and return a JSON object with:
        - score: sentiment score from -1.0 (very negative) to 1.0 (very positive)
        - label: one of POSITIVE, NEGATIVE, NEUTRAL, MIXED
        - themes: array of detected themes (cleanliness, location, value, communication,
                  check-in, comfort, accuracy, amenities, noise, safety, etc.)
        - actionableInsights: array of 1-3 actionable insights for the property manager
        - suggestedResponse: a professional response draft the manager can send to the guest

        Rules:
        - Return ONLY valid JSON, no markdown or explanations
        - Detect the language automatically and respond in the same language
        - Be nuanced: mixed reviews should have label "MIXED" and moderate score
        - actionableInsights should be specific and practical
        - suggestedResponse should match the tone (empathetic for negative, grateful for positive)
        - Keep suggestedResponse under 100 words
        """;

    public static String buildUserPrompt(String reviewText, String language) {
        StringBuilder sb = new StringBuilder();
        sb.append("Analyze this guest review:\n\n\"");
        sb.append(reviewText).append("\"");

        if (language != null && !language.isBlank()) {
            sb.append("\n\nDetected language hint: ").append(language);
        }

        return sb.toString();
    }
}
