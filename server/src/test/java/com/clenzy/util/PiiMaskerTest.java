package com.clenzy.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PiiMaskerTest {

    // ----- maskEmail -----

    @Test
    void whenStandardEmail_thenLocalPartMaskedDomainKept() {
        assertThat(PiiMasker.maskEmail("toufik@domaine.fr")).isEqualTo("t***@domaine.fr");
    }

    @Test
    void whenSingleCharLocalPart_thenStillMasked() {
        assertThat(PiiMasker.maskEmail("a@x.com")).isEqualTo("a***@x.com");
    }

    @Test
    void whenEmailNullOrBlank_thenFullyMasked() {
        assertThat(PiiMasker.maskEmail(null)).isEqualTo("***");
        assertThat(PiiMasker.maskEmail("  ")).isEqualTo("***");
    }

    @Test
    void whenNoLocalPart_thenFullyMasked() {
        assertThat(PiiMasker.maskEmail("@domaine.fr")).isEqualTo("***");
        assertThat(PiiMasker.maskEmail("pas-un-email")).isEqualTo("***");
    }

    // ----- maskName -----

    @Test
    void whenFullName_thenReducedToInitials() {
        assertThat(PiiMasker.maskName("Jean Dupont")).isEqualTo("J.D.");
    }

    @Test
    void whenCompoundName_thenEachPartReduced() {
        assertThat(PiiMasker.maskName("jean-pierre  martin")).isEqualTo("J.P.M.");
    }

    @Test
    void whenSingleName_thenSingleInitial() {
        assertThat(PiiMasker.maskName("Madonna")).isEqualTo("M.");
    }

    @Test
    void whenNameNullOrBlank_thenFullyMasked() {
        assertThat(PiiMasker.maskName(null)).isEqualTo("***");
        assertThat(PiiMasker.maskName("   ")).isEqualTo("***");
    }
}
