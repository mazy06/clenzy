package com.clenzy.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Rapport de pace des prochains mois de séjour (PaceAnalyticsService).
 *
 * @param generatedOn      date du calcul (les valeurs OTB sont « vues » à cette date)
 * @param activeProperties nombre de logements actifs du périmètre (dénominateur d'occupation)
 * @param months           une ligne par mois de séjour, du mois courant vers le futur
 */
public record PaceSummaryDto(
        LocalDate generatedOn,
        long activeProperties,
        List<PaceMonthDto> months) {
}
