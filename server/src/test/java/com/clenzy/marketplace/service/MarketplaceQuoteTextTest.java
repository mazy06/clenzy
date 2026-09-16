package com.clenzy.marketplace.service;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class MarketplaceQuoteTextTest {
    @Test void preservesMaximumLengthAndUnicodeWithoutTruncation() {
        String message = "éع".repeat(2000);
        assertThat(MarketplaceQuoteText.optional(message, 4000, "Message")).isEqualTo(message);
        assertThatThrownBy(() -> MarketplaceQuoteText.optional(message + "a", 4000, "Message"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test void trimsOptionalValuesAndKeepsTheHttpLengthLimit() {
        assertThat(MarketplaceQuoteText.optional(null, 5, "Texte")).isNull();
        assertThat(MarketplaceQuoteText.optional("  ", 5, "Texte")).isNull();
        assertThat(MarketplaceQuoteText.optional(" abc ", 5, "Texte")).isEqualTo("abc");
        assertThatThrownBy(() -> MarketplaceQuoteText.optional(" abc  ", 5, "Texte"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
