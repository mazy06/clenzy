package com.clenzy.dto.report;

import java.math.BigDecimal;

/**
 * Un chiffre cle de la synthese executive.
 *
 * <p><b>Le double comparatif est obligatoire par conception.</b> Un chiffre
 * seul ne dit rien : « 30,7 % d'occupation » ne prend de sens que face aux
 * 26 % de l'an dernier et aux 34 % du trimestre precedent. Les deux ecarts
 * sont donc des champs de premiere classe, pas une option d'affichage.</p>
 *
 * @param value            la valeur DEJA formatee — les trois rendus affichent le meme texte
 * @param rawValue         la valeur brute, pour l'agent et les tris
 * @param deltaPreviousPct ecart avec la periode precedente, en pourcentage
 * @param deltaLastYearPct ecart avec la meme periode l'an dernier
 * @param higherIsBetter   faux pour un cout : une hausse n'y est pas une bonne nouvelle
 */
public record ReportKpi(
        String key,
        String label,
        String value,
        BigDecimal rawValue,
        BigDecimal deltaPreviousPct,
        BigDecimal deltaLastYearPct,
        boolean higherIsBetter,
        String hint
) {
    public static ReportKpi of(String key, String label, String value, BigDecimal rawValue) {
        return new ReportKpi(key, label, value, rawValue, null, null, true, null);
    }

    public ReportKpi withDeltas(BigDecimal previous, BigDecimal lastYear) {
        return new ReportKpi(key, label, value, rawValue, previous, lastYear, higherIsBetter, hint);
    }

    public ReportKpi lowerIsBetter() {
        return new ReportKpi(key, label, value, rawValue, deltaPreviousPct, deltaLastYearPct, false, hint);
    }

    public ReportKpi withHint(String newHint) {
        return new ReportKpi(key, label, value, rawValue, deltaPreviousPct, deltaLastYearPct, higherIsBetter, newHint);
    }
}
