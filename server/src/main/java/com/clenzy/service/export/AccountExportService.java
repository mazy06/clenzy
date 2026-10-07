package com.clenzy.service.export;

import com.clenzy.model.*;
import com.clenzy.repository.PmsImportBatchRepository;
import com.clenzy.service.PhotoStorageService;
import com.clenzy.service.migration.PmsImportService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import jakarta.persistence.EntityManager;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Full account export, so that leaving Baitly never depends on Baitly's goodwill.
 *
 * <ul>
 *   <li>{@code csv/}: properties, guests, reservations, reviews, nightly rates and tasks with the import
 *   field keys as headers, so the files re-import into Baitly (or map cleanly into another PMS).</li>
 *   <li>{@code json/}: every column of every operational table in scope, as text, minus credentials,
 *   payment-provider identifiers and binary blobs (files are exported separately).</li>
 *   <li>{@code files/}: property photos stored by Baitly; photos hosted elsewhere are listed by URL.</li>
 *   <li>{@code imports/}: the original files of past PMS imports with their SHA-256.</li>
 *   <li>{@code manifest.json}: counts, exclusions and the SHA-256 of every file, to verify the delivery.</li>
 * </ul>
 *
 * Scope: platform staff export the organisation; a host exports the properties they own and the data
 * attached to them. Guests are decrypted through their entity, never dumped as ciphertext.
 */
@Service
public class AccountExportService {
    public static final int SCHEMA_VERSION = 1;
    /** Exported raw tables, in dependency order. Each is filtered by organisation, then by scope. */
    static final List<String> TABLES = List.of("properties", "property_photos", "reservations", "calendar_days",
        "rate_overrides", "rate_plans", "length_of_stay_discounts", "booking_restrictions", "tourist_tax_configs",
        "guest_reviews", "interventions", "service_requests", "incidents", "conversations", "conversation_messages",
        "invoices", "invoice_lines", "owner_payouts", "provider_expenses", "security_deposits", "upsell_orders",
        "reservation_service_items", "management_contracts", "ical_feeds", "message_templates");
    /** Never exported: secrets, payment-provider handles and blobs. Identity documents are encrypted tables, not listed. */
    static final Pattern EXCLUDED_COLUMN = Pattern.compile(
        "(?i).*(secret|token|password|api_?key|iban|payment_method|session_id|signature_key).*|stripe_.*|.*_bic|xml_content|qr_code_data|data");

    public record Scope(Long orgId, String subject, boolean staff) {}

    private final EntityManager em;
    private final PmsImportBatchRepository batches;
    private final ObjectProvider<PhotoStorageService> photos;
    private final ObjectMapper json;

    public AccountExportService(EntityManager em, PmsImportBatchRepository batches,
                                ObjectProvider<PhotoStorageService> photos, ObjectMapper json) {
        this.em = em; this.batches = batches; this.photos = photos;
        this.json = json.copy().enable(SerializationFeature.INDENT_OUTPUT);
    }

    /** Writes the archive to a temporary file; the caller streams then deletes it. */
    @Transactional(readOnly = true)
    public Path export(PmsImportService.Actor actor) throws IOException {
        Scope scope = new Scope(actor.orgId(), actor.subject(), actor.staff());
        Path file = Files.createTempFile("baitly-export-", ".zip");
        try (var zip = new Writer(new ZipOutputStream(new BufferedOutputStream(Files.newOutputStream(file))))) {
            List<Property> properties = properties(scope);
            List<Long> propertyIds = properties.stream().map(Property::getId).toList();
            Map<String, Object> counts = new LinkedHashMap<>();
            List<String> notes = new ArrayList<>();

            List<Reservation> reservations = propertyIds.isEmpty() ? List.of() : em.createQuery(
                "select r from Reservation r left join fetch r.guest where r.property.id in :ids order by r.checkIn, r.id",
                Reservation.class).setParameter("ids", propertyIds).getResultList();
            Map<Long, Guest> guests = new LinkedHashMap<>();
            if (scope.staff()) em.createQuery("select g from Guest g where g.organizationId = :org order by g.id", Guest.class)
                .setParameter("org", scope.orgId()).getResultList().forEach(g -> guests.put(g.getId(), g));
            reservations.stream().map(Reservation::getGuest).filter(Objects::nonNull).forEach(g -> guests.putIfAbsent(g.getId(), g));

            counts.put("properties", csv(zip, "csv/properties.csv", List.of("sourceId", "name", "address", "city",
                "countryCode", "bedrooms", "bathrooms", "timezone", "currency", "type", "description"), properties, p -> row(
                p.getId(), p.getName(), p.getAddress(), p.getCity(), p.getCountryCode(), p.getBedroomCount(),
                p.getBathroomCount(), p.getTimezone(), p.getDefaultCurrency(), p.getType(), p.getDescription())));
            counts.put("guests", csv(zip, "csv/guests.csv", List.of("sourceId", "firstName", "lastName", "email", "phone",
                "countryCode", "language", "notes"), guests.values(), g -> row(g.getId(), g.getFirstName(), g.getLastName(),
                g.getEmail(), g.getPhone(), g.getCountryCode(), g.getLanguage(), g.getNotes())));
            counts.put("reservations", csv(zip, "csv/reservations.csv", List.of("sourceId", "propertyRef", "guestName",
                "guestRef", "checkIn", "checkOut", "totalPrice", "currency", "status", "source", "guestCount", "amountPaid",
                "confirmationCode", "notes", "cleaningFee", "touristTax", "taxes"), reservations, r -> row(r.getId(),
                r.getProperty().getId(), r.getGuestName(), r.getGuest() == null ? null : r.getGuest().getId(), r.getCheckIn(),
                r.getCheckOut(), r.getTotalPrice(), r.getCurrency(), r.getStatus(), r.getSource(), r.getGuestCount(),
                r.getAmountPaid(), r.getConfirmationCode(), r.getNotes(), r.getCleaningFee(), r.getTouristTaxAmount(),
                r.getTaxAmount())));
            List<GuestReview> reviews = propertyIds.isEmpty() ? List.of() : em.createQuery(
                "select g from GuestReview g where g.organizationId = :org and g.propertyId in :ids order by g.reviewDate",
                GuestReview.class).setParameter("org", scope.orgId()).setParameter("ids", propertyIds).getResultList();
            counts.put("reviews", csv(zip, "csv/reviews.csv", List.of("sourceId", "propertyRef", "rating", "reviewDate",
                "channel", "guestName", "text", "response"), reviews, g -> row(g.getId(), g.getPropertyId(), g.getRating(),
                g.getReviewDate(), g.getChannelName(), g.getGuestName(), g.getReviewText(), g.getHostResponse())));
            List<RateOverride> rates = propertyIds.isEmpty() ? List.of() : em.createQuery(
                "select r from RateOverride r where r.property.id in :ids order by r.date", RateOverride.class)
                .setParameter("ids", propertyIds).getResultList();
            counts.put("rates", csv(zip, "csv/rates.csv", List.of("propertyRef", "date", "price", "currency"), rates,
                r -> row(r.getProperty().getId(), r.getDate(), r.getNightlyPrice(), r.getCurrency())));
            List<Intervention> tasks = propertyIds.isEmpty() ? List.of() : em.createQuery(
                "select i from Intervention i where i.property.id in :ids order by i.startTime", Intervention.class)
                .setParameter("ids", propertyIds).getResultList();
            counts.put("tasks", csv(zip, "csv/tasks.csv", List.of("sourceId", "propertyRef", "title", "date", "type",
                "status", "notes"), tasks, i -> row(i.getId(), i.getProperty().getId(), i.getTitle(),
                i.getStartTime() == null ? null : i.getStartTime().toLocalDate(), i.getType(), i.getStatus(), i.getDescription())));

            Map<String, Object> tables = new LinkedHashMap<>();
            for (String table : TABLES) {
                Integer rows = rawTable(zip, table, scope, propertyIds);
                if (rows != null) tables.put(table, rows);
            }
            counts.put("tables", tables);
            counts.put("photos", photos(zip, propertyIds, notes));
            counts.put("imports", imports(zip, scope));

            zip.text("SCHEMA.md", schema());
            Map<String, Object> manifest = new LinkedHashMap<>();
            manifest.put("schemaVersion", SCHEMA_VERSION);
            manifest.put("generatedAt", Instant.now().toString());
            manifest.put("organizationId", scope.orgId());
            manifest.put("scope", scope.staff() ? "organization" : "owned-properties");
            manifest.put("counts", counts);
            manifest.put("excluded", List.of(
                "Secrets and credentials (API keys, tokens, passwords) — they belong to you and to the providers that issued them.",
                "Payment-provider identifiers (Stripe customer, session and payment-method IDs) — request them from the provider.",
                "Encrypted identity documents (online check-in, guest declarations) — available on request, subject to legal retention."));
            manifest.put("notes", notes);
            manifest.put("files", zip.inventory());
            zip.bytes("manifest.json", json.writeValueAsBytes(manifest), false);
        } catch (IOException | RuntimeException e) {
            Files.deleteIfExists(file);
            throw e;
        }
        return file;
    }

    private List<Property> properties(Scope scope) {
        String query = "select p from Property p left join fetch p.owner where p.organizationId = :org"
            + (scope.staff() ? "" : " and p.owner.keycloakId = :subject") + " order by p.id";
        var q = em.createQuery(query, Property.class).setParameter("org", scope.orgId());
        if (!scope.staff()) q.setParameter("subject", scope.subject());
        return q.getResultList();
    }

    private static List<Object> row(Object... values) { return Arrays.asList(values); }

    private <T> int csv(Writer zip, String path, List<String> header, Collection<T> items,
                        java.util.function.Function<T, List<Object>> row) throws IOException {
        StringWriter out = new StringWriter();
        try (var printer = new CSVPrinter(out, CSVFormat.DEFAULT.builder().setHeader(header.toArray(String[]::new)).build())) {
            for (T item : items) {
                List<Object> values = new ArrayList<>();
                for (Object value : row.apply(item)) values.add(value instanceof BigDecimal d ? d.toPlainString() : value);
                printer.printRecord(values);
            }
        }
        // UTF-8 BOM so spreadsheet software reads accents and Arabic correctly.
        zip.bytes(path, ("﻿" + out).getBytes(StandardCharsets.UTF_8), true);
        return items.size();
    }

    /** Returns null when the table does not exist in this database or cannot be scoped to the actor. */
    private Integer rawTable(Writer zip, String table, Scope scope, List<Long> propertyIds) throws IOException {
        @SuppressWarnings("unchecked")
        List<Object[]> columns = em.createNativeQuery("select column_name, data_type from information_schema.columns "
            + "where table_schema = current_schema() and table_name = :t order by ordinal_position")
            .setParameter("t", table).getResultList();
        Set<String> names = new HashSet<>();
        columns.forEach(c -> names.add(String.valueOf(c[0])));
        if (!names.contains("organization_id")) return null;
        String filter = scopeFilter(table, names, scope, propertyIds);
        if (filter == null) return null;
        List<String> kept = keptColumns(columns);
        if (kept.isEmpty()) return null;
        String select = rawSelect(table, kept, filter, names.contains("id"));
        var query = em.createNativeQuery(select).setParameter("org", scope.orgId());
        if (filter.contains(":ids")) query.setParameter("ids", propertyIds);
        List<?> result = query.getResultList();
        List<Map<String, String>> rows = new ArrayList<>();
        for (Object record : result) {
            Object[] values = record instanceof Object[] array ? array : new Object[]{record};
            Map<String, String> map = new LinkedHashMap<>();
            for (int i = 0; i < kept.size(); i++) map.put(kept.get(i), values[i] == null ? null : values[i].toString());
            rows.add(map);
        }
        zip.bytes("json/" + table + ".json", json.writeValueAsBytes(rows), true);
        return rows.size();
    }

    static List<String> keptColumns(List<Object[]> columns) {
        return columns.stream().filter(c -> !"bytea".equals(String.valueOf(c[1])))
            .map(c -> String.valueOf(c[0])).filter(c -> !EXCLUDED_COLUMN.matcher(c).matches()).toList();
    }

    /** Identifiers come from the fixed table list and information_schema, and are quoted regardless. */
    static String rawSelect(String table, List<String> kept, String filter, boolean ordered) {
        return "select " + String.join(", ", kept.stream().map(c -> "\"" + c.replace("\"", "") + "\"::text").toList())
            + " from \"" + table + "\" where organization_id = :org" + filter + (ordered ? " order by id" : "");
    }

    /** Staff see the organisation; a host only rows reachable from the properties they own. */
    static String scopeFilter(String table, Set<String> columns, Scope scope, List<Long> propertyIds) {
        if (scope.staff()) return "";
        if (propertyIds.isEmpty()) return " and false";
        if (table.equals("properties")) return " and id in (:ids)";
        if (columns.contains("property_id")) return " and property_id in (:ids)";
        if (columns.contains("reservation_id"))
            return " and reservation_id in (select id from reservations where property_id in (:ids))";
        if (columns.contains("conversation_id"))
            return " and conversation_id in (select id from conversations where property_id in (:ids))";
        if (columns.contains("invoice_id"))
            return " and invoice_id in (select id from invoices where reservation_id in "
                + "(select id from reservations where property_id in (:ids)))";
        return null;
    }

    private Map<String, Integer> photos(Writer zip, List<Long> propertyIds, List<String> notes) throws IOException {
        int stored = 0, linked = 0, missing = 0;
        if (!propertyIds.isEmpty()) {
            List<PropertyPhoto> list = em.createQuery("select p from PropertyPhoto p where p.propertyId in :ids order by p.propertyId, p.sortOrder, p.id",
                PropertyPhoto.class).setParameter("ids", propertyIds).getResultList();
            PhotoStorageService storage = photos.getIfAvailable();
            List<Map<String, String>> external = new ArrayList<>();
            for (PropertyPhoto photo : list) {
                byte[] bytes = photo.getData();
                if (bytes == null && photo.getStorageKey() != null && storage != null) {
                    try { bytes = storage.retrieve(photo.getStorageKey()); } catch (RuntimeException e) { bytes = null; }
                }
                if (bytes != null) {
                    String name = Objects.requireNonNullElse(photo.getOriginalFilename(), "photo")
                        .replaceAll("[^A-Za-z0-9._-]", "_");
                    zip.bytes("files/properties/" + photo.getPropertyId() + "/" + photo.getId() + "-" + name, bytes, true);
                    stored++;
                } else if (photo.getExternalUrl() != null) {
                    external.add(Map.of("propertyId", String.valueOf(photo.getPropertyId()), "url", photo.getExternalUrl()));
                    linked++;
                } else missing++;
            }
            if (!external.isEmpty()) zip.bytes("files/external-photos.json", json.writeValueAsBytes(external), true);
        }
        if (missing > 0) notes.add(missing + " photo(s) could not be read from storage; contact support to receive them.");
        return Map.of("stored", stored, "externalLinks", linked, "unreadable", missing);
    }

    private int imports(Writer zip, Scope scope) throws IOException {
        int count = 0;
        for (var summary : batches.findRecent(scope.orgId(), scope.subject(), org.springframework.data.domain.PageRequest.of(0, 200))) {
            var batch = batches.findById(summary.getId()).orElse(null);
            if (batch == null || !Objects.equals(batch.getOrganizationId(), scope.orgId())) continue;
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("id", batch.getId()); body.put("source", batch.getSource());
            body.put("sourceAccount", batch.getSourceAccount()); body.put("status", batch.getStatus());
            body.put("createdAt", batch.getCreatedAt()); body.put("completedAt", batch.getCompletedAt());
            body.put("data", json.readTree(batch.getPayload()));
            zip.bytes("imports/" + batch.getId() + ".json", json.writeValueAsBytes(body), true);
            count++;
        }
        return count;
    }

    private static String schema() {
        return """
            # Export Baitly

            Ce fichier décrit l'archive. Version du schéma : %d.

            - `csv/` : logements, voyageurs, réservations, avis, tarifs par nuit et tâches. Les en-têtes sont
              les clés de champ de l'import Baitly : ces fichiers se réimportent tels quels (source « baitly »)
              et se lisent dans n'importe quel tableur (UTF-8 avec BOM). `sourceId` est l'identifiant Baitly ;
              `propertyRef` et `guestRef` pointent vers `sourceId` des autres fichiers.
            - `json/` : toutes les colonnes des tables opérationnelles, en texte, une ligne par enregistrement.
            - `files/` : photos des logements conservées par Baitly ; `files/external-photos.json` liste celles
              hébergées ailleurs.
            - `imports/` : fichiers d'origine de vos migrations, avec leur empreinte SHA-256.
            - `manifest.json` : volumes, exclusions et SHA-256 de chaque fichier pour vérifier la livraison.

            Exclusions : secrets et identifiants techniques, identifiants de prestataires de paiement, pièces
            d'identité chiffrées (disponibles sur demande, selon les durées légales de conservation).
            """.formatted(SCHEMA_VERSION);
    }

    /** Zip writer that records the size and SHA-256 of every entry for the manifest. */
    static final class Writer implements Closeable {
        private final ZipOutputStream out;
        private final List<Map<String, Object>> inventory = new ArrayList<>();
        Writer(ZipOutputStream out) { this.out = out; }

        void text(String path, String text) throws IOException { bytes(path, text.getBytes(StandardCharsets.UTF_8), true); }

        void bytes(String path, byte[] bytes, boolean listed) throws IOException {
            out.putNextEntry(new ZipEntry(path));
            out.write(bytes);
            out.closeEntry();
            if (listed) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("path", path); entry.put("bytes", bytes.length); entry.put("sha256", sha256(bytes));
                inventory.add(entry);
            }
        }

        List<Map<String, Object>> inventory() { return inventory; }

        @Override public void close() throws IOException { out.close(); }

        static String sha256(byte[] bytes) {
            try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
            catch (Exception e) { throw new IllegalStateException(e); }
        }
    }
}
