package com.clenzy.integration.channex.dto;

import java.util.List;

/**
 * Rapport d'intégrité d'un mapping Channex (CLZ Domaine 1) : vérifie que la property, le room type
 * et les rate plans référencés existent encore côté hub Channex.
 *
 * @param valid  true si aucun problème détecté
 * @param issues liste (éventuellement vide) des anomalies constatées
 */
public record MappingValidationReport(boolean valid, List<String> issues) {
}
