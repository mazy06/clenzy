package com.clenzy.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class StringUtilsTest {

    // --- firstNonBlank ---

    @Test
    void firstNonBlank_firstValueValid_returnsFirst() {
        assertEquals("hello", StringUtils.firstNonBlank("hello", "world"));
    }

    @Test
    void firstNonBlank_nullFirst_validSecond_returnsSecond() {
        assertEquals("world", StringUtils.firstNonBlank(null, "world"));
    }

    @Test
    void firstNonBlank_blankFirst_validSecond_returnsSecond() {
        assertEquals("world", StringUtils.firstNonBlank("", "world"));
    }

    @Test
    void firstNonBlank_allNull_returnsEmpty() {
        assertEquals("", StringUtils.firstNonBlank(null, null, null));
    }

    @Test
    void firstNonBlank_trimsWhitespace() {
        assertEquals("hello", StringUtils.firstNonBlank("  hello  "));
    }

    @Test
    void firstNonBlank_whitespaceOnlyFirst_validSecond_returnsSecond() {
        assertEquals("world", StringUtils.firstNonBlank("   ", "world"));
    }

    // --- sanitizeFileName ---

    @Test
    void sanitizeFileName_normalName_unchanged() {
        assertEquals("document.pdf", StringUtils.sanitizeFileName("document.pdf"));
    }

    @Test
    void sanitizeFileName_withForwardSlashPath_stripsPath() {
        assertEquals("file.txt", StringUtils.sanitizeFileName("/home/user/file.txt"));
    }

    @Test
    void sanitizeFileName_withBackslashPath_stripsPath() {
        assertEquals("file.txt", StringUtils.sanitizeFileName("C:\\Users\\test\\file.txt"));
    }

    @Test
    void sanitizeFileName_null_returnsAttachment() {
        assertEquals("attachment", StringUtils.sanitizeFileName(null));
    }

    @Test
    void sanitizeFileName_blank_returnsAttachment() {
        assertEquals("attachment", StringUtils.sanitizeFileName(""));
    }

    // --- escapeHtml ---

    @Test
    void escapeHtml_null_returnsEmpty() {
        assertEquals("", StringUtils.escapeHtml(null));
    }

    @Test
    void escapeHtml_allSpecialChars_properlyEscaped() {
        String input = "A & B < C > D \" E ' F";
        String expected = "A &amp; B &lt; C &gt; D &quot; E &#39; F";
        assertEquals(expected, StringUtils.escapeHtml(input));
    }

    @Test
    void escapeHtml_normalText_unchanged() {
        assertEquals("Hello World", StringUtils.escapeHtml("Hello World"));
    }
}
