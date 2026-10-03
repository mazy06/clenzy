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
            f("notes", false, "notes", "comments")),
        Kind.ARCHIVE, List.of());

    public static ImportPlan suggest(ImportDocument document) {
        Kind kind = Kind.ARCHIVE;
        if (document.attachmentBase64() == null) {
            if (matched(document, "checkIn", Kind.RESERVATION) != null) kind = Kind.RESERVATION;
            else if (matched(document, "firstName", Kind.GUEST) != null) kind = Kind.GUEST;
            else if (matched(document, "address", Kind.PROPERTY) != null) kind = Kind.PROPERTY;
        }
        Map<String, String> mappings = new LinkedHashMap<>();
        for (Field field : FIELDS.get(kind)) {
            String match = matched(document, field.key(), kind);
            if (match != null) mappings.put(field.key(), match);
        }
        return new ImportPlan(document.id(), kind, mappings, Map.of(), Map.of(), "ISO", ".");
    }

    private static String matched(ImportDocument doc, String key, Kind kind) {
        Field field = FIELDS.get(kind).stream().filter(f -> f.key().equals(key)).findFirst().orElseThrow();
        Set<String> names = new HashSet<>();
        names.add(normalize(key)); field.aliases().forEach(a -> names.add(normalize(a)));
        List<String> matches = doc.columns().stream().filter(c -> names.contains(normalize(c))).toList();
        return matches.size() == 1 ? matches.getFirst() : null;
    }

    private static String normalize(String value) {
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
            if (field.required() && value.isBlank()) throw error("REQUIRED", field.key());
            if (value.length() > maxLength(field.key())) throw error("TOO_LONG", field.key());
            values.put(field.key(), value);
        }
        if (plan.kind() == Kind.ARCHIVE) return values;
        for (String reference : List.of("sourceId", "propertyRef", "guestRef")) {
            String value = values.get(reference);
            if (value != null && value.startsWith("'") && value.substring(1).matches("[0-9]+")) values.put(reference, value.substring(1));
        }
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
            case "confirmed", "confirmé", "confirme", "confirmedbooking", "booked", "accepted", "مؤكد" -> "confirmed";
            case "cancelled", "canceled", "annule", "ملغي" -> "cancelled";
            default -> throw error("STATUS", "status");
        };
    }
    private static IllegalArgumentException error(String code, String field) {
        return new IllegalArgumentException(code + ":" + field);
    }
}
