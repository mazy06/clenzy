package com.clenzy.service.migration.api;

import com.clenzy.model.PropertyType;
import com.clenzy.service.migration.ImportDocument;
import com.clenzy.service.migration.PmsExportReader;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.math.RoundingMode;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;

/**
 * Read-only pulls from the public APIs of source PMS. Each connector converts the vendor payload into
 * documents whose columns are Baitly's canonical field keys, so the import workspace maps them without
 * guessing; the raw vendor pages are kept as an archive for anything not modelled. Endpoints and fields
 * follow each vendor's public API documentation: connectors are labelled beta until validated on a real
 * account, and an unexpected shape fails with API_RESPONSE_UNEXPECTED instead of importing partial data.
 */
@Component
public class PmsApiConnectors {
    static final int MAX_PAGES = 60;
    static final int MAX_PROPERTIES = 200;

    public record Vendor(String id, String name, List<String> credentialFields, String docsUrl) {}
    public record Pull(List<ImportDocument> documents, List<Raw> raw) {}
    public record Raw(String name, byte[] bytes) {}

    static final List<String> PROPERTY_COLUMNS = List.of("sourceId", "name", "address", "city", "countryCode",
        "bedrooms", "bathrooms", "timezone", "currency", "type", "description");
    static final List<String> GUEST_COLUMNS = List.of("sourceId", "firstName", "lastName", "email", "phone",
        "countryCode", "language");
    static final List<String> RESERVATION_COLUMNS = List.of("sourceId", "propertyRef", "guestName", "guestRef",
        "checkIn", "checkOut", "totalPrice", "currency", "status", "source", "guestCount", "amountPaid",
        "confirmationCode", "notes", "cleaningFee", "touristTax", "taxes");

    public static final List<Vendor> VENDORS = List.of(
        new Vendor("smoobu", "Smoobu", List.of("apiKey"), "https://docs.smoobu.com/"),
        new Vendor("beds24", "Beds24", List.of("token"), "https://wiki.beds24.com/index.php/API_V2.0"),
        new Vendor("hostaway", "Hostaway", List.of("accountId", "apiKey"), "https://api.hostaway.com/documentation"),
        new Vendor("guesty", "Guesty", List.of("clientId", "clientSecret"), "https://open-api-docs.guesty.com/"),
        new Vendor("hospitable", "Hospitable", List.of("token"), "https://developer.hospitable.com/"),
        new Vendor("ownerrez", "OwnerRez", List.of("email", "token"), "https://api.ownerrez.com/help/v2"));

    private final PmsApiTransport http;
    private final ObjectMapper json;

    public PmsApiConnectors(PmsApiTransport http, ObjectMapper json) { this.http = http; this.json = json; }

    public Pull pull(String vendor, Map<String, String> credentials, LocalDate from, LocalDate to) {
        Vendor spec = VENDORS.stream().filter(v -> v.id().equals(vendor)).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("API_VENDOR_UNSUPPORTED"));
        for (String field : spec.credentialFields()) {
            String value = credentials == null ? null : credentials.get(field);
            if (value == null || value.isBlank() || value.length() > 4096) throw new IllegalArgumentException("API_CREDENTIALS_REQUIRED");
        }
        if (from == null || to == null || !to.isAfter(from) || to.isAfter(from.plusYears(5)))
            throw new IllegalArgumentException("API_WINDOW_INVALID");
        Collector out = new Collector(vendor);
        switch (vendor) {
            case "smoobu" -> smoobu(credentials, from, to, out);
            case "beds24" -> beds24(credentials, from, to, out);
            case "hostaway" -> hostaway(credentials, from, to, out);
            case "guesty" -> guesty(credentials, from, to, out);
            case "hospitable" -> hospitable(credentials, from, to, out);
            case "ownerrez" -> ownerrez(credentials, from, to, out);
            default -> throw new IllegalArgumentException("API_VENDOR_UNSUPPORTED");
        }
        return out.build();
    }

    // ─── Smoobu: Api-Key header, page/page_count pagination ────────────────────────────────

    private void smoobu(Map<String, String> c, LocalDate from, LocalDate to, Collector out) {
        String base = "https://login.smoobu.com/api";
        Map<String, String> headers = Map.of("Api-Key", c.get("apiKey"), "Cache-Control", "no-cache");
        JsonNode list = out.page("apartments", http.get(URI.create(base + "/apartments"), headers));
        Map<String, String> currencies = new HashMap<>();
        for (JsonNode summary : array(list, "apartments").stream().limit(MAX_PROPERTIES).toList()) {
            String id = text(summary, "id");
            JsonNode a = out.page("apartment-" + id, http.get(URI.create(base + "/apartments/" + PmsApiTransport.encode(id)), headers));
            currencies.put(id, text(a, "currency"));
            out.property(id, first(text(a, "name"), text(summary, "name")), joined(text(a.path("location"), "street"),
                text(a.path("location"), "zip")), text(a.path("location"), "city"), "",
                text(a.path("rooms"), "bedrooms"), text(a.path("rooms"), "bathrooms"), text(a, "timeZone"),
                text(a, "currency"), text(a.path("type"), "name"), "");
        }
        for (int page = 1; page <= MAX_PAGES; page++) {
            JsonNode body = out.page("reservations-" + page, http.get(URI.create(base + "/reservations?pageSize=100&showCancellation=true&excludeBlocked=true"
                + "&from=" + from + "&to=" + to + "&page=" + page), headers));
            for (JsonNode b : array(body, "bookings")) {
                String apartment = text(b.path("apartment"), "id");
                String guestRef = out.guest("", text(b, "firstname"), text(b, "lastname"),
                    text(b, "email"), text(b, "phone"), "", text(b, "language"));
                out.reservation(text(b, "id"), apartment, first(text(b, "guest-name"), joined(text(b, "firstname"), text(b, "lastname"))),
                    guestRef, text(b, "arrival"), text(b, "departure"), text(b, "price"), currencies.getOrDefault(apartment, ""),
                    text(b, "type"), text(b.path("channel"), "name"), text(b, "adults"),
                    "Yes".equalsIgnoreCase(text(b, "price-paid")) ? text(b, "price") : "",
                    text(b, "reference-id"), text(b, "notice"), "", "", "");
            }
            if (body.path("page_count").asInt(1) <= page) break;
        }
    }

    // ─── Beds24 API V2: token header, pages.nextPageExists ─────────────────────────────────

    private void beds24(Map<String, String> c, LocalDate from, LocalDate to, Collector out) {
        String base = "https://api.beds24.com/v2";
        Map<String, String> headers = Map.of("token", c.get("token"), "accept", "application/json");
        Map<String, String> currencies = new HashMap<>();
        for (int page = 1; page <= MAX_PAGES; page++) {
            JsonNode body = out.page("properties-" + page, http.get(URI.create(base + "/properties?page=" + page), headers));
            for (JsonNode p : array(body, "data")) {
                currencies.put(text(p, "id"), text(p, "currency"));
                out.property(text(p, "id"), text(p, "name"), text(p, "address"), text(p, "city"), text(p, "country"),
                    "", "", "", text(p, "currency"), text(p, "propertyType"), "");
            }
            if (!body.path("pages").path("nextPageExists").asBoolean(false)) break;
        }
        for (int page = 1; page <= MAX_PAGES; page++) {
            JsonNode body = out.page("bookings-" + page, http.get(URI.create(base + "/bookings?arrivalFrom=" + from
                + "&arrivalTo=" + to + "&page=" + page), headers));
            for (JsonNode b : array(body, "data")) {
                String guestRef = out.guest("", text(b, "firstName"), text(b, "lastName"), text(b, "email"),
                    first(text(b, "mobile"), text(b, "phone")), text(b, "country2"), text(b, "lang"));
                out.reservation(text(b, "id"), text(b, "propertyId"), joined(text(b, "firstName"), text(b, "lastName")),
                    guestRef, text(b, "arrival"), text(b, "departure"), text(b, "price"),
                    currencies.getOrDefault(text(b, "propertyId"), ""), text(b, "status"),
                    first(text(b, "channel"), text(b, "referer")), text(b, "numAdult"), "", text(b, "apiReference"),
                    text(b, "notes"), "", "", text(b, "tax"));
            }
            if (!body.path("pages").path("nextPageExists").asBoolean(false)) break;
        }
    }

    // ─── Hostaway: client-credentials token, limit/offset ──────────────────────────────────

    private void hostaway(Map<String, String> c, LocalDate from, LocalDate to, Collector out) {
        String base = "https://api.hostaway.com/v1";
        JsonNode token = http.postForm(URI.create(base + "/accessTokens"), Map.of("grant_type", "client_credentials",
            "client_id", c.get("accountId"), "client_secret", c.get("apiKey"), "scope", "general"), Map.of());
        Map<String, String> headers = bearer(token);
        Map<String, String> currencies = new HashMap<>();
        paged(offset -> http.get(URI.create(base + "/listings?limit=100&offset=" + offset), headers), out, "listings", "result", "offset", l -> {
            currencies.put(text(l, "id"), text(l, "currencyCode"));
            out.property(text(l, "id"), text(l, "name"), text(l, "address"), text(l, "city"), text(l, "countryCode"),
                text(l, "bedroomsNumber"), text(l, "bathroomsNumber"), text(l, "timeZoneName"), text(l, "currencyCode"),
                "", text(l, "description"));
        });
        paged(offset -> http.get(URI.create(base + "/reservations?limit=100&offset=" + offset + "&arrivalStartDate=" + from
            + "&arrivalEndDate=" + to), headers), out, "reservations", "result", "offset", r -> {
            String guestRef = out.guest("", text(r, "guestFirstName"), text(r, "guestLastName"),
                text(r, "guestEmail"), text(r, "phone"), text(r, "guestCountry"), text(r, "guestLocale"));
            out.reservation(text(r, "id"), text(r, "listingMapId"), first(text(r, "guestName"),
                    joined(text(r, "guestFirstName"), text(r, "guestLastName"))), guestRef, text(r, "arrivalDate"),
                text(r, "departureDate"), text(r, "totalPrice"), first(text(r, "currency"), currencies.getOrDefault(text(r, "listingMapId"), "")),
                text(r, "status"), text(r, "channelName"), text(r, "numberOfGuests"),
                "1".equals(text(r, "isPaid")) || "true".equals(text(r, "isPaid")) ? text(r, "totalPrice") : "",
                text(r, "channelReservationId"), text(r, "hostNote"), text(r, "cleaningFee"), "", text(r, "taxAmount"));
        });
    }

    // ─── Guesty Open API: OAuth client credentials, limit/skip ─────────────────────────────

    private void guesty(Map<String, String> c, LocalDate from, LocalDate to, Collector out) {
        JsonNode token = http.postForm(URI.create("https://open-api.guesty.com/oauth2/token"), Map.of(
            "grant_type", "client_credentials", "scope", "open-api",
            "client_id", c.get("clientId"), "client_secret", c.get("clientSecret")), Map.of("Accept", "application/json"));
        Map<String, String> headers = bearer(token);
        String base = "https://open-api.guesty.com/v1";
        paged(skip -> http.get(URI.create(base + "/listings?limit=100&skip=" + skip), headers), out, "listings", "results", "skip", l ->
            out.property(text(l, "_id"), first(text(l, "title"), text(l, "nickname")), text(l.path("address"), "full"),
                text(l.path("address"), "city"), "", text(l, "bedrooms"), text(l, "bathrooms"), text(l, "timezone"),
                text(l.path("prices"), "currency"), text(l, "propertyType"), ""));
        String filter = PmsApiTransport.encode("[{\"field\":\"checkIn\",\"operator\":\"$between\",\"from\":\"" + from
            + "\",\"to\":\"" + to + "\"}]");
        paged(skip -> http.get(URI.create(base + "/reservations?limit=100&skip=" + skip + "&filters=" + filter), headers),
            out, "reservations", "results", "skip", r -> {
            JsonNode g = r.path("guest");
            JsonNode money = r.path("money");
            String guestRef = out.guest(first(text(r, "guestId"), text(g, "_id")), text(g, "firstName"), text(g, "lastName"),
                text(g, "email"), text(g, "phone"), "", "");
            out.reservation(text(r, "_id"), text(r, "listingId"), first(text(g, "fullName"), joined(text(g, "firstName"), text(g, "lastName"))),
                guestRef, first(text(r, "checkInDateLocalized"), text(r, "checkIn")),
                first(text(r, "checkOutDateLocalized"), text(r, "checkOut")),
                first(text(money, "totalPrice"), text(money, "subTotalPrice"), text(money, "fareAccommodation")),
                text(money, "currency"), text(r, "status"), text(r, "source"), text(r, "guestsCount"),
                text(money, "totalPaid"), text(r, "confirmationCode"), "", text(money, "fareCleaning"), "", text(money, "totalTaxes"));
        });
    }

    // ─── Hospitable Public API v2: personal access token, page/last_page ───────────────────

    private void hospitable(Map<String, String> c, LocalDate from, LocalDate to, Collector out) {
        String base = "https://public.api.hospitable.com/v2";
        Map<String, String> headers = Map.of("Authorization", "Bearer " + c.get("token"), "Accept", "application/json");
        List<String> ids = new ArrayList<>();
        for (int page = 1; page <= MAX_PAGES; page++) {
            JsonNode body = out.page("properties-" + page, http.get(URI.create(base + "/properties?per_page=100&page=" + page), headers));
            for (JsonNode p : array(body, "data")) {
                ids.add(text(p, "id"));
                JsonNode address = p.path("address");
                out.property(text(p, "id"), first(text(p, "name"), text(p, "public_name")),
                    first(text(address, "display"), text(address, "street")), text(address, "city"), text(address, "country_code"),
                    text(p.path("capacity"), "bedrooms"), text(p.path("capacity"), "bathrooms"), text(p, "timezone"),
                    text(p, "currency"), text(p, "property_type"), "");
            }
            if (body.path("meta").path("last_page").asInt(1) <= page) break;
        }
        for (List<String> chunk : chunks(ids.stream().limit(MAX_PROPERTIES).toList(), 20)) {
            String props = chunk.stream().map(id -> "properties%5B%5D=" + PmsApiTransport.encode(id)).reduce((a, b) -> a + "&" + b).orElse("");
            for (int page = 1; page <= MAX_PAGES; page++) {
                JsonNode body = out.page("reservations-" + out.pages() + "-" + page, http.get(URI.create(base + "/reservations?" + props
                    + "&start_date=" + from + "&end_date=" + to + "&include=guest,financials,properties&per_page=100&page=" + page), headers));
                for (JsonNode r : array(body, "data")) {
                    JsonNode g = r.path("guest");
                    JsonNode revenue = r.path("financials").path("host").path("revenue");
                    String property = r.path("properties").isArray() && !r.path("properties").isEmpty()
                        ? text(r.path("properties").get(0), "id") : "";
                    String guestRef = out.guest("", text(g, "first_name"), text(g, "last_name"), text(g, "email"),
                        g.path("phone_numbers").isArray() && !g.path("phone_numbers").isEmpty() ? g.path("phone_numbers").get(0).asText("") : "",
                        "", text(g, "language"));
                    out.reservation(text(r, "id"), property, joined(text(g, "first_name"), text(g, "last_name")), guestRef,
                        text(r, "arrival_date"), text(r, "departure_date"), cents(revenue.path("amount")), text(revenue, "currency"),
                        first(text(r.path("reservation_status").path("current"), "category"), text(r, "status")), text(r, "platform"),
                        text(r.path("guests"), "total"), "", text(r, "code"), "", "", "", "");
                }
                if (body.path("meta").path("last_page").asInt(1) <= page) break;
            }
        }
    }

    // ─── OwnerRez API v2: basic auth (account email + personal access token) ───────────────

    private void ownerrez(Map<String, String> c, LocalDate from, LocalDate to, Collector out) {
        String base = "https://api.ownerrez.com/v2";
        String basic = Base64.getEncoder().encodeToString((c.get("email") + ":" + c.get("token")).getBytes(StandardCharsets.UTF_8));
        Map<String, String> headers = Map.of("Authorization", "Basic " + basic, "Accept", "application/json",
            "User-Agent", "Baitly-Migration/1.0");
        List<String> ids = new ArrayList<>();
        nextPages(base + "/properties", headers, out, "properties", p -> {
            ids.add(text(p, "id"));
            out.property(text(p, "id"), text(p, "name"), "", "", "", text(p, "bedrooms"), text(p, "bathrooms"), "", "", "", "");
        });
        if (ids.isEmpty()) return;
        String props = String.join(",", ids.stream().limit(MAX_PROPERTIES).toList());
        nextPages(base + "/bookings?property_ids=" + PmsApiTransport.encode(props) + "&since_utc=" + from + "T00:00:00Z",
            headers, out, "bookings", b -> {
            if (b.path("is_block").asBoolean(false)) return;
            LocalDate arrival = LocalDate.parse(first(text(b, "arrival"), "1900-01-01").substring(0, 10));
            if (arrival.isBefore(from) || !arrival.isBefore(to)) return;
            JsonNode g = b.path("guest");
            String guestRef = text(b, "guest_id");
            if (!guestRef.isBlank()) out.guestRow(guestRef, text(g, "first_name"), text(g, "last_name"),
                emailOf(g), "", "", "");
            out.reservation(text(b, "id"), text(b, "property_id"), joined(text(g, "first_name"), text(g, "last_name")),
                guestRef, text(b, "arrival"), text(b, "departure"), text(b, "total_amount"), text(b, "currency_code"),
                text(b, "status"), text(b, "listing_site"), text(b, "adults"), text(b, "total_paid"),
                text(b, "booking_number"), "", "", "", "");
        });
    }

    // ─── Pagination helpers ─────────────────────────────────────────────────────────────────

    private void paged(Function<Integer, JsonNode> fetch, Collector out, String label, String field, String unit,
                       java.util.function.Consumer<JsonNode> each) {
        int offset = 0;
        for (int page = 0; page < MAX_PAGES; page++) {
            JsonNode body = out.page(label + "-" + unit + "-" + offset, fetch.apply(offset));
            List<JsonNode> items = array(body, field);
            items.forEach(each);
            offset += items.size();
            int count = body.path("count").asInt(-1);
            if (items.size() < 100 || (count >= 0 && offset >= count)) return;
        }
        throw new IllegalArgumentException("ROWS_LIMIT");
    }

    private void nextPages(String first, Map<String, String> headers, Collector out, String label,
                           java.util.function.Consumer<JsonNode> each) {
        String url = first;
        for (int page = 0; page < MAX_PAGES && url != null && !url.isBlank(); page++) {
            URI uri = URI.create(url.startsWith("http") ? url : "https://api.ownerrez.com" + url);
            // Follow-up links must stay on the vendor host: a payload cannot redirect credentials elsewhere.
            if (!"api.ownerrez.com".equals(uri.getHost()) || !"https".equals(uri.getScheme()))
                throw new IllegalArgumentException("API_RESPONSE_UNEXPECTED");
            JsonNode body = out.page(label + "-" + page, http.get(uri, headers));
            array(body, "items").forEach(each);
            url = text(body, "next_page_url");
        }
    }

    // ─── Payload helpers ────────────────────────────────────────────────────────────────────

    private static Map<String, String> bearer(JsonNode token) {
        String access = text(token, "access_token");
        if (access.isBlank()) throw new IllegalArgumentException("API_AUTH");
        return Map.of("Authorization", "Bearer " + access, "Accept", "application/json");
    }

    static List<JsonNode> array(JsonNode body, String field) {
        JsonNode node = body.path(field);
        if (node.isMissingNode() || node.isNull()) return List.of();
        if (!node.isArray()) throw new IllegalArgumentException("API_RESPONSE_UNEXPECTED");
        List<JsonNode> items = new ArrayList<>();
        node.forEach(items::add);
        return items;
    }

    static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull() || value.isContainerNode()) return "";
        return value.isNumber() ? value.decimalValue().stripTrailingZeros().toPlainString() : value.asText("").trim();
    }

    private static String emailOf(JsonNode guest) {
        JsonNode emails = guest.path("email_addresses");
        if (emails.isArray() && !emails.isEmpty()) return text(emails.get(0), "address");
        return text(guest, "email");
    }

    private static String cents(JsonNode amount) {
        if (!amount.isNumber()) return "";
        return amount.decimalValue().movePointLeft(2).setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    static String first(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return value;
        return "";
    }

    private static String joined(String a, String b) { return (a + " " + b).trim(); }

    private static <T> List<List<T>> chunks(List<T> items, int size) {
        List<List<T>> out = new ArrayList<>();
        for (int i = 0; i < items.size(); i += size) out.add(items.subList(i, Math.min(items.size(), i + size)));
        return out;
    }

    /** Best effort; an unknown type stays blank so the importer asks for it instead of inventing one. */
    static String propertyType(String raw) {
        String value = raw == null ? "" : raw.toLowerCase(Locale.ROOT);
        if (value.contains("studio")) return PropertyType.STUDIO.name();
        if (value.contains("villa")) return PropertyType.VILLA.name();
        if (value.contains("loft")) return PropertyType.LOFT.name();
        if (value.contains("chalet")) return PropertyType.CHALET.name();
        if (value.contains("riad")) return PropertyType.RIAD.name();
        if (value.contains("bungalow")) return PropertyType.BUNGALOW.name();
        if (value.contains("cottage")) return PropertyType.COTTAGE.name();
        if (value.contains("town")) return PropertyType.TOWNHOUSE.name();
        if (value.contains("boat")) return PropertyType.BOAT.name();
        if (value.contains("apartment") || value.contains("flat") || value.contains("condo")) return PropertyType.APARTMENT.name();
        if (value.contains("house") || value.contains("home")) return PropertyType.HOUSE.name();
        if (value.contains("room")) return PropertyType.GUEST_ROOM.name();
        return "";
    }

    /** Collects canonical rows and the raw pages, within the same limits as file uploads. */
    final class Collector {
        private final String vendor;
        private final Map<String, Map<String, String>> properties = new LinkedHashMap<>();
        private final Map<String, Map<String, String>> guests = new LinkedHashMap<>();
        private final Map<String, Map<String, String>> reservations = new LinkedHashMap<>();
        private final List<Raw> raw = new ArrayList<>();
        private int rawBytes;

        Collector(String vendor) { this.vendor = vendor; }

        int pages() { return raw.size(); }

        JsonNode page(String label, JsonNode body) {
            try {
                byte[] bytes = json.writeValueAsBytes(body);
                rawBytes += bytes.length;
                if (rawBytes > PmsExportReader.MAX_EXPANDED_BYTES) throw new IllegalArgumentException("ROWS_LIMIT");
                raw.add(new Raw(vendor + "-api/" + label + ".json", bytes));
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                throw new IllegalArgumentException("API_RESPONSE_UNEXPECTED");
            }
            return body;
        }

        void property(String id, String name, String address, String city, String country, String bedrooms,
                      String bathrooms, String timezone, String currency, String type, String description) {
            if (id.isBlank()) return;
            put(properties, id, PROPERTY_COLUMNS, id, name, address, city, country.length() == 2 ? country : "",
                bedrooms, bathrooms, timezone, currency, propertyType(type), description);
        }

        /** Guests without any contact are not invented: the reservation keeps the guest name only. */
        String guest(String id, String firstName, String lastName, String email, String phone, String country, String language) {
            if (email.isBlank() && phone.isBlank()) return "";
            String key = id.isBlank() ? (email.isBlank() ? "phone:" + phone : "email:" + email.toLowerCase(Locale.ROOT)) : id;
            guestRow(key, firstName, lastName, email, phone, country, language);
            return key;
        }

        void guestRow(String id, String firstName, String lastName, String email, String phone, String country, String language) {
            String name = first(firstName, lastName, email, phone);
            put(guests, id, GUEST_COLUMNS, id, name, firstName.isBlank() ? "" : lastName,
                email, phone, country.length() == 2 ? country : "", language.length() <= 10 ? language : "");
        }

        void reservation(String id, String propertyRef, String guestName, String guestRef, String checkIn, String checkOut,
                         String total, String currency, String status, String source, String guests, String paid,
                         String confirmation, String notes, String cleaningFee, String touristTax, String taxes) {
            if (id.isBlank()) return;
            put(reservations, id, RESERVATION_COLUMNS, id, propertyRef, guestName, guestRef, day(checkIn), day(checkOut),
                total, currency, status, source, guests, paid, confirmation, notes, cleaningFee, touristTax, taxes);
        }

        private String day(String value) {
            return value.length() >= 10 && value.charAt(4) == '-' ? value.substring(0, 10) : value;
        }

        private void put(Map<String, Map<String, String>> target, String id, List<String> columns, String... values) {
            Map<String, String> row = new LinkedHashMap<>();
            for (int i = 0; i < columns.size(); i++) row.put(columns.get(i), values[i] == null ? "" : values[i]);
            target.put(id, row);
            if (properties.size() + guests.size() + reservations.size() > PmsExportReader.MAX_ROWS)
                throw new IllegalArgumentException("ROWS_LIMIT");
        }

        Pull build() {
            List<ImportDocument> documents = new ArrayList<>();
            add(documents, "Logements (" + vendor + " API)", PROPERTY_COLUMNS, properties);
            add(documents, "Voyageurs (" + vendor + " API)", GUEST_COLUMNS, guests);
            add(documents, "Réservations (" + vendor + " API)", RESERVATION_COLUMNS, reservations);
            if (documents.isEmpty()) throw new IllegalArgumentException("EMPTY_EXPORT");
            // Vendor pages stay inert and retrievable: everything not modelled is kept, nothing is lost.
            try {
                Map<String, Object> archive = new LinkedHashMap<>();
                for (Raw page : raw) archive.put(page.name(), json.readTree(page.bytes()));
                documents.add(new ImportDocument(UUID.randomUUID().toString(), vendor + "-api/raw-pages.json", List.of(), List.of(),
                    Base64.getEncoder().encodeToString(json.writeValueAsBytes(archive))));
            } catch (java.io.IOException e) { throw new IllegalArgumentException("API_RESPONSE_UNEXPECTED"); }
            return new Pull(documents, List.copyOf(raw));
        }

        private void add(List<ImportDocument> documents, String name, List<String> columns, Map<String, Map<String, String>> rows) {
            if (rows.isEmpty()) return;
            documents.add(new ImportDocument(UUID.randomUUID().toString(), name, columns, List.copyOf(rows.values()), null));
        }
    }

}
