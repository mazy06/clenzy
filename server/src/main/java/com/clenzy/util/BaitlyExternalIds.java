package com.clenzy.util;

import java.math.BigDecimal;

/** Identifiants externes structurels : aucune conversion arbitraire de payload en identifiant. */
public final class BaitlyExternalIds {
    private BaitlyExternalIds() {}
    public static String require(Object value, int maximumLength) {
        if (maximumLength <= 0) throw invalid();
        if (value instanceof Number number) {
            try {
                var id = new BigDecimal(number.toString()).toBigIntegerExact();
                if (id.signum() <= 0 || id.toString().length() > maximumLength) throw invalid();
                return id.toString();
            } catch (NumberFormatException | ArithmeticException ignored) {throw invalid();}
        }
        if (value instanceof String text && !text.isEmpty() && text.length() <= maximumLength
                && text.matches("[A-Za-z0-9_-]+") && !text.matches("-[0-9]+")
                && !text.matches("0+") && !text.equalsIgnoreCase("null") && !text.equalsIgnoreCase("undefined")
                && !text.equalsIgnoreCase("NaN") && !text.equalsIgnoreCase("Infinity")) return text;
        throw invalid();
    }
    private static IllegalArgumentException invalid() {return new IllegalArgumentException("Identifiant externe invalide");}
}
