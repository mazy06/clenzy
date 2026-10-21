package com.clenzy.service;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class BaitlyCrmIdentityTest {
    @Test void normalizesWithoutGuessingAliasesOrCountries() {
        assertThat(BaitlyCrmIdentity.email(" Alice+host@Example.COM ")).isEqualTo("alice+host@example.com");
        assertThat(BaitlyCrmIdentity.phone("00 33 6 12 34 56 78")).isEqualTo("33612345678");
        assertThat(BaitlyCrmIdentity.phone("06 12 34 56 78")).isEqualTo("0612345678");
        assertThat(BaitlyCrmIdentity.phone("+212 600 123 456")).isEqualTo("212600123456");
    }
    @Test void validatesCoordinatesAndAllowsExplicitClearing() {
        assertThatThrownBy(()->BaitlyCrmIdentity.email("bad-address")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->BaitlyCrmIdentity.phone("abc1234567")).isInstanceOf(IllegalArgumentException.class);
        assertThat(BaitlyCrmIdentity.email(" ")).isNull();
    }
}
