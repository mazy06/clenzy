package com.clenzy.integration.channex.dto;

/**
 * Écart constaté sur un champ de restriction de séjour entre Clenzy (local) et l'OTA (Channex),
 * pour une date donnée. {@code "-"} = absence de contrainte.
 *
 * @param field      nom du champ (min_stay_through, min_stay_arrival, closed_to_arrival, closed_to_departure)
 * @param localValue valeur côté Clenzy
 * @param otaValue   valeur côté OTA
 */
public record RestrictionDivergence(String field, String localValue, String otaValue) {
}
