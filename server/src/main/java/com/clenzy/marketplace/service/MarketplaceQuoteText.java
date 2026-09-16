package com.clenzy.marketplace.service;

/** Limites textuelles du parcours de devis Baitly, communes aux appels HTTP et internes. */
final class MarketplaceQuoteText {
    private MarketplaceQuoteText() {}

    static String optional(String value, int maximum, String label) {
        if (value == null) return null;
        if (value.length() > maximum) {
            throw new IllegalArgumentException(label + " : " + maximum + " caractères maximum.");
        }
        String cleaned = value.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }
}
