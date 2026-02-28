package com.clenzy.fiscal;

import com.clenzy.model.TaxRule;

import java.time.LocalDate;
import java.util.List;

/**
 * Interface Strategy pour le calcul des taxes par pays.
 * Chaque pays implemente sa propre logique de taxation.
 *
 * Implementations :
 * - FranceTaxCalculator  : TVA FR + taxe de sejour par commune
 * - MoroccoTaxCalculator : TVA MA + taxe promotion touristique (Phase 4)
 * - SaudiTaxCalculator   : VAT 15% + municipality fees (Phase 5)
 */
public interface TaxCalculator {

    /**
     * Code ISO 3166-1 alpha-2 du pays (FR, MA, SA).
     */
    String getCountryCode();

    /**
     * Calcule la taxe applicable a un element imposable.
     *
     * @param item            Element imposable (montant HT + categorie)
     * @param transactionDate Date de la transaction (pour determiner le taux applicable)
     * @return Resultat du calcul (HT, taxe, TTC, taux, nom)
     */
    TaxResult calculateTax(TaxableItem item, LocalDate transactionDate);

    /**
     * Calcule la taxe de sejour / municipality fee.
     *
     * @param input Donnees d'entree (tarif, nombre de personnes, nuits, etc.)
     * @return Resultat (montant, description)
     */
    TouristTaxResult calculateTouristTax(TouristTaxInput input);

    /**
     * Retourne les regles fiscales applicables pour une categorie et une date.
     */
    List<TaxRule> getApplicableRules(String taxCategory, LocalDate date);
}
