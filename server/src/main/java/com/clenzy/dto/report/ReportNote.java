package com.clenzy.dto.report;

/**
 * Un constat factuel attache a une section.
 *
 * <p>Calcule par le moteur, jamais redige par l'agent : c'est ce qui garantit
 * qu'un rapport genere SANS commentaire IA reste informatif. L'agent s'appuie
 * dessus, il ne le remplace pas.</p>
 *
 * @param tone {@code neutral}, {@code positive}, {@code warning}, {@code critical}
 * @param impact portee chiffree et deja formatee, ou {@code null}
 */
public record ReportNote(String tone, String label, String detail, String impact) {

    public static ReportNote neutral(String label, String detail) {
        return new ReportNote("neutral", label, detail, null);
    }

    public static ReportNote positive(String label, String detail) {
        return new ReportNote("positive", label, detail, null);
    }

    public static ReportNote warning(String label, String detail) {
        return new ReportNote("warning", label, detail, null);
    }

    public ReportNote withImpact(String value) {
        return new ReportNote(tone, label, detail, value);
    }
}
