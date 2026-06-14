package com.clenzy.service;

import com.clenzy.model.CancellationPolicyType;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;

/**
 * Calcule le remboursement applicable a l'annulation d'une reservation directe, selon la politique
 * d'annulation configuree : preset Airbnb-like (FLEXIBLE/MODERATE/FIRM/STRICT/SUPER_STRICT/
 * NON_REFUNDABLE) ou regles CUSTOM parametrables (paliers {@code daysBeforeCheckIn -> refundPercentage}).
 *
 * <p>Moteur <b>pur</b>, sans dependance Spring/JPA, entierement testable unitairement.</p>
 *
 * <p>Invariants metier :
 * <ul>
 *   <li>Le delai avant arrivee est mesure dans la <b>timezone de la propriete</b>, jamais la zone JVM
 *       (regle dates #9). Repli documente {@code Europe/Paris}.</li>
 *   <li>Montants en {@link BigDecimal} : arrondi explicite {@link RoundingMode#HALF_UP}, comparaisons
 *       via {@code compareTo} (regle #10).</li>
 * </ul>
 */
@Component
public class CancellationRefundCalculator {

    /** Heure d'arrivee de reference si la propriete ne precise pas de check-in time. */
    private static final LocalTime DEFAULT_CHECK_IN_TIME = LocalTime.of(15, 0);
    private static final ZoneId FALLBACK_ZONE = ZoneId.of("Europe/Paris");

    public record Input(
            BigDecimal totalPrice,
            LocalDate checkIn,
            String checkInTime,        // "HH:mm" ou null
            String propertyTimezone,   // IANA ou null
            Instant cancellationInstant,
            CancellationPolicyType policyType,
            List<Map<String, Object>> customRules
    ) {}

    public record Result(
            int refundPercentage,
            BigDecimal refundAmount,
            BigDecimal nonRefundableAmount,
            long daysBeforeCheckIn,
            CancellationPolicyType policyType,
            String explanation
    ) {}

    public Result compute(Input in) {
        CancellationPolicyType type = in.policyType() != null ? in.policyType() : CancellationPolicyType.FLEXIBLE;
        long days = daysBeforeCheckIn(in);
        int pct = refundPercentage(type, days, in.customRules());

        BigDecimal total = (in.totalPrice() != null ? in.totalPrice() : BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal refund = total
                .multiply(BigDecimal.valueOf(pct))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal nonRefundable = total.subtract(refund);

        return new Result(pct, refund, nonRefundable, days, type, explanation(type, days, pct));
    }

    private long daysBeforeCheckIn(Input in) {
        if (in.checkIn() == null) {
            return 0;
        }
        ZoneId zone = resolveZone(in.propertyTimezone());
        ZonedDateTime checkInAt = in.checkIn().atTime(parseTime(in.checkInTime())).atZone(zone);
        Instant cancel = in.cancellationInstant() != null ? in.cancellationInstant() : Instant.EPOCH;
        ZonedDateTime cancelAt = cancel.atZone(zone);
        if (!cancelAt.isBefore(checkInAt)) {
            return 0; // annulation le jour J ou apres : aucun preavis
        }
        return Duration.between(cancelAt, checkInAt).toHours() / 24;
    }

    private int refundPercentage(CancellationPolicyType type, long days, List<Map<String, Object>> customRules) {
        return switch (type) {
            case FLEXIBLE -> days >= 1 ? 100 : 0;
            case MODERATE -> days >= 5 ? 100 : 50;
            case FIRM -> days >= 30 ? 100 : (days >= 7 ? 50 : 0);
            case STRICT -> days >= 7 ? 50 : 0;
            case SUPER_STRICT -> days >= 30 ? 50 : 0;
            case NON_REFUNDABLE -> 0;
            case CUSTOM -> customRefund(days, customRules);
        };
    }

    /**
     * Regles parametrables : chaque palier porte un seuil {@code daysBeforeCheckIn} et un
     * {@code refundPercentage}. On retient le palier le plus exigeant (plus grand seuil) que le
     * preavis satisfait. Aucun palier satisfait -&gt; 0%.
     */
    private int customRefund(long days, List<Map<String, Object>> rules) {
        if (rules == null || rules.isEmpty()) {
            return 0;
        }
        int best = 0;
        long bestThreshold = -1;
        for (Map<String, Object> rule : rules) {
            if (rule == null) continue;
            Long threshold = readLong(rule, "daysBeforeCheckIn", "days_before", "daysBefore", "days");
            Integer pct = readInt(rule, "refundPercentage", "refund_percentage", "percentage", "percent");
            if (threshold == null || pct == null) continue;
            if (days >= threshold && threshold > bestThreshold) {
                bestThreshold = threshold;
                best = clampPct(pct);
            }
        }
        return best;
    }

    private String explanation(CancellationPolicyType type, long days, int pct) {
        return "Politique " + type.name() + " : remboursement " + pct + "% (preavis de " + days + " jour(s) avant l'arrivee).";
    }

    private ZoneId resolveZone(String tz) {
        if (tz == null || tz.isBlank()) {
            return FALLBACK_ZONE;
        }
        try {
            return ZoneId.of(tz);
        } catch (Exception e) {
            return FALLBACK_ZONE;
        }
    }

    private LocalTime parseTime(String checkInTime) {
        if (checkInTime == null || checkInTime.isBlank()) {
            return DEFAULT_CHECK_IN_TIME;
        }
        try {
            return LocalTime.parse(checkInTime.trim());
        } catch (DateTimeParseException e) {
            return DEFAULT_CHECK_IN_TIME;
        }
    }

    private int clampPct(int pct) {
        return Math.max(0, Math.min(100, pct));
    }

    private Long readLong(Map<String, Object> rule, String... keys) {
        for (String key : keys) {
            Object v = rule.get(key);
            if (v instanceof Number n) return n.longValue();
            if (v instanceof String s && !s.isBlank()) {
                try {
                    return Long.parseLong(s.trim());
                } catch (NumberFormatException ignored) {
                    // palier illisible : ignore
                }
            }
        }
        return null;
    }

    private Integer readInt(Map<String, Object> rule, String... keys) {
        for (String key : keys) {
            Object v = rule.get(key);
            if (v instanceof Number n) return n.intValue();
            if (v instanceof String s && !s.isBlank()) {
                try {
                    return Integer.parseInt(s.trim());
                } catch (NumberFormatException ignored) {
                    // pourcentage illisible : ignore
                }
            }
        }
        return null;
    }
}
