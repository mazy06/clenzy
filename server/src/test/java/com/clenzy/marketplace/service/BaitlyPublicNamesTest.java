package com.clenzy.marketplace.service;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class BaitlyPublicNamesTest {
    @Test void hidesLastNameOnlyWhenSelected() {
        assertThat(BaitlyPublicNames.display("Toufik Mazy",true)).isEqualTo("Toufik M.");
        assertThat(BaitlyPublicNames.display("Toufik Mazy",false)).isEqualTo("Toufik Mazy");
    }
    @Test void handlesSpacingSingleNamesAndUnicode() {
        assertThat(BaitlyPublicNames.display("  Toufik   Mazy  ",true)).isEqualTo("Toufik M.");
        assertThat(BaitlyPublicNames.display("Toufik",true)).isEqualTo("Toufik");
        assertThat(BaitlyPublicNames.display("Zoé Évrard",true)).isEqualTo("Zoé É.");
        assertThat(BaitlyPublicNames.display(null,true)).isNull();
    }
}
