package com.clenzy.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires pour {@link IbanMasker}.
 *
 * <p>Couvre le formatage pour les principaux pays cibles de Clenzy (FR, MA,
 * SA) plus les cas dégradés (null, trop court).</p>
 */
class IbanMaskerTest {

    @Test
    @DisplayName("IBAN France (27 chars) — suffixe groupé, longueur préservée")
    void frenchIban() {
        assertThat(IbanMasker.mask("FR7612345678901234567890189"))
            .isEqualTo("FR76 **** **** **** **** *** 0189");
        // Longueur réelle de l'IBAN (sans espaces) = 27
        assertThat(IbanMasker.mask("FR7612345678901234567890189").replace(" ", "").length())
            .isEqualTo(27);
    }

    @Test
    @DisplayName("IBAN Maroc (28 chars) — groupes de 4 parfaits")
    void moroccanIban() {
        assertThat(IbanMasker.mask("MA64011519000001205000534921"))
            .isEqualTo("MA64 **** **** **** **** **** 4921");
    }

    @Test
    @DisplayName("IBAN Arabie Saoudite (24 chars) — multiple de 4")
    void saudiIban() {
        assertThat(IbanMasker.mask("SA0380000000608010167519"))
            .isEqualTo("SA03 **** **** **** **** 7519");
    }

    @Test
    @DisplayName("IBAN Allemagne (22 chars) — dernier groupe de milieu = 2 chars")
    void germanIban() {
        assertThat(IbanMasker.mask("DE89370400440532013000"))
            .isEqualTo("DE89 **** **** **** ** 3000");
    }

    @Test
    @DisplayName("Code pays + chiffres de contrôle (4 premiers) toujours visibles")
    void prefixAlwaysVisible() {
        assertThat(IbanMasker.mask("FR7612345678901234567890189")).startsWith("FR76 ");
        assertThat(IbanMasker.mask("MA64011519000001205000534921")).startsWith("MA64 ");
    }

    @Test
    @DisplayName("Suffixe (4 derniers chars) toujours intact et identifiable")
    void suffixAlwaysIntact() {
        assertThat(IbanMasker.mask("FR7612345678901234567890189")).endsWith(" 0189");
        assertThat(IbanMasker.mask("MA64011519000001205000534921")).endsWith(" 4921");
    }

    @Test
    @DisplayName("IBAN très court (< 8 chars) — fallback ****XXXX")
    void shortIban_fallback() {
        // 7 chars : pas assez pour le format complet (4 prefix + 0 middle + 4 suffix = 8 minimum)
        assertThat(IbanMasker.mask("FR7123")).isEqualTo("****7123");
    }

    @Test
    @DisplayName("Null input → null output")
    void nullInput_returnsNull() {
        assertThat(IbanMasker.mask(null)).isNull();
    }

    @Test
    @DisplayName("IBAN trop court (< 4 chars) → null")
    void tooShort_returnsNull() {
        assertThat(IbanMasker.mask("FR7")).isNull();
        assertThat(IbanMasker.mask("")).isNull();
    }

    @Test
    @DisplayName("Le mask contient au moins un * (détection frontend ibanUnchanged)")
    void maskContainsAsterisks() {
        assertThat(IbanMasker.mask("FR7612345678901234567890189")).contains("*");
        assertThat(IbanMasker.mask("MA64011519000001205000534921")).contains("*");
    }
}
