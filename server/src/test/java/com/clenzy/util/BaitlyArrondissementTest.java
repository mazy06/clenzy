package com.clenzy.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvFileSource;
import static org.assertj.core.api.Assertions.*;

class BaitlyArrondissementTest {
    @ParameterizedTest
    @CsvFileSource(resources="/geo/baitly-arrondissement-cases.csv",numLinesToSkip=1,nullValues="NULL")
    void normalizesTheSameCasesAsPostgres(String country,String department,String input,String expected) {
        assertThat(BaitlyArrondissement.normalize(country,department,input)).isEqualTo(expected);
    }

    @Test void savingRejectsAnInvalidArrondissementInsteadOfErasingItsRestriction() {
        assertThatThrownBy(()->BaitlyArrondissement.requireValid("FR","75","21e"))
            .isInstanceOf(IllegalArgumentException.class);
        assertThat(BaitlyArrondissement.requireValid("FR","75"," 10e ")).isEqualTo("75110");
    }
}
