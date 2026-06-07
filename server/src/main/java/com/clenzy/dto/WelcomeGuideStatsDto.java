package com.clenzy.dto;

import java.util.List;

/**
 * Statistiques d'un livret cote hote : compteurs par type d'interaction guest,
 * serie quotidienne des ouvertures (tendance), et top des activites cliquees.
 */
public record WelcomeGuideStatsDto(
        long totalOpens,
        long chatMessages,
        long guestbookEntries,
        long activityClicks,
        long checkinClicks,
        List<DailyCount> dailyOpens,
        List<LabeledCount> topActivities) {

    /** Compte d'ouvertures pour un jour ({@code date} au format YYYY-MM-DD). */
    public record DailyCount(String date, long count) {}

    /** Compte etiquete (ex: nom d'activite -> nombre de clics). */
    public record LabeledCount(String label, long count) {}
}
