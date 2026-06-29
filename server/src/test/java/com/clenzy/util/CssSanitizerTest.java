package com.clenzy.util;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CssSanitizerTest {

    // ----- isValidVarName -----

    @Test
    void whenCanonicalToken_thenNameValid() {
        assertThat(CssSanitizer.isValidVarName("--bt-color-primary")).isTrue();
        assertThat(CssSanitizer.isValidVarName("--bt-radius-md")).isTrue();
    }

    @Test
    void whenNameUppercaseOrNoDashesOrLeadingDigit_thenInvalid() {
        assertThat(CssSanitizer.isValidVarName("--BT-x")).isFalse();
        assertThat(CssSanitizer.isValidVarName("color")).isFalse();
        assertThat(CssSanitizer.isValidVarName("--")).isFalse();
        assertThat(CssSanitizer.isValidVarName("--1abc")).isFalse();
        assertThat(CssSanitizer.isValidVarName(null)).isFalse();
    }

    // ----- isValidVarValue -----

    @Test
    void whenSafeDesignValue_thenValueValid() {
        assertThat(CssSanitizer.isValidVarValue("#2563eb")).isTrue();
        assertThat(CssSanitizer.isValidVarValue("16px")).isTrue();
        assertThat(CssSanitizer.isValidVarValue("\"Manrope\", system-ui, sans-serif")).isTrue();
        assertThat(CssSanitizer.isValidVarValue("0 6px 20px rgba(0,0,0,.08)")).isTrue();
        assertThat(CssSanitizer.isValidVarValue("0 1px 2px rgba(0,0,0,.05), 0 4px 12px rgba(0,0,0,.1)")).isTrue();
    }

    @Test
    void whenValueHasInjectionFragments_thenInvalid() {
        assertThat(CssSanitizer.isValidVarValue("url(javascript:alert(1))")).isFalse();
        assertThat(CssSanitizer.isValidVarValue("red}html{background:red")).isFalse();
        assertThat(CssSanitizer.isValidVarValue("a; color: red")).isFalse();
        assertThat(CssSanitizer.isValidVarValue("@import 'x'")).isFalse();
        assertThat(CssSanitizer.isValidVarValue("expression(alert(1))")).isFalse();
        assertThat(CssSanitizer.isValidVarValue("</style>")).isFalse();
        assertThat(CssSanitizer.isValidVarValue("url(/img.png)")).isFalse();
        assertThat(CssSanitizer.isValidVarValue("")).isFalse();
        assertThat(CssSanitizer.isValidVarValue("x".repeat(201))).isFalse();
        assertThat(CssSanitizer.isValidVarValue(null)).isFalse();
    }

    // ----- sanitizeVarMap -----

    @Test
    void whenMixedMap_thenOnlySafePairsKeptInOrder() {
        Map<String, String> in = new LinkedHashMap<>();
        in.put("--bt-color-primary", "#2563eb");
        in.put("--BT-bad", "#fff");                 // nom invalide
        in.put("--bt-evil", "red}body{x");          // valeur invalide
        in.put("--bt-radius-md", "12px");
        Map<String, String> out = CssSanitizer.sanitizeVarMap(in);
        assertThat(out).containsExactly(
            Map.entry("--bt-color-primary", "#2563eb"),
            Map.entry("--bt-radius-md", "12px"));
    }

    @Test
    void whenNullMap_thenEmpty() {
        assertThat(CssSanitizer.sanitizeVarMap(null)).isEmpty();
    }

    // ----- sanitizeCss -----

    @Test
    void whenCssHasImportOrDangerousUrl_thenNeutralized() {
        String css = "@import url('//evil');.a{background:url(javascript:alert(1));color:red}";
        String out = CssSanitizer.sanitizeCss(css);
        assertThat(out).doesNotContain("@import");
        assertThat(out).doesNotContain("javascript:");
        assertThat(out).contains("color:red");
    }

    @Test
    void whenPlainCss_thenPreserved() {
        String css = ".site-root{--bt-color-primary:#2563eb}.cb-cta{border-radius:var(--bt-radius-button,999px)}";
        assertThat(CssSanitizer.sanitizeCss(css)).isEqualTo(css);
    }
}
