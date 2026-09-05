package com.clenzy.dto.report;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * En-tete d'un rapport : qui, quoi, quand, sur quel perimetre.
 *
 * <p>La <b>note de perimetre</b> et la <b>date d'arret des donnees</b> ne sont
 * pas de la decoration : sans elles un rapport n'est pas defendable. « 17 133 € »
 * ne veut rien dire si l'on ignore sur quels biens, quelles dates, et a quel
 * moment les chiffres ont ete arretes.</p>
 *
 * @param documentNumber numero stable (ex. {@code R-2026-0042}), porte les versions
 * @param version        incremente a chaque regeneration ; un envoi fige la version
 * @param issuerName     l'emetteur AFFICHE — la conciergerie, pas Baitly (marque blanche)
 * @param recipientName  le destinataire nomme sur la page de garde
 * @param scopeLabels    les biens couverts, listes explicitement
 * @param scopeNote      exclusions et precisions de perimetre
 * @param dataAsOf       instant d'arret des donnees
 */
public record ReportMeta(
        String documentNumber,
        int version,
        ReportProfile profile,
        String title,
        String issuerName,
        String issuerLogoUrl,
        String recipientName,
        LocalDate periodStart,
        LocalDate periodEnd,
        LocalDate comparePeriodStart,
        LocalDate comparePeriodEnd,
        LocalDate lastYearPeriodStart,
        LocalDate lastYearPeriodEnd,
        Instant dataAsOf,
        String currency,
        List<String> scopeLabels,
        String scopeNote
) {
    public ReportMeta {
        scopeLabels = scopeLabels == null ? List.of() : List.copyOf(scopeLabels);
    }
}
