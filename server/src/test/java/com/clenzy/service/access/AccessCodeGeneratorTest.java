package com.clenzy.service.access;

import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AccessCodeGeneratorTest {

    private final AccessCodeGenerator gen = new AccessCodeGenerator();

    @RepeatedTest(30)
    void respectsPatternAndPools() {
        String fmt = "{\"pattern\":[\"digits\",\"digits\",\"letters\",\"symbols\"],"
                + "\"letters\":[\"A\",\"B\"],\"symbols\":[\"#\"]}";
        String code = gen.generate(fmt, null);
        assertThat(code).hasSize(4);
        assertThat(code.charAt(0)).isBetween('0', '9');
        assertThat(code.charAt(1)).isBetween('0', '9');
        assertThat(code.charAt(2)).isIn('A', 'B');     // uniquement les lettres choisies
        assertThat(code.charAt(3)).isEqualTo('#');     // uniquement le symbole choisi
    }

    @Test
    void digitsOnly() {
        String code = gen.generate("{\"pattern\":[\"digits\",\"digits\",\"digits\",\"digits\"]}", null);
        assertThat(code).hasSize(4).matches("\\d{4}");
    }

    @RepeatedTest(20)
    void infersPatternFromCurrentCodeWhenNoFormat() {
        String code = gen.generate(null, "AB12#");
        assertThat(code).hasSize(5);
        assertThat(Character.isLetter(code.charAt(0))).isTrue();
        assertThat(Character.isLetter(code.charAt(1))).isTrue();
        assertThat(Character.isDigit(code.charAt(2))).isTrue();
        assertThat(Character.isDigit(code.charAt(3))).isTrue();
        assertThat(Character.isLetterOrDigit(code.charAt(4))).isFalse(); // position symbole
    }

    @Test
    void returnsNullWhenNoFormatNorCode() {
        assertThat(gen.generate(null, null)).isNull();
        assertThat(gen.generate("", "")).isNull();
    }
}
