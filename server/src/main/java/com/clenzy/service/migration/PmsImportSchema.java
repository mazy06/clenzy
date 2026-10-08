package com.clenzy.service.migration;

import com.clenzy.service.migration.ImportPlan.Kind;
import java.math.*;
import java.text.Normalizer;
import java.time.*;
import java.time.format.*;
import java.util.*;

/** Shared schema for mapping, validation and materialization. No vendor is a trusted schema. */
public final class PmsImportSchema {
    private PmsImportSchema() {}
    public record Field(String key, boolean required, List<String> aliases) {}
    private static Field f(String key, boolean required, String... aliases) {
        return new Field(key, required, List.of(aliases));
    }
    public static final Map<Kind, List<Field>> FIELDS = Map.of(
        Kind.PROPERTY, List.of(
            f("sourceId", true, "id", "property id", "listing id", "rental id", "accommodation id"),
            f("name", true, "name", "property name", "listing name", "logement", "nom", "اسم العقار"),
            f("address", true, "address", "adresse", "العنوان"),
            f("bedrooms", true, "bedrooms", "bedroom count", "chambres"),
            f("bathrooms", true, "bathrooms", "bathroom count", "salles de bain"),
            f("timezone", true, "timezone", "time zone", "fuseau"),
            f("currency", true, "currency", "devise", "العملة"),
            f("type", true, "type", "property type"),
            f("city", false, "city", "ville"), f("countryCode", false, "country code"),
            f("description", false, "description")),
        Kind.GUEST, List.of(
            f("sourceId", true, "id", "guest id", "contact id", "customer id"),
            f("firstName", true, "first name", "firstname", "prénom", "guest.firstName", "full name", "guest name", "الاسم"),
            f("lastName", false, "last name", "lastname", "nom", "guest.lastName", "اسم العائلة"),
            f("email", false, "email", "email address", "guest.email"),
            f("phone", false, "phone", "phone number", "téléphone", "guest.phone"),
            f("countryCode", false, "country code"), f("language", false, "language", "langue"),
            f("notes", false, "notes", "comments")),
        Kind.RESERVATION, List.of(
            f("sourceId", true, "id", "booking id", "reservation id", "booking number", "confirmation code"),
            f("propertyRef", true, "property id", "listing id", "rental id", "accommodation id", "property name", "listing name", "logement"),
            f("guestName", true, "guest name", "full name", "customer name", "voyageur", "guest.name", "اسم الضيف"),
            f("guestRef", false, "guest id", "customer id", "contact id", "guest.id"),
            f("checkIn", true, "arrival", "arrival date", "check in", "checkin", "check-in date", "date arrivée", "تاريخ الوصول"),
            f("checkOut", true, "departure", "departure date", "check out", "checkout", "check-out date", "date départ", "تاريخ المغادرة"),
            f("totalPrice", true, "total", "total price", "total amount", "booking total", "montant total", "الإجمالي"),
            f("currency", true, "currency", "devise", "العملة"),
            f("status", true, "status", "booking status", "statut", "الحالة"),
            f("source", false, "channel", "source", "canal"),
            f("guestCount", false, "guests", "guest count", "persons", "voyageurs"),
            f("amountPaid", false, "amount paid", "paid amount", "montant payé"),
            f("confirmationCode", false, "confirmation code", "confirmation number", "reference"),
            f("notes", false, "notes", "comments"),
            f("cleaningFee", false, "cleaning fee", "frais de ménage", "frais de menage"),
            f("touristTax", false, "tourist tax", "city tax", "taxe de séjour", "taxe de sejour"),
            f("taxes", false, "taxes", "tax amount", "vat", "tva")),
        Kind.REVIEW, List.of(
            f("sourceId", true, "review id", "id"),
            f("propertyRef", true, "property id", "listing id", "rental id", "property name", "listing name", "logement"),
            f("rating", true, "rating", "overall rating", "stars", "note"),
            f("reviewDate", true, "review date", "date", "submitted at", "created at"),
            f("channel", false, "channel", "platform", "source", "canal"),
            f("guestName", false, "guest name", "reviewer", "reviewer name", "voyageur"),
            f("text", false, "review", "review text", "public review", "comment", "commentaire"),
            f("response", false, "response", "host response", "réponse")),
        Kind.RATE, List.of(
            f("propertyRef", true, "property id", "listing id", "rental id", "property name", "listing name", "logement"),
            f("date", true, "date", "night", "day", "jour"),
            f("price", true, "price", "rate", "nightly price", "nightly rate", "prix", "tarif"),
            f("currency", true, "currency", "devise")),
        Kind.TASK, List.of(
            f("sourceId", true, "task id", "id"),
            f("propertyRef", true, "property id", "listing id", "rental id", "property name", "listing name", "logement"),
            f("title", true, "title", "task", "name", "titre", "tâche"),
            f("date", true, "date", "due date", "scheduled date", "start date", "échéance"),
            f("type", false, "type", "task type", "category"),
            f("status", false, "status", "task status", "statut"),
            f("notes", false, "notes", "description", "comments")),
        Kind.ARCHIVE, List.of());

    /** Booking states that are not stays: counted and skipped, never an error that blocks the batch. */
    public static final String SKIPPED_STATUS = "skipped";

    public static ImportPlan suggest(ImportDocument document) {
        return suggest(document, null);
    }

    /** A vendor profile only adds column names to try first; every value is still validated here. */
    public static ImportPlan suggest(ImportDocument document, PmsVendorProfiles.Profile profile) {
        Kind kind = profile == null ? null : profile.kindFor(document);
        if (kind == null) {
            kind = Kind.ARCHIVE;
            if (document.attachmentBase64() == null) {
                if (matched(document, "checkIn", Kind.RESERVATION, profile) != null) kind = Kind.RESERVATION;
                else if (matched(document, "rating", Kind.REVIEW, profile) != null
                    && matched(document, "reviewDate", Kind.REVIEW, profile) != null) kind = Kind.REVIEW;
                else if (matched(document, "title", Kind.TASK, profile) != null
                    && matched(document, "date", Kind.TASK, profile) != null) kind = Kind.TASK;
                else if (matched(document, "price", Kind.RATE, profile) != null
                    && matched(document, "date", Kind.RATE, profile) != null) kind = Kind.RATE;
                else if (matched(document, "firstName", Kind.GUEST, profile) != null) kind = Kind.GUEST;
                else if (matched(document, "address", Kind.PROPERTY, profile) != null) kind = Kind.PROPERTY;
            }
        }
        Map<String, String> mappings = new LinkedHashMap<>();
        for (Field field : FIELDS.get(kind)) {
            String match = matched(document, field.key(), kind, profile);
            if (match != null) mappings.put(field.key(), match);
        }
        String dateFormat = profile == null ? "ISO" : profile.dateFormat();
        return new ImportPlan(document.id(), kind, mappings, Map.of(), Map.of(), dateFormat, ".");
    }

    private static String matched(ImportDocument doc, String key, Kind kind, PmsVendorProfiles.Profile profile) {
        if (profile != null) {
            for (String column : profile.columns(kind, key)) {
                String hit = doc.columns().stream().filter(c -> normalize(c).equals(normalize(column))).findFirst().orElse(null);
                if (hit != null) return hit;
            }
        }
        return matched(doc, key, kind);
    }

    private static String matched(ImportDocument doc, String key, Kind kind) {
        Field field = FIELDS.get(kind).stream().filter(f -> f.key().equals(key)).findFirst().orElseThrow();
        // A column named exactly after the field key (Baitly exports, API pulls) wins over looser aliases.
        List<String> exact = doc.columns().stream().filter(c -> normalize(c).equals(normalize(key))).toList();
        if (exact.size() == 1) return exact.getFirst();
        Set<String> names = new HashSet<>();
        names.add(normalize(key)); field.aliases().forEach(a -> names.add(normalize(a)));
        List<String> matches = doc.columns().stream().filter(c -> names.contains(normalize(c))).toList();
        return matches.size() == 1 ? matches.getFirst() : null;
    }

    static String normalize(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
            .toLowerCase(Locale.ROOT).replaceAll("[\\s_.-]", "");
    }

    public static Map<String, String> map(Map<String, String> row, ImportPlan plan) {
        Map<String, String> values = new TreeMap<>();
        for (Field field : FIELDS.get(plan.kind())) {
            String column = plan.fields().get(field.key());
            String value = column == null || column.isBlank() ? plan.defaults().getOrDefault(field.key(), "")
                : row.getOrDefault(column, "");
            value = value.trim();
            if (value.length() > maxLength(field.key())) throw error("TOO_LONG", field.key());
            values.put(field.key(), value);
        }
        if (plan.kind() == Kind.RESERVATION && !values.get("status").isBlank()
            && status(values.get("status")).equals(SKIPPED_STATUS)) {
            values.put("status", SKIPPED_STATUS);
            return values;
        }
        for (Field field : FIELDS.get(plan.kind()))
            if (field.required() && values.get(field.key()).isBlank()) throw error("REQUIRED", field.key());
        if (plan.kind() == Kind.ARCHIVE) return values;
        for (String reference : List.of("sourceId", "propertyRef", "guestRef")) {
            String value = values.get(reference);
            if (value != null && value.startsWith("'") && value.substring(1).matches("[0-9]+")) values.put(reference, value.substring(1));
        }
        if (plan.kind() == Kind.REVIEW) return review(values, plan);
        if (plan.kind() == Kind.RATE) return rate(values, plan);
        if (plan.kind() == Kind.TASK) return task(values, plan);
        if (plan.kind() == Kind.GUEST) {
            String email = values.get("email");
            if (!email.isEmpty() && !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw error("EMAIL", "email");
            if (!values.get("countryCode").isEmpty()) country(values);
        } else {
            String currency = values.get("currency").toUpperCase(Locale.ROOT);
            try { Currency.getInstance(currency); } catch (Exception e) { throw error("CURRENCY", "currency"); }
            values.put("currency", currency);
            if (plan.kind() == Kind.PROPERTY) {
                integer(values, "bedrooms", 0, 100); integer(values, "bathrooms", 0, 100);
                try { ZoneId.of(values.get("timezone")); } catch (Exception e) { throw error("TIMEZONE", "timezone"); }
                try { com.clenzy.model.PropertyType.valueOf(values.get("type").toUpperCase(Locale.ROOT)); }
                catch (Exception e) { throw error("PROPERTY_TYPE", "type"); }
                values.put("type", values.get("type").toUpperCase(Locale.ROOT));
                if (!values.get("countryCode").isEmpty()) country(values);
            } else {
                LocalDate start = date(values.get("checkIn"), plan.dateFormat());
                LocalDate end = date(values.get("checkOut"), plan.dateFormat());
                if (!end.isAfter(start) || end.isAfter(start.plusYears(3))) throw error("DATE_RANGE", "checkOut");
                values.put("checkIn", start.toString()); values.put("checkOut", end.toString());
                BigDecimal total = money(values.get("totalPrice"), plan.decimalSeparator());
                values.put("totalPrice", total.toPlainString());
                if (!values.get("amountPaid").isBlank()) {
                    BigDecimal paid = money(values.get("amountPaid"), plan.decimalSeparator());
                    if (paid.compareTo(total) > 0) throw error("PAID_ABOVE_TOTAL", "amountPaid");
                    values.put("amountPaid", paid.toPlainString());
                }
                if (!values.get("guestCount").isBlank()) integer(values, "guestCount", 1, 1000);
                values.put("status", status(values.get("status")));
                for (String fee : List.of("cleaningFee", "touristTax", "taxes"))
                    if (!values.get(fee).isBlank()) values.put(fee, money(values.get(fee), plan.decimalSeparator()).toPlainString());
                String source = values.get("source").toLowerCase(Locale.ROOT);
                values.put("source", switch (source) {
                    case "airbnb", "booking", "vrbo", "expedia", "direct", "other" -> source;
                    case "booking.com" -> "booking";
                    case "" -> "other";
                    default -> "other";
                });
            }
        }
        return values;
    }

    private static Map<String, String> review(Map<String, String> values, ImportPlan plan) {
        String rating = digits(values.get("rating")).replace(',', '.');
        try {
            BigDecimal number = new BigDecimal(rating);
            // 10-point scales (Booking.com) are halved; anything else outside 1..5 is refused.
            if (number.compareTo(BigDecimal.valueOf(5)) > 0 && number.compareTo(BigDecimal.TEN) <= 0)
                number = number.divide(BigDecimal.valueOf(2));
            int stars = number.setScale(0, RoundingMode.HALF_UP).intValueExact();
            if (stars < 1 || stars > 5) throw new ArithmeticException();
            values.put("rating", Integer.toString(stars));
        } catch (ArithmeticException | NumberFormatException e) { throw error("RATING", "rating"); }
        values.put("reviewDate", date(firstDay(values.get("reviewDate")), plan.dateFormat()).toString());
        values.put("channel", channel(values.get("channel")));
        return values;
    }

    private static Map<String, String> rate(Map<String, String> values, ImportPlan plan) {
        values.put("date", date(firstDay(values.get("date")), plan.dateFormat()).toString());
        BigDecimal price = money(values.get("price"), plan.decimalSeparator());
        if (price.signum() <= 0) throw error("MONEY", "price");
        values.put("price", price.toPlainString());
        currency(values);
        // A nightly rate has no identifier of its own: the property and the night are the identity.
        values.put("sourceId", values.get("propertyRef") + "@" + values.get("date"));
        return values;
    }

    private static Map<String, String> task(Map<String, String> values, ImportPlan plan) {
        values.put("date", date(firstDay(values.get("date")), plan.dateFormat()).toString());
        String type = normalize(values.get("type"));
        values.put("type", type.contains("clean") || type.contains("menage") || type.contains("turnover") ? "CLEANING"
            : type.contains("repair") || type.contains("maint") || type.contains("repar") ? "PREVENTIVE_MAINTENANCE"
            : "OTHER");
        String status = normalize(values.get("status"));
        values.put("status", Set.of("done", "completed", "complete", "finished", "termine", "fait").contains(status) ? "COMPLETED"
            : Set.of("cancelled", "canceled", "annule").contains(status) ? "CANCELLED" : "PENDING");
        return values;
    }

    /** Vendors often export datetimes; the stay or task day is the date part as written by the vendor. */
    private static String firstDay(String value) {
        String trimmed = value.trim();
        return trimmed.matches("\\d{4}-\\d{2}-\\d{2}[T ].*") ? trimmed.substring(0, 10) : trimmed;
    }

    private static String channel(String value) {
        String channel = normalize(value);
        if (channel.contains("airbnb")) return "AIRBNB";
        if (channel.contains("booking")) return "BOOKING";
        if (channel.contains("vrbo") || channel.contains("homeaway") || channel.contains("abritel")) return "VRBO";
        if (channel.contains("expedia")) return "EXPEDIA";
        if (channel.contains("google")) return "GOOGLE_VACATION_RENTALS";
        return "DIRECT";
    }

    private static void currency(Map<String, String> values) {
        String currency = values.get("currency").toUpperCase(Locale.ROOT);
        try { Currency.getInstance(currency); } catch (Exception e) { throw error("CURRENCY", "currency"); }
        values.put("currency", currency);
    }

    private static void country(Map<String, String> values) {
        if (!values.get("countryCode").matches("[A-Za-z]{2}")) throw error("COUNTRY", "countryCode");
        values.put("countryCode", values.get("countryCode").toUpperCase(Locale.ROOT));
    }
    private static int maxLength(String key) {
        return switch (key) {
            case "notes", "description" -> 16000;
            case "sourceId", "propertyRef", "guestRef" -> 240;
            case "guestName" -> 200;
            case "firstName", "lastName", "confirmationCode" -> 100;
            case "email" -> 200;
            case "phone" -> 40;
            case "language" -> 10;
            default -> 255;
        };
    }
    private static void integer(Map<String, String> values, String key, int min, int max) {
        try {
            int number = Integer.parseInt(digits(values.get(key)));
            if (number < min || number > max) throw new NumberFormatException();
            values.put(key, Integer.toString(number));
        } catch (NumberFormatException e) { throw error("INTEGER", key); }
    }
    static String digits(String value) {
        StringBuilder out = new StringBuilder();
        value.codePoints().forEach(c -> out.appendCodePoint(Character.isDigit(c) ? '0' + Character.digit(c, 10) : c));
        return out.toString();
    }
    public static LocalDate date(String value, String format) {
        try {
            String normalized = digits(value);
            LocalDate date = switch (format) {
                case "ISO" -> LocalDate.parse(normalized, DateTimeFormatter.ISO_LOCAL_DATE);
                case "DMY" -> LocalDate.parse(normalized, DateTimeFormatter.ofPattern("d/M/uuuu").withResolverStyle(ResolverStyle.STRICT));
                case "MDY" -> LocalDate.parse(normalized, DateTimeFormatter.ofPattern("M/d/uuuu").withResolverStyle(ResolverStyle.STRICT));
                case "EXCEL_1900" -> {
                    int day = new BigDecimal(normalized).intValueExact();
                    if (day < 61) throw new IllegalArgumentException();
                    yield LocalDate.of(1899, 12, 30).plusDays(day);
                }
                default -> throw new IllegalArgumentException();
            };
            if (date.getYear() < 1900 || date.getYear() > 2200) throw new IllegalArgumentException();
            return date;
        } catch (Exception e) { throw error("DATE", "checkIn/checkOut"); }
    }
    public static BigDecimal money(String value, String decimalSeparator) {
        String number = digits(value).replace('\u066B', '.').replace('\u066C', ',')
            .replace("\u00A0", "").replace("\u202F", "").replace(" ", "");
        if (",".equals(decimalSeparator)) {
            if (!number.matches("[0-9]+(,[0-9]{1,2})?")) throw error("MONEY", "amount");
            number = number.replace(',', '.');
        } else if (!number.matches("[0-9]+(\\.[0-9]{1,2})?")) throw error("MONEY", "amount");
        BigDecimal result = new BigDecimal(number).setScale(2, RoundingMode.UNNECESSARY);
        if (result.precision() > 10) throw error("MONEY", "amount");
        return result;
    }
    private static String status(String value) {
        return switch (normalize(value)) {
            case "confirmed", "confirmé", "confirme", "confirmedbooking", "booked", "accepted", "مؤكد",
                 "new", "modified", "reserved", "reservation", "active", "checkedin", "checkedout", "modificationofbooking" -> "confirmed";
            case "cancelled", "canceled", "annule", "ملغي", "cancellation" -> "cancelled";
            // Requests and inquiries never held the calendar: they are counted, not imported.
            case "inquiry", "inquirypreapproved", "inquirynotpossible", "request", "pending", "awaitingpayment",
                 "declined", "denied", "expired", "closed", "black", "ownerstay" -> SKIPPED_STATUS;
            default -> throw error("STATUS", "status");
        };
    }
    private static IllegalArgumentException error(String code, String field) {
        return new IllegalArgumentException(code + ":" + field);
    }
}
