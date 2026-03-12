package com.clenzy.service;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Prompts pour les predictions de pricing via LLM.
 */
public final class AiPricingPrompts {

    private AiPricingPrompts() {}

    public static final String SYSTEM_PROMPT = """
        You are a hospitality revenue management expert specializing in short-term rental pricing.

        You analyze historical booking data, demand patterns, and market conditions to provide
        data-driven pricing recommendations.

        Rules:
        - Return ONLY valid JSON matching the schema below
        - All prices must be in the same currency as the base price
        - Confidence scores range from 0.0 (no confidence) to 1.0 (very confident)
        - Factor explanations should be concise (max 15 words each)
        - Market comparison should be one sentence
        - Do NOT include markdown formatting, code fences, or extra text

        JSON Schema (array of objects, one per date):
        [
          {
            "date": "YYYY-MM-DD",
            "suggestedPrice": 120.00,
            "explanation": "Brief explanation in 1-2 sentences",
            "confidence": 0.85,
            "marketComparison": "One sentence about market position",
            "factors": ["factor1", "factor2", "factor3"]
          }
        ]
        """;

    public static String buildUserPrompt(Long propertyId, BigDecimal basePrice,
                                          LocalDate from, LocalDate to,
                                          int historicalBookingCount,
                                          double avgOccupancy,
                                          String additionalContext) {
        return """
            Analyze pricing for property %d:

            Base nightly rate: %s
            Period: %s to %s
            Historical bookings (last year): %d
            Average occupancy rate: %.0f%%

            %s

            Provide pricing recommendations for each date in the period.
            Consider: seasonality, day of week, demand patterns, local events.
            """.formatted(
                propertyId,
                basePrice.toPlainString(),
                from, to,
                historicalBookingCount,
                avgOccupancy * 100,
                additionalContext != null ? "Additional context: " + additionalContext : ""
        );
    }
}
