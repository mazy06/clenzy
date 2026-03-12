package com.clenzy.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/**
 * Prompts pour les insights analytiques via LLM.
 */
public final class AiAnalyticsPrompts {

    private AiAnalyticsPrompts() {}

    public static final String SYSTEM_PROMPT = """
        You are a hospitality revenue management analyst providing actionable insights
        for short-term rental property managers.

        Analyze the provided analytics data and identify:
        - Anomalies (unusual patterns, unexpected drops/spikes)
        - Trends (occupancy trends, revenue evolution, seasonal patterns)
        - Recommendations (pricing adjustments, operational improvements)
        - Warnings (potential issues, underperformance)

        Rules:
        - Return ONLY valid JSON, no markdown or explanations
        - Return an array of insight objects
        - Each insight must have: type, severity, title, description, recommendation
        - type: one of ANOMALY, TREND, RECOMMENDATION, WARNING
        - severity: one of LOW, MEDIUM, HIGH, CRITICAL
        - title: concise (max 10 words)
        - description: one sentence explaining the insight
        - recommendation: one actionable sentence
        - Provide 3 to 6 insights
        - Focus on the most impactful observations
        """;

    public static String buildUserPrompt(Long propertyId,
                                          LocalDate from, LocalDate to,
                                          int totalNights, int bookedNights,
                                          double occupancyRate,
                                          BigDecimal totalRevenue,
                                          BigDecimal adr, BigDecimal revPar,
                                          Map<String, Double> occupancyByMonth,
                                          Map<String, BigDecimal> revenueByMonth,
                                          Map<String, Integer> bookingsBySource) {
        return """
            Analyze analytics for property %d:

            Period: %s to %s
            Total nights: %d
            Booked nights: %d
            Occupancy rate: %.0f%%
            Total revenue: %s
            ADR (Average Daily Rate): %s
            RevPAR (Revenue Per Available Room): %s

            Occupancy by month: %s
            Revenue by month: %s
            Bookings by source: %s

            Provide actionable insights based on this data.
            """.formatted(
                propertyId, from, to,
                totalNights, bookedNights,
                occupancyRate * 100,
                totalRevenue.toPlainString(),
                adr.toPlainString(),
                revPar.toPlainString(),
                occupancyByMonth,
                revenueByMonth,
                bookingsBySource
        );
    }
}
