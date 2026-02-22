package com.clenzy.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class StringUtilsTest {

    // ── firstNonBlank ────────────────────────────────────────────────────────

    @Test
    void whenFirstValueIsValid_thenReturnsFirst() {
        assertThat(StringUtils.firstNonBlank("hello", "world")).isEqualTo("hello");
    }

    @Test
    void whenFirstIsNull_thenReturnsSecond() {
        assertThat(StringUtils.firstNonBlank(null, "world")).isEqualTo("world");
    }

    @Test
    void whenFirstIsBlank_thenReturnsSecond() {
        assertThat(StringUtils.firstNonBlank("", "world")).isEqualTo("world");
    }

    @Test
    void whenFirstIsWhitespaceOnly_thenReturnsSecond() {
        assertThat(StringUtils.firstNonBlank("   ", "world")).isEqualTo("world");
    }

    @Test
    void whenAllValuesAreNull_thenReturnsEmpty() {
        assertThat(StringUtils.firstNonBlank(null, null, null)).isEmpty();
    }

    @Test
    void whenAllValuesAreBlank_thenReturnsEmpty() {
        assertThat(StringUtils.firstNonBlank("", "   ", "\t")).isEmpty();
    }

    @Test
    void whenValueHasSurroundingWhitespace_thenReturnsTrimmed() {
        assertThat(StringUtils.firstNonBlank("  hello  ")).isEqualTo("hello");
    }

    // ── sanitizeFileName ─────────────────────────────────────────────────────

    @Test
    void whenFileNameIsNormal_thenReturnsUnchanged() {
        assertThat(StringUtils.sanitizeFileName("document.pdf")).isEqualTo("document.pdf");
    }

    @Test
    void whenFileNameContainsForwardSlashPath_thenStripsPath() {
        assertThat(StringUtils.sanitizeFileName("/home/user/file.txt")).isEqualTo("file.txt");
    }

    @Test
    void whenFileNameContainsBackslashPath_thenStripsPath() {
        assertThat(StringUtils.sanitizeFileName("C:\\Users\\test\\file.txt")).isEqualTo("file.txt");
    }

    @Test
    void whenFileNameContainsPathTraversal_thenStripsPath() {
        assertThat(StringUtils.sanitizeFileName("../../etc/passwd")).isEqualTo("passwd");
    }

    @Test
    void whenFileNameIsNull_thenReturnsAttachment() {
        assertThat(StringUtils.sanitizeFileName(null)).isEqualTo("attachment");
    }

    @Test
    void whenFileNameIsBlank_thenReturnsAttachment() {
        assertThat(StringUtils.sanitizeFileName("")).isEqualTo("attachment");
    }

    @Test
    void whenFileNameContainsNewlines_thenReplacedWithUnderscore() {
        assertThat(StringUtils.sanitizeFileName("file\nname.txt")).isEqualTo("file_name.txt");
    }

    // ── escapeHtml ───────────────────────────────────────────────────────────

    @Test
    void whenInputIsNull_thenReturnsEmpty() {
        assertThat(StringUtils.escapeHtml(null)).isEmpty();
    }

    @Test
    void whenInputContainsAllSpecialChars_thenAllAreEscaped() {
        String input = "&<>\"'";
        assertThat(StringUtils.escapeHtml(input))
                .isEqualTo("&amp;&lt;&gt;&quot;&#39;");
    }

    @Test
    void whenInputIsNormalText_thenReturnsUnchanged() {
        assertThat(StringUtils.escapeHtml("Hello World 123")).isEqualTo("Hello World 123");
    }

    @Test
    void whenInputContainsScriptTag_thenEscaped() {
        String input = "<script>alert('xss')</script>";
        String escaped = StringUtils.escapeHtml(input);
        assertThat(escaped).doesNotContain("<").doesNotContain(">");
        assertThat(escaped).isEqualTo("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
    }

    // ── computeEmailHash ─────────────────────────────────────────────────────

    @Test
    void whenEmailIsValid_thenReturnsConsistentHash() {
        String hash1 = StringUtils.computeEmailHash("user@example.com");
        String hash2 = StringUtils.computeEmailHash("user@example.com");
        assertThat(hash1).isEqualTo(hash2);
        assertThat(hash1).hasSize(64); // SHA-256 = 64 hex chars
    }

    @Test
    void whenEmailsDifferOnlyByCase_thenSameHash() {
        String lower = StringUtils.computeEmailHash("user@example.com");
        String upper = StringUtils.computeEmailHash("USER@EXAMPLE.COM");
        String mixed = StringUtils.computeEmailHash("User@Example.COM");
        assertThat(lower).isEqualTo(upper).isEqualTo(mixed);
    }

    @Test
    void whenEmailHasSurroundingWhitespace_thenSameHashAsTrimmed() {
        String trimmed = StringUtils.computeEmailHash("user@example.com");
        String padded = StringUtils.computeEmailHash("  user@example.com  ");
        assertThat(padded).isEqualTo(trimmed);
    }

    @Test
    void whenEmailsAreDifferent_thenDifferentHashes() {
        String hash1 = StringUtils.computeEmailHash("alice@example.com");
        String hash2 = StringUtils.computeEmailHash("bob@example.com");
        assertThat(hash1).isNotEqualTo(hash2);
    }
}
