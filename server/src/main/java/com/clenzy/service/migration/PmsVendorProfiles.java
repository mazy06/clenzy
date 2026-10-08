package com.clenzy.service.migration;

import com.clenzy.service.migration.ImportPlan.Kind;
import java.util.*;

/**
 * Column hints per source PMS. A profile is a suggestion, never a trusted schema: every value still goes
 * through {@link PmsImportSchema#map}. Vendor hints use the field names of the vendor's public API (also
 * found in JSON exports), flattened with dots by {@link PmsExportReader}. Screen exports (CSV) vary by
 * account language and version: they fall back to the generic aliases until a real sample validates them.
 */
public final class PmsVendorProfiles {
    private PmsVendorProfiles() {}

    public enum Basis { BAITLY_EXPORT, VENDOR_API_FIELDS }

    public record Profile(String id, String name, Basis basis, String dateFormat,
                          Map<Kind, Map<String, List<String>>> hints, List<String> archivePrefixes) {
        public List<String> columns(Kind kind, String field) {
            return hints.getOrDefault(kind, Map.of()).getOrDefault(field, List.of());
        }
        /** Only forces archives (manifests, raw JSON, files); otherwise the generic detection decides. */
        public Kind kindFor(ImportDocument document) {
            String name = document.name().replace('\\', '/');
            return archivePrefixes.stream().anyMatch(name::startsWith) ? Kind.ARCHIVE : null;
        }
    }

    private static Map<String, List<String>> fields(String... pairs) {
        Map<String, List<String>> map = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) map.put(pairs[i], List.of(pairs[i + 1].split("\\|")));
        return map;
    }

    private static final Map<String, Profile> PROFILES = new LinkedHashMap<>();
    static {
        // Baitly's own account export: canonical field keys as headers, raw JSON and files kept as archives.
        add(new Profile("baitly", "Baitly", Basis.BAITLY_EXPORT, "ISO", Map.of(),
            List.of("json/", "files/", "manifest.json", "SCHEMA.md")));
        add(new Profile("smoobu", "Smoobu", Basis.VENDOR_API_FIELDS, "ISO", Map.of(
            Kind.PROPERTY, fields("sourceId", "id", "name", "name", "address", "location.street",
                "city", "location.city", "bedrooms", "rooms.bedrooms", "bathrooms", "rooms.bathrooms",
                "timezone", "timeZone", "currency", "currency"),
            Kind.RESERVATION, fields("sourceId", "id", "propertyRef", "apartment.id|apartment.name",
                "guestName", "guest-name", "checkIn", "arrival", "checkOut", "departure", "totalPrice", "price",
                "status", "type", "source", "channel.name", "guestCount", "adults",
                "confirmationCode", "reference-id", "notes", "notice")), List.of()));
        add(new Profile("beds24", "Beds24", Basis.VENDOR_API_FIELDS, "ISO", Map.of(
            Kind.PROPERTY, fields("sourceId", "id", "name", "name", "address", "address", "city", "city",
                "countryCode", "country", "currency", "currency"),
            Kind.RESERVATION, fields("sourceId", "id", "propertyRef", "propertyId", "checkIn", "arrival",
                "checkOut", "departure", "totalPrice", "price", "status", "status", "source", "channel|referer",
                "guestCount", "numAdult", "confirmationCode", "apiReference", "notes", "notes")), List.of()));
        add(new Profile("hostaway", "Hostaway", Basis.VENDOR_API_FIELDS, "ISO", Map.of(
            Kind.PROPERTY, fields("sourceId", "id", "name", "name", "address", "address", "city", "city",
                "countryCode", "countryCode", "bedrooms", "bedroomsNumber", "bathrooms", "bathroomsNumber",
                "timezone", "timeZoneName", "currency", "currencyCode"),
            Kind.RESERVATION, fields("sourceId", "id", "propertyRef", "listingMapId|listingName",
                "guestName", "guestName", "checkIn", "arrivalDate", "checkOut", "departureDate",
                "totalPrice", "totalPrice", "currency", "currency", "status", "status", "source", "channelName",
                "guestCount", "numberOfGuests", "confirmationCode", "channelReservationId", "notes", "hostNote",
                "cleaningFee", "cleaningFee", "taxes", "taxAmount")), List.of()));
        add(new Profile("guesty", "Guesty", Basis.VENDOR_API_FIELDS, "ISO", Map.of(
            Kind.PROPERTY, fields("sourceId", "_id", "name", "title|nickname", "address", "address.full",
                "city", "address.city", "bedrooms", "bedrooms", "bathrooms", "bathrooms",
                "timezone", "timezone", "currency", "prices.currency"),
            Kind.RESERVATION, fields("sourceId", "_id", "propertyRef", "listingId", "guestName", "guest.fullName",
                "guestRef", "guestId", "checkIn", "checkInDateLocalized|checkIn", "checkOut", "checkOutDateLocalized|checkOut",
                "totalPrice", "money.totalPrice|money.subTotalPrice|money.fareAccommodation",
                "currency", "money.currency", "status", "status", "source", "source", "guestCount", "guestsCount",
                "amountPaid", "money.totalPaid", "confirmationCode", "confirmationCode")), List.of()));
        add(new Profile("hospitable", "Hospitable", Basis.VENDOR_API_FIELDS, "ISO", Map.of(
            Kind.PROPERTY, fields("sourceId", "id", "name", "name|public_name", "address", "address.display|address.street",
                "city", "address.city", "countryCode", "address.country_code", "bedrooms", "capacity.bedrooms",
                "bathrooms", "capacity.bathrooms", "timezone", "timezone", "currency", "currency"),
            Kind.RESERVATION, fields("sourceId", "id", "checkIn", "arrival_date|check_in", "checkOut", "departure_date|check_out",
                "status", "status", "source", "platform", "guestCount", "guests.total",
                "confirmationCode", "code")), List.of()));
        add(new Profile("ownerrez", "OwnerRez", Basis.VENDOR_API_FIELDS, "ISO", Map.of(
            Kind.PROPERTY, fields("sourceId", "id", "name", "name", "bedrooms", "bedrooms", "bathrooms", "bathrooms"),
            Kind.RESERVATION, fields("sourceId", "id", "propertyRef", "property_id", "guestRef", "guest_id",
                "checkIn", "arrival", "checkOut", "departure", "totalPrice", "total_amount",
                "status", "status", "confirmationCode", "booking_number")), List.of()));
    }

    private static void add(Profile profile) { PROFILES.put(profile.id(), profile); }

    /** The source chosen at upload names the profile; unknown sources keep the generic aliases. */
    public static Profile forSource(String source) {
        if (source == null) return null;
        return PROFILES.get(PmsImportSchema.normalize(source));
    }

    public static Collection<Profile> all() { return Collections.unmodifiableCollection(PROFILES.values()); }
}
