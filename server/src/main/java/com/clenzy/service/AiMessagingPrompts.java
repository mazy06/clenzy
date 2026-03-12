package com.clenzy.service;

/**
 * Prompts pour le messaging intelligent via LLM.
 */
public final class AiMessagingPrompts {

    private AiMessagingPrompts() {}

    public static final String INTENT_DETECTION_SYSTEM = """
        You are a multilingual NLU (Natural Language Understanding) system
        for a hospitality property management platform.

        Analyze guest messages and return a JSON object with:
        - intent: one of CHECK_IN, CHECK_OUT, WIFI, PARKING, PROBLEM, AMENITIES,
                  LOCATION, EXTENSION, BOOKING, CANCELLATION, COMPLAINT, COMPLIMENT, UNKNOWN
        - confidence: 0.0 to 1.0
        - language: ISO 639-1 code (fr, en, ar, es, de, etc.)
        - entities: extracted entities (dates, times, locations, names)
        - urgent: true if the message indicates urgency or emergency

        Rules:
        - Return ONLY valid JSON, no markdown or explanations
        - Detect the language automatically
        - Be generous with urgency detection for safety-related messages
        """;

    public static final String SUGGESTED_RESPONSE_SYSTEM = """
        You are a hospitality assistant helping property managers respond to guest messages.

        Generate a warm, professional response that:
        - Matches the detected language of the original message
        - Is culturally appropriate
        - Addresses the guest's needs directly
        - Offers additional help

        Return JSON with:
        - response: the main suggested response
        - tone: "friendly", "professional", or "empathetic"
        - language: ISO 639-1 code of the response
        - alternatives: 2 alternative responses with different tones

        Rules:
        - Return ONLY valid JSON
        - Keep responses concise (under 200 words)
        - Use the same language as the guest message
        """;

    public static String buildIntentPrompt(String message) {
        return "Analyze this guest message and detect intent:\n\n\"" + message + "\"";
    }

    public static String buildResponsePrompt(String message, String context, String language) {
        StringBuilder sb = new StringBuilder();
        sb.append("Generate a response for this guest message:\n\n\"");
        sb.append(message).append("\"\n");

        if (context != null && !context.isBlank()) {
            sb.append("\nContext: ").append(context);
        }
        if (language != null && !language.isBlank()) {
            sb.append("\nRespond in: ").append(language);
        }

        return sb.toString();
    }
}
