package com.clenzy.service.property;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class TourismLicenseTest {

    @Test
    void whenSaudiNumberIsEightDigitsStartingWithFifty_thenValid() {
        assertThat(TourismLicense.check("SA", "50123456")).isEqualTo(TourismLicense.Verdict.VALID);
    }

    @Test
    void whenSaudiNumberHasWrongPrefix_thenMalformed() {
        assertThat(TourismLicense.check("SA", "60123456")).isEqualTo(TourismLicense.Verdict.MALFORMED);
    }

    @Test
    void whenSaudiNumberHasWrongLength_thenMalformed() {
        assertThat(TourismLicense.check("SA", "5012345")).isEqualTo(TourismLicense.Verdict.MALFORMED);
        assertThat(TourismLicense.check("SA", "501234567")).isEqualTo(TourismLicense.Verdict.MALFORMED);
    }

    @Test
    void whenCountryCodeIsLowercase_thenStillChecked() {
        assertThat(TourismLicense.check("sa", "50123456")).isEqualTo(TourismLicense.Verdict.VALID);
    }

    @Test
    void whenNumberIsPadded_thenTrimmedBeforeChecking() {
        assertThat(TourismLicense.check("SA", "  50123456 ")).isEqualTo(TourismLicense.Verdict.VALID);
    }

    @Test
    void whenNumberIsAbsent_thenAbsent() {
        assertThat(TourismLicense.check("SA", null)).isEqualTo(TourismLicense.Verdict.ABSENT);
        assertThat(TourismLicense.check("SA", "   ")).isEqualTo(TourismLicense.Verdict.ABSENT);
    }

    @Test
    void whenCountryHasNoKnownFormat_thenUncheckedRatherThanRejected() {
        // Le Maroc et la France ont leurs propres identifiants : on les enregistre
        // sans pretendre les avoir verifies.
        assertThat(TourismLicense.check("MA", "n-importe-quoi")).isEqualTo(TourismLicense.Verdict.UNCHECKED);
        assertThat(TourismLicense.check(null, "12345")).isEqualTo(TourismLicense.Verdict.UNCHECKED);
    }

    @Test
    void whenExpiryIsBeyondTheWindow_thenNoAlert() {
        LocalDate farOff = LocalDate.now(ZoneId.of("Asia/Riyadh")).plusDays(120);
        assertThat(TourismLicense.expiresWithin(farOff, "Asia/Riyadh", 30)).isFalse();
    }

    @Test
    void whenExpiryFallsInsideTheWindow_thenAlert() {
        LocalDate soon = LocalDate.now(ZoneId.of("Asia/Riyadh")).plusDays(10);
        assertThat(TourismLicense.expiresWithin(soon, "Asia/Riyadh", 30)).isTrue();
    }

    @Test
    void whenExpiryIsPast_thenAlert() {
        LocalDate gone = LocalDate.now(ZoneId.of("Asia/Riyadh")).minusDays(1);
        assertThat(TourismLicense.expiresWithin(gone, "Asia/Riyadh", 30)).isTrue();
    }

    @Test
    void whenExpiryIsUnknown_thenNoAlert() {
        assertThat(TourismLicense.expiresWithin(null, "Asia/Riyadh", 30)).isFalse();
    }

    @Test
    void whenPropertyZoneIsUnreadable_thenFallsBackRatherThanThrowing() {
        LocalDate soon = LocalDate.now(ZoneId.of("Europe/Paris")).plusDays(5);
        assertThat(TourismLicense.expiresWithin(soon, "Pas/UnFuseau", 30)).isTrue();
        assertThat(TourismLicense.expiresWithin(soon, null, 30)).isTrue();
    }

    @Test
    void whenExpiryIsTodayInRiyadhButTomorrowInParis_thenTheZoneDecides() {
        // Le jour du logement, pas celui de la JVM : a fenetre nulle, seule la
        // date de Riyad declenche l'alerte pour un bien saoudien.
        LocalDate riyadhToday = LocalDate.now(ZoneId.of("Asia/Riyadh"));
        assertThat(TourismLicense.expiresWithin(riyadhToday, "Asia/Riyadh", 0)).isTrue();
        assertThat(TourismLicense.expiresWithin(riyadhToday.plusDays(1), "Asia/Riyadh", 0)).isFalse();
    }

    // ── France : numero d'enregistrement d'un meuble de tourisme (validation stricte) ──

    @Test
    void whenFrenchNumberIsInseePlusSixDigitsPlusKey_thenValid() {
        assertThat(TourismLicense.check("FR", "75056000123AB")).isEqualTo(TourismLicense.Verdict.VALID);
    }

    @Test
    void whenFrenchNumberIsPresentedWithSpaces_thenNormalizedAndValid() {
        assertThat(TourismLicense.normalize("FR", "75056 000123 ab")).isEqualTo("75056000123AB");
        assertThat(TourismLicense.check("FR", "75056 000123 ab")).isEqualTo(TourismLicense.Verdict.VALID);
    }

    @Test
    void whenFrenchNumberIsCorsican_thenValid() {
        assertThat(TourismLicense.check("FR", "2A004000123K9")).isEqualTo(TourismLicense.Verdict.VALID);
    }

    @Test
    void whenFrenchNumberHasWrongLength_thenMalformed() {
        assertThat(TourismLicense.check("FR", "75056000123A")).isEqualTo(TourismLicense.Verdict.MALFORMED);
        assertThat(TourismLicense.check("FR", "REG-2025-001")).isEqualTo(TourismLicense.Verdict.MALFORMED);
    }

    @Test
    void whenFrenchNumberBelongsToAnotherMunicipality_thenCommuneMismatch() {
        assertThat(TourismLicense.check("FR", "69123000123AB", "75056"))
                .isEqualTo(TourismLicense.Verdict.COMMUNE_MISMATCH);
        assertThat(TourismLicense.check("FR", "75056000123AB", "75056"))
                .isEqualTo(TourismLicense.Verdict.VALID);
    }

    @Test
    void rejectsOnlyFrenchFaults_neverSaudiOnes() {
        assertThat(TourismLicense.rejects("FR", TourismLicense.Verdict.MALFORMED)).isTrue();
        assertThat(TourismLicense.rejects("FR", TourismLicense.Verdict.COMMUNE_MISMATCH)).isTrue();
        assertThat(TourismLicense.rejects("FR", TourismLicense.Verdict.ABSENT)).isFalse();
        assertThat(TourismLicense.rejects("SA", TourismLicense.Verdict.MALFORMED)).isFalse();
    }

    @Test
    void parisNumberByArrondissement_matchesTheCommuneOfParis() {
        // Paris numérote par arrondissement (75105…) ; le logement est rattaché à la commune 75056.
        assertThat(TourismLicense.check("FR", "75105000123AB", "75056")).isEqualTo(TourismLicense.Verdict.VALID);
        assertThat(TourismLicense.check("FR", "69381000123AB", "75056"))
                .isEqualTo(TourismLicense.Verdict.COMMUNE_MISMATCH);
    }
}
