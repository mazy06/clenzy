package com.clenzy.service.report;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Formatage des valeurs d'un rapport.
 *
 * <p>Source UNIQUE : le snapshot porte des chaines deja formatees, et elles
 * sortent toutes d'ici. C'est ce qui garantit que l'ecran, le PDF et le
 * commentaire de l'agent affichent rigoureusement le meme texte — un montant
 * arrondi differemment entre l'apercu et la piece envoyee est une reclamation
 * client, pas un detail cosmetique.</p>
 */
public final class ReportFormats {

    /** Les conciergeries cibles sont francaises ; le rapport est en francais. */
    private static final Locale FR = Locale.FRANCE;

    public static final DateTimeFormatter LONG_DATE = DateTimeFormatter.ofPattern("d MMMM yyyy", FR);
    public static final DateTimeFormatter SHORT_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy", FR);
    public static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("MMM yy", FR);

    private ReportFormats() {
    }

    /** Montant avec devise, deux decimales. */
    public static String money(BigDecimal value, String currency) {
        final NumberFormat format = NumberFormat.getNumberInstance(FR);
        format.setMinimumFractionDigits(2);
        format.setMaximumFractionDigits(2);
        return format.format(nz(value)) + " " + symbol(currency);
    }

    /**
     * Montant abrege, pour les graduations d'axe.
     *
     * <p>« 12 000,00 € » demande une gouttiere de 70 px qu'un axe n'a pas : le
     * libelle y serait rogne. Les infobulles et les tableaux gardent le montant
     * exact.</p>
     */
    public static String moneyCompact(BigDecimal value, String currency) {
        final BigDecimal amount = nz(value);
        final BigDecimal abs = amount.abs();
        if (abs.compareTo(BigDecimal.valueOf(1_000_000)) >= 0) {
            return trim(amount.divide(BigDecimal.valueOf(1_000_000), 1, RoundingMode.HALF_UP)) + " M" + symbol(currency);
        }
        if (abs.compareTo(BigDecimal.valueOf(1_000)) >= 0) {
            return trim(amount.divide(BigDecimal.valueOf(1_000), 1, RoundingMode.HALF_UP)) + " k" + symbol(currency);
        }
        return trim(amount.setScale(0, RoundingMode.HALF_UP)) + " " + symbol(currency);
    }

    /** Taux en pourcentage, une decimale. */
    public static String percent(BigDecimal value) {
        return trim(nz(value).setScale(1, RoundingMode.HALF_UP)) + " %";
    }

    /** Ecart signe, une decimale — le signe porte l'information, il ne s'omet pas. */
    public static String signedPercent(BigDecimal value) {
        if (value == null) {
            return "—";
        }
        final BigDecimal rounded = value.setScale(1, RoundingMode.HALF_UP);
        return (rounded.signum() > 0 ? "+" : "") + trim(rounded) + " %";
    }

    public static String count(long value) {
        return NumberFormat.getIntegerInstance(FR).format(value);
    }

    public static String decimal(BigDecimal value, int scale) {
        return trim(nz(value).setScale(scale, RoundingMode.HALF_UP));
    }

    /** Periode en toutes lettres, pour la page de garde. */
    public static String period(LocalDate from, LocalDate to) {
        return "du " + LONG_DATE.format(from) + " au " + LONG_DATE.format(to);
    }

    /**
     * Variation relative entre deux valeurs, en pourcentage.
     *
     * <p>{@code null} quand la reference est nulle : « +infini » n'est pas une
     * information, et « +100 % » sur une base de zero est un mensonge. Mieux
     * vaut un tiret qu'un chiffre indefendable.</p>
     */
    public static BigDecimal growth(BigDecimal current, BigDecimal previous) {
        if (previous == null || previous.signum() == 0) {
            return null;
        }
        return nz(current).subtract(previous)
                .multiply(BigDecimal.valueOf(100))
                .divide(previous.abs(), 1, RoundingMode.HALF_UP);
    }

    public static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static String symbol(String currency) {
        if (currency == null) {
            return "€";
        }
        return switch (currency.toUpperCase(Locale.ROOT)) {
            case "EUR" -> "€";
            case "USD" -> "$";
            case "GBP" -> "£";
            case "MAD" -> "MAD";
            default -> currency.toUpperCase(Locale.ROOT);
        };
    }

    /** Retire les decimales inutiles : « 12,0 k€ » se lit « 12 k€ ». */
    private static String trim(BigDecimal value) {
        final BigDecimal stripped = value.stripTrailingZeros();
        final NumberFormat format = NumberFormat.getNumberInstance(FR);
        format.setMaximumFractionDigits(Math.max(0, stripped.scale()));
        return format.format(stripped);
    }
}
