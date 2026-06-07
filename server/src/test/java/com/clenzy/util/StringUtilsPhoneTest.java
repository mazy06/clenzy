package com.clenzy.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests de la normalisation E.164 + hash de numero (relais WhatsApp).
 * Point critique : un numero entrant Meta ("33612...") doit produire le MEME
 * hash que le numero stocke du guest, quel que soit son format ("+33...", "06...").
 */
class StringUtilsPhoneTest {

    @Test
    void normalizeE164_international_withPlus() {
        assertThat(StringUtils.normalizePhoneE164("+33612345678", null)).isEqualTo("+33612345678");
    }

    @Test
    void normalizeE164_national_withRegion() {
        assertThat(StringUtils.normalizePhoneE164("0612345678", "FR")).isEqualTo("+33612345678");
    }

    @Test
    void normalizeE164_internationalWithoutPlus_metaStyle() {
        assertThat(StringUtils.normalizePhoneE164("33612345678", null)).isEqualTo("+33612345678");
    }

    @Test
    void normalizeE164_withSpacesAndDashes() {
        assertThat(StringUtils.normalizePhoneE164("+33 6 12-34-56-78", null)).isEqualTo("+33612345678");
    }

    @Test
    void normalizeE164_invalid_returnsNull() {
        assertThat(StringUtils.normalizePhoneE164("not-a-number", null)).isNull();
    }

    @Test
    void normalizeE164_null_returnsNull() {
        assertThat(StringUtils.normalizePhoneE164(null, null)).isNull();
    }

    @Test
    void computePhoneHash_sameNumberDifferentFormats_sameHash() {
        String h1 = StringUtils.computePhoneHash("+33612345678", null);
        String h2 = StringUtils.computePhoneHash("0612345678", "FR");
        String h3 = StringUtils.computePhoneHash("33612345678", null); // format Meta
        assertThat(h1).isNotNull().hasSize(64);
        assertThat(h2).isEqualTo(h1);
        assertThat(h3).isEqualTo(h1);
    }

    @Test
    void computePhoneHash_invalid_returnsNull() {
        assertThat(StringUtils.computePhoneHash("xyz", null)).isNull();
    }
}
