package com.clenzy.service.tags;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Formats partages par les resolveurs de tags.
 * <p>
 * - Dates : dd/MM/yyyy ou dd/MM/yyyy HH:mm
 * - Montants : #,##0.00 € (style FR, symbole selon devise)
 * <p>
 * Extrait de TagResolverService (T-SOLID-5) — rendu strictement identique.
 */
public final class TagFormatting {

    public static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    public static final DateTimeFormatter DATETIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private TagFormatting() { /* util class */ }

    public static String safeStr(String value) {
        return value != null ? value : "";
    }

    public static String formatDate(LocalDateTime dateTime) {
        if (dateTime == null) return "";
        return dateTime.format(DATE_FORMAT);
    }

    public static String formatDateTime(LocalDateTime dateTime) {
        if (dateTime == null) return "";
        return dateTime.format(DATETIME_FORMAT);
    }

    public static String formatMoney(BigDecimal amount) {
        return formatMoney(amount, "EUR");
    }

    public static String formatMoney(BigDecimal amount, String currency) {
        if (amount == null) return "0,00 €";
        String symbol = switch (currency != null ? currency.toUpperCase() : "EUR") {
            case "MAD" -> "MAD";
            case "SAR" -> "SAR";
            case "USD" -> "$";
            case "GBP" -> "£";
            default -> "€";
        };
        String formatted = String.format("%,.2f", amount).replace(",", " ").replace(".", ",");
        return formatted + " " + symbol;
    }
}
