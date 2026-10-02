package com.clenzy.service.compliance;

import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;

/**
 * Ce que la loi du pays du logement exige d'une fiche voyageur — voyageur par voyageur.
 *
 * <p>Envoye tel quel au livret (le formulaire en derive ses champs) et applique par
 * {@code GuestDeclarationService} : une seule source de verite pour le front et le serveur.</p>
 *
 * <p><b>France — fiche individuelle de police</b> (CESEDA L814-1, R814-1 a R814-3) :</p>
 * <ul>
 *   <li>due par les seuls voyageurs ETRANGERS : un ressortissant francais en est dispense
 *       ({@link #exemptNationality}), seule son identite est notee ;</li>
 *   <li>mentions : nom et prenoms, date et lieu de naissance, nationalite, domicile
 *       habituel, telephone mobile et adresse electronique ; les dates d'arrivee et de
 *       depart viennent du sejour. AUCUNE piece d'identite n'est exigee : elle n'est pas
 *       collectee (minimisation) ;</li>
 *   <li>les enfants de moins de 15 ans peuvent figurer sur la fiche de l'adulte qu'ils
 *       accompagnent ({@link #minorAgeUnder}) : identite et naissance seulement ;</li>
 *   <li>la fiche est signee par le voyageur ({@link #certificationRequired}) ;</li>
 *   <li>conservee six mois par l'exploitant et remise sur demande aux services de police :
 *       AUCUNE teletransmission ({@link #retainedLocally}).</li>
 * </ul>
 *
 * <p><b>Ailleurs</b> (Maroc DGSN, Arabie saoudite Shomoos, defaut) : regle historique —
 * piece d'identite exigee, teletransmission par le provider du pays.</p>
 */
public record DeclarationRules(
        String countryCode,
        List<String> primaryFields,
        List<String> companionFields,
        List<String> minorFields,
        Integer minorAgeUnder,
        String exemptNationality,
        boolean certificationRequired,
        boolean retainedLocally,
        /** Date d'arrivee : reference du calcul d'age des mineurs. */
        LocalDate referenceDate
) {

    private static final List<String> FR_FULL = List.of(
            "firstName", "lastName", "birthDate", "birthPlace", "nationality",
            "residenceAddress", "phone", "email");
    private static final List<String> FR_MINOR = List.of("firstName", "lastName", "birthDate", "nationality");
    private static final List<String> FR_EXEMPT = List.of("firstName", "lastName", "nationality");

    private static final List<String> DEFAULT_PRIMARY = List.of(
            "firstName", "lastName", "birthDate", "birthPlace", "nationality",
            "residenceAddress", "idDocumentType", "idDocumentNumber");
    private static final List<String> DEFAULT_COMPANION = List.of(
            "firstName", "lastName", "birthDate", "birthPlace", "nationality",
            "idDocumentType", "idDocumentNumber");

    /** Regles du pays du logement ; {@code referenceDate} = arrivee du sejour (peut etre null). */
    public static DeclarationRules forCountry(String countryCode, LocalDate referenceDate) {
        String country = countryCode == null ? null : countryCode.trim().toUpperCase(Locale.ROOT);
        if ("FR".equals(country)) {
            return new DeclarationRules("FR", FR_FULL, FR_FULL, FR_MINOR, 15, "FR", true, true, referenceDate);
        }
        return new DeclarationRules(country, DEFAULT_PRIMARY, DEFAULT_COMPANION, DEFAULT_COMPANION,
                null, null, false, false, referenceDate);
    }

    /** Le voyageur est-il dispense de fiche (ressortissant du pays, en France) ? */
    public boolean isExempt(String nationality) {
        return exemptNationality != null && nationality != null
                && exemptNationality.equalsIgnoreCase(nationality.trim());
    }

    /** Champs exiges pour CE voyageur (sa nationalite et son age decident). */
    public List<String> requiredFields(boolean primary, String nationality, String birthDate) {
        if (isExempt(nationality)) {
            return FR_EXEMPT;
        }
        if (!primary && isMinor(birthDate)) {
            return minorFields;
        }
        return primary ? primaryFields : companionFields;
    }

    /** Moins de {@link #minorAgeUnder} ans a l'arrivee ; une date illisible ne fait pas un mineur. */
    public boolean isMinor(String birthDate) {
        if (minorAgeUnder == null || birthDate == null || birthDate.isBlank()) {
            return false;
        }
        try {
            LocalDate birth = LocalDate.parse(birthDate.trim());
            LocalDate ref = referenceDate != null ? referenceDate : LocalDate.now();
            return Period.between(birth, ref).getYears() < minorAgeUnder;
        } catch (DateTimeParseException e) {
            return false;
        }
    }
}
