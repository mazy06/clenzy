package com.clenzy.service.migration;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.migration.ImportPlan.Kind;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;

@Service
@Transactional
public class PmsImportService {
    public record Actor(Long orgId, String subject, boolean staff) {
        public Actor {
            if (orgId == null || subject == null || subject.isBlank()) throw new AccessDeniedException("IMPORT_TENANT_REQUIRED");
        }
    }
    public record Issue(String documentId, int row, String code) {}
    public record Report(int ready, int duplicates, int archived, int issueCount, List<Issue> issues,
                         Map<String, String> totals, String token, int skipped) {}
    public record DocumentView(String id, String name, List<String> columns, int rowCount,
                               List<Map<String, String>> sample, boolean attachment,
                               List<String> propertyRefs, List<String> unmappedColumns) {}
    public record View(UUID id, String source, String sourceAccount, String status, Instant createdAt,
                       List<DocumentView> documents, List<ImportPlan> plans, Report report) {}
    public record OriginalFile(String name, String sha256, String base64) {}
    public record Payload(List<ImportDocument> documents, List<ImportPlan> plans, Report report, List<OriginalFile> originals) {}
    private record Candidate(ImportDocument document, ImportPlan plan, int row, Map<String, String> values,
                             String key, String fingerprint, boolean duplicate) {}
    private record Inspection(List<Candidate> rows, Map<String, PmsImportBinding> bindings,
                              Map<Long, Property> properties, Report report) {}

    private final PmsImportBatchRepository batches;
    private final PmsImportBindingRepository bindings;
    private final PropertyRepository properties;
    private final GuestRepository guests;
    private final ReservationRepository reservations;
    private final UserRepository users;
    private final CalendarDayRepository days;
    private final CalendarEngine calendar;
    private final PmsExportReader reader;
    private final ObjectMapper json;
    private final GuestReviewRepository reviews;
    private final RateOverrideRepository rates;
    private final InterventionRepository tasks;

    public PmsImportService(PmsImportBatchRepository batches, PmsImportBindingRepository bindings,
                            PropertyRepository properties, GuestRepository guests,
                            ReservationRepository reservations, UserRepository users,
                            CalendarDayRepository days, CalendarEngine calendar,
                            PmsExportReader reader, ObjectMapper json, GuestReviewRepository reviews,
                            RateOverrideRepository rates, InterventionRepository tasks) {
        this.batches = batches; this.bindings = bindings; this.properties = properties; this.guests = guests;
        this.reservations = reservations; this.users = users; this.days = days; this.calendar = calendar;
        this.reader = reader; this.json = json; this.reviews = reviews; this.rates = rates; this.tasks = tasks;
    }

    public View upload(List<MultipartFile> files, String source, String account, String encoding, Actor actor) throws IOException {
        List<ImportDocument> documents = reader.read(files, encoding);
        List<OriginalFile> originals = new ArrayList<>();
        for (MultipartFile file : files) {
            byte[] bytes = file.getBytes();
            originals.add(new OriginalFile(file.getOriginalFilename(), hashBytes(bytes), Base64.getEncoder().encodeToString(bytes)));
        }
        return createDraft(documents, originals, source, account, actor);
    }

    /** Files and API pulls land in the same draft: nothing is written to business tables before commit. */
    public View createDraft(List<ImportDocument> documents, List<OriginalFile> originals, String source,
                            String account, Actor actor) {
        source = required(source, 80).toLowerCase(Locale.ROOT);
        account = required(account, 120);
        if (documents.isEmpty()) throw bad("EMPTY_EXPORT");
        PmsImportBatch batch = new PmsImportBatch();
        batch.setOrganizationId(actor.orgId()); batch.setCreatedBy(actor.subject());
        batch.setSource(source); batch.setSourceAccount(account);
        var profile = PmsVendorProfiles.forSource(source);
        Payload payload = new Payload(documents, documents.stream().map(d -> PmsImportSchema.suggest(d, profile)).toList(),
            null, originals);
        batch.setPayload(write(payload));
        batches.save(batch);
        return view(batch, payload);
    }

    public static OriginalFile original(String name, byte[] bytes) {
        return new OriginalFile(name, hashBytes(bytes), Base64.getEncoder().encodeToString(bytes));
    }

    public View get(UUID id, Actor actor) { var batch = owned(id, actor); return view(batch, read(batch)); }

    public List<Map<String, Object>> recent(Actor actor) {
        return batches.findRecent(actor.orgId(), actor.subject(), org.springframework.data.domain.PageRequest.of(0, 20))
            .stream().map(b -> Map.<String, Object>of("id", b.getId(), "source", b.getSource(),
                "sourceAccount", b.getSourceAccount(), "status", b.getStatus(), "createdAt", b.getCreatedAt())).toList();
    }

    public View validate(UUID id, List<ImportPlan> plans, Actor actor) {
        var batch = owned(id, actor);
        if (!batch.getStatus().equals("DRAFT")) throw bad("BATCH_COMPLETED");
        var payload = read(batch);
        checkPlans(payload.documents(), plans);
        var report = inspect(batch, payload.documents(), plans, actor).report();
        payload = new Payload(payload.documents(), List.copyOf(plans), report, payload.originals());
        batch.setPayload(write(payload));
        return view(batch, payload);
    }

    /** All rows commit atomically; retries are guarded by the batch lock and stable source keys. */
    public View commit(UUID id, String token, Actor actor) {
        var batch = owned(id, actor);
        var payload = read(batch);
        if (payload.report() == null || token == null || !token.equals(payload.report().token())) throw bad("VALIDATE_FIRST");
        if (batch.getStatus().equals("COMPLETED")) return view(batch, payload);
        Inspection inspection = inspect(batch, payload.documents(), payload.plans(), actor);
        if (inspection.report().issueCount() > 0) throw bad("VALIDATION_CHANGED");
        if (inspection.report().ready() != payload.report().ready()
            || inspection.report().duplicates() != payload.report().duplicates()) throw bad("VALIDATION_CHANGED");

        // Lock existing target calendars in a stable order before mutating any row.
        inspection.properties().keySet().stream().sorted().forEach(property -> {
            if (!days.acquirePropertyLock(property)) throw bad("CALENDAR_BUSY");
        });
        Map<String, Long> targets = new HashMap<>();
        inspection.bindings().forEach((key, binding) -> targets.put(key, binding.getTargetId()));
        List<Candidate> sorted = inspection.rows().stream().sorted(Comparator.comparingInt(c -> c.plan().kind().ordinal())).toList();
        for (Candidate row : sorted) {
            if (row.duplicate() || targets.containsKey(row.key())) continue;
            Long target = switch (row.plan().kind()) {
                case PROPERTY -> createProperty(row.values(), actor);
                case GUEST -> createGuest(row.values(), actor);
                case RESERVATION -> createReservation(row, batch, targets, actor);
                case REVIEW -> createReview(row, batch, targets, actor);
                case RATE -> createRate(row, batch, targets, actor);
                case TASK -> createTask(row, batch, targets, actor);
                case ARCHIVE -> throw new IllegalStateException("Archive has no materialized rows");
            };
            targets.put(row.key(), target);
            bindings.save(new PmsImportBinding(actor.orgId(), row.key(), row.fingerprint(), target, batch.getId()));
        }
        batch.setStatus("COMPLETED"); batch.setCompletedAt(Instant.now());
        // Keep the exact approved counts/token, including inert archival records.
        return view(batch, payload);
    }

    public Map<String, Object> export(UUID id, Actor actor) {
        var batch = owned(id, actor);
        return Map.of("schemaVersion", 1, "source", batch.getSource(), "sourceAccount", batch.getSourceAccount(),
            "createdAt", batch.getCreatedAt(), "status", batch.getStatus(), "data", read(batch));
    }

    public void deleteDraft(UUID id, Actor actor) {
        var batch = owned(id, actor);
        if (!batch.getStatus().equals("DRAFT")) throw bad("COMPLETED_BATCH_HAS_PROVENANCE");
        batches.delete(batch);
    }

    private Inspection inspect(PmsImportBatch batch, List<ImportDocument> documents, List<ImportPlan> plans, Actor actor) {
        List<Issue> issues = new ArrayList<>();
        List<Candidate> rows = new ArrayList<>();
        Set<String> keys = new HashSet<>();
        int archived = 0;
        int skipped = 0;
        for (ImportDocument document : documents) {
            ImportPlan plan = plans.stream().filter(p -> p.documentId().equals(document.id())).findFirst().orElseThrow();
            if (plan.kind() == Kind.ARCHIVE) { archived += Math.max(1, document.rows().size()); continue; }
            for (int i = 0; i < document.rows().size(); i++) {
                try {
                    var values = PmsImportSchema.map(document.rows().get(i), plan);
                    if (PmsImportSchema.SKIPPED_STATUS.equals(values.get("status")) && plan.kind() == Kind.RESERVATION) {
                        skipped++;
                        continue;
                    }
                    String key = key(batch, plan.kind(), values.get("sourceId"));
                    String fingerprint = hash(write(List.of(new TreeMap<>(document.rows().get(i)), values,
                        plan.kind().propertyScoped() ? Objects.toString(plan.propertyLinks().get(values.get("propertyRef")), "") : "")));
                    rows.add(new Candidate(document, plan, i + 2, values, key, fingerprint, false));
                    keys.add(key);
                    if (plan.kind().propertyScoped()) keys.add(key(batch, Kind.PROPERTY, values.get("propertyRef")));
                    if (plan.kind() == Kind.RESERVATION && !values.get("guestRef").isBlank())
                        keys.add(key(batch, Kind.GUEST, values.get("guestRef")));
                } catch (IllegalArgumentException e) { issues.add(new Issue(document.id(), i + 2, e.getMessage())); }
            }
        }
        Map<String, PmsImportBinding> known = new HashMap<>();
        if (!keys.isEmpty()) bindings.findByOrganizationIdAndSourceKeyIn(actor.orgId(), keys)
            .forEach(b -> known.put(b.getSourceKey(), b));
        Map<Long, Property> propertyMap = new HashMap<>();
        Map<String, Candidate> seen = new HashMap<>();
        List<Candidate> checked = new ArrayList<>();
        int duplicates = 0;
        for (Candidate row : rows) {
            var existing = known.get(row.key());
            Candidate prior = seen.putIfAbsent(row.key(), row);
            boolean duplicate = existing != null || prior != null;
            String fingerprint = existing != null ? existing.getFingerprint() : prior != null ? prior.fingerprint() : null;
            if (duplicate && !row.fingerprint().equals(fingerprint)) issue(issues, row, "SOURCE_CHANGED");
            if (existing != null && row.plan().kind() == Kind.PROPERTY) property(existing.getTargetId(), actor);
            if (duplicate) duplicates++;
            checked.add(new Candidate(row.document(), row.plan(), row.row(), row.values(), row.key(), row.fingerprint(), duplicate));
        }
        Map<String, BigDecimal> totals = new TreeMap<>();
        Map<String, List<Candidate>> byProperty = new HashMap<>();
        List<Map<String, Object>> ranges = new ArrayList<>();
        for (Candidate row : checked) {
            if (row.duplicate() || !row.plan().kind().propertyScoped()) continue;
            var v = row.values();
            String propertyKey = key(batch, Kind.PROPERTY, v.get("propertyRef"));
            Long propertyId = row.plan().propertyLinks().get(v.get("propertyRef"));
            if (propertyId == null && known.containsKey(propertyKey)) propertyId = known.get(propertyKey).getTargetId();
            if (row.plan().kind() != Kind.RESERVATION) {
                if (propertyId != null) {
                    if (!propertyMap.containsKey(propertyId)) propertyMap.put(propertyId, property(propertyId, actor));
                    checkExisting(row, propertyId, actor, issues);
                } else if (!seen.containsKey(propertyKey)) issue(issues, row, "PROPERTY_LINK_REQUIRED");
                continue;
            }
            String calendarKey = propertyId == null ? propertyKey : propertyId.toString();
            if (propertyId != null) {
                if (!propertyMap.containsKey(propertyId)) propertyMap.put(propertyId, property(propertyId, actor));
                ranges.add(Map.of("row_key", row.key(), "property_id", propertyId,
                    "date_from", v.get("checkIn"), "date_to", v.get("checkOut"), "status", v.get("status"),
                    "confirmation_code", v.get("confirmationCode")));
            } else if (!seen.containsKey(propertyKey)) issue(issues, row, "PROPERTY_LINK_REQUIRED");
            String guestKey = key(batch, Kind.GUEST, v.get("guestRef"));
            if (!v.get("guestRef").isBlank() && !known.containsKey(guestKey) && !seen.containsKey(guestKey))
                issue(issues, row, "GUEST_LINK_REQUIRED");
            if (v.get("status").equals("confirmed")) {
                List<Candidate> overlaps = byProperty.computeIfAbsent(calendarKey, ignored -> new ArrayList<>());
                if (overlaps.stream().anyMatch(other -> v.get("checkIn").compareTo(other.values().get("checkOut")) < 0
                    && v.get("checkOut").compareTo(other.values().get("checkIn")) > 0)) issue(issues, row, "BATCH_OVERLAP");
                overlaps.add(row);
            }
            totals.merge(v.get("currency"), new BigDecimal(v.get("totalPrice")), BigDecimal::add);
        }
        // Existing reservations without an import binding must not be silently duplicated either.
        if (!ranges.isEmpty()) {
            String rangesJson = write(ranges);
            Set<String> occupied = new HashSet<>(days.findPmsImportConflicts(rangesJson, actor.orgId()));
            Set<String> existing = new HashSet<>(reservations.findPmsImportConflicts(rangesJson, actor.orgId()));
            for (Candidate row : checked) {
                if (row.duplicate() || row.plan().kind() != Kind.RESERVATION) continue;
                if (occupied.contains(row.key())) issue(issues, row, "CALENDAR_CONFLICT");
                if (existing.contains(row.key())) issue(issues, row, "EXISTING_RESERVATION");
            }
        }
        Map<String, String> formattedTotals = new TreeMap<>();
        totals.forEach((currency, amount) -> formattedTotals.put(currency, amount.toPlainString()));
        Set<String> invalidRows = new HashSet<>();
        issues.forEach(issue -> invalidRows.add(issue.documentId() + ":" + issue.row()));
        int ready = (int) checked.stream().filter(r -> !r.duplicate()
            && !invalidRows.contains(r.document().id() + ":" + r.row())).count();
        var report = new Report(ready, duplicates, archived, issues.size(),
            issues.stream().limit(100).toList(), formattedTotals, hash(write(plans)), skipped);
        return new Inspection(checked, known, propertyMap, report);
    }

    private Long createProperty(Map<String, String> v, Actor actor) {
        User owner = users.findByKeycloakId(actor.subject()).filter(u -> Objects.equals(u.getOrganizationId(), actor.orgId()))
            .orElseThrow(() -> new AccessDeniedException("IMPORT_OWNER_REQUIRED"));
        var property = new Property(v.get("name"), v.get("address"), Integer.valueOf(v.get("bedrooms")),
            Integer.valueOf(v.get("bathrooms")), owner);
        property.setOrganizationId(actor.orgId()); property.setTimezone(v.get("timezone"));
        property.setDefaultCurrency(v.get("currency")); property.setType(PropertyType.valueOf(v.get("type")));
        property.setCity(v.get("city")); property.setCountryCode(v.get("countryCode"));
        property.setDescription(v.get("description"));
        property.setBookingEngineVisible(false);
        return properties.save(property).getId();
    }

    private Long createGuest(Map<String, String> v, Actor actor) {
        var guest = new Guest(v.get("firstName"), v.get("lastName"), actor.orgId());
        guest.setEmail(emptyNull(v.get("email"))); guest.setPhone(emptyNull(v.get("phone")));
        guest.setCountryCode(emptyNull(v.get("countryCode"))); guest.setNotes(emptyNull(v.get("notes")));
        guest.setPhoneHash(com.clenzy.util.StringUtils.computePhoneHash(guest.getPhone(), guest.getCountryCode()));
        if (!v.get("language").isBlank()) guest.setLanguage(v.get("language"));
        guest.setChannel(GuestChannel.OTHER);
        return guests.save(guest).getId();
    }

    private Long createReservation(Candidate row, PmsImportBatch batch, Map<String, Long> targets, Actor actor) {
        var v = row.values();
        Long propertyId = row.plan().propertyLinks().get(v.get("propertyRef"));
        if (propertyId == null) propertyId = targets.get(key(batch, Kind.PROPERTY, v.get("propertyRef")));
        Property property = property(propertyId, actor);
        var reservation = new Reservation(property, v.get("guestName"), LocalDate.parse(v.get("checkIn")),
            LocalDate.parse(v.get("checkOut")), v.get("status"), v.get("source"));
        reservation.setOrganizationId(actor.orgId()); reservation.setMigrationAutomationPaused(true);
        reservation.setExternalUid("baitly-import:" + row.key());
        reservation.setSourceName(batch.getSource()); reservation.setCurrency(v.get("currency"));
        reservation.setTotalPrice(new BigDecimal(v.get("totalPrice")));
        reservation.setGuestCount(v.get("guestCount").isBlank() ? 1 : Integer.valueOf(v.get("guestCount")));
        reservation.setConfirmationCode(emptyNull(v.get("confirmationCode")));
        reservation.setNotes(emptyNull(v.get("notes")));
        if (!v.get("cleaningFee").isBlank()) reservation.setCleaningFee(new BigDecimal(v.get("cleaningFee")));
        if (!v.get("touristTax").isBlank()) reservation.setTouristTaxAmount(new BigDecimal(v.get("touristTax")));
        if (!v.get("taxes").isBlank()) reservation.setTaxAmount(new BigDecimal(v.get("taxes")));
        if (!v.get("guestRef").isBlank()) {
            Long guestId = targets.get(key(batch, Kind.GUEST, v.get("guestRef")));
            reservation.setGuest(guests.findByIdAndOrganizationId(guestId, actor.orgId())
                .orElseThrow(() -> bad("GUEST_LINK_REQUIRED")));
        }
        if (!v.get("amountPaid").isBlank()) {
            BigDecimal paid = new BigDecimal(v.get("amountPaid"));
            reservation.setAmountPaid(paid); reservation.setAmountDue(reservation.getTotalPrice().subtract(paid));
            reservation.setPaymentStatus(paid.compareTo(reservation.getTotalPrice()) == 0 ? PaymentStatus.PAID
                : paid.signum() > 0 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.PENDING);
        }
        // No synthetic paidAt/cancelledAt: source history remains available in the original record.
        reservations.save(reservation);
        if (reservation.getStatus().equals("confirmed")) calendar.importReservation(reservation, actor.subject());
        return reservation.getId();
    }

    /** Rows that would collide with data already in Baitly are reported, never overwritten. */
    private void checkExisting(Candidate row, Long propertyId, Actor actor, List<Issue> issues) {
        var v = row.values();
        switch (row.plan().kind()) {
            case RATE -> {
                if (rates.findByPropertyIdAndDate(propertyId, LocalDate.parse(v.get("date")), actor.orgId()).isPresent())
                    issue(issues, row, "RATE_EXISTS");
            }
            case REVIEW -> {
                if (reviews.findByExternalReviewIdAndOrganizationId(reviewId(row), actor.orgId()).isPresent())
                    issue(issues, row, "REVIEW_EXISTS");
            }
            default -> { }
        }
    }

    private Long resolveProperty(Candidate row, PmsImportBatch batch, Map<String, Long> targets) {
        Long propertyId = row.plan().propertyLinks().get(row.values().get("propertyRef"));
        return propertyId != null ? propertyId : targets.get(key(batch, Kind.PROPERTY, row.values().get("propertyRef")));
    }

    private static String reviewId(Candidate row) { return "baitly-import:" + row.key(); }

    /** Imported as history: no sentiment analysis, response draft or channel push is triggered. */
    private Long createReview(Candidate row, PmsImportBatch batch, Map<String, Long> targets, Actor actor) {
        var v = row.values();
        Property property = property(resolveProperty(row, batch, targets), actor);
        var review = new GuestReview();
        review.setOrganizationId(actor.orgId()); review.setPropertyId(property.getId());
        review.setChannelName(com.clenzy.integration.channel.ChannelName.valueOf(v.get("channel")));
        review.setGuestName(emptyNull(v.get("guestName"))); review.setRating(Integer.valueOf(v.get("rating")));
        review.setReviewText(emptyNull(v.get("text"))); review.setHostResponse(emptyNull(v.get("response")));
        review.setReviewDate(LocalDate.parse(v.get("reviewDate"))); review.setExternalReviewId(reviewId(row));
        return reviews.save(review).getId();
    }

    private Long createRate(Candidate row, PmsImportBatch batch, Map<String, Long> targets, Actor actor) {
        var v = row.values();
        Property property = property(resolveProperty(row, batch, targets), actor);
        var rate = new RateOverride(property, LocalDate.parse(v.get("date")), new BigDecimal(v.get("price")),
            "PMS_IMPORT", actor.orgId());
        rate.setCurrency(v.get("currency")); rate.setCreatedBy(actor.subject());
        return rates.save(rate).getId();
    }

    /** Tasks keep their source status; no assignment, notification or payment flow is started. */
    private Long createTask(Candidate row, PmsImportBatch batch, Map<String, Long> targets, Actor actor) {
        var v = row.values();
        Property property = property(resolveProperty(row, batch, targets), actor);
        User requestor = users.findByKeycloakId(actor.subject()).filter(u -> Objects.equals(u.getOrganizationId(), actor.orgId()))
            .orElseThrow(() -> new AccessDeniedException("IMPORT_OWNER_REQUIRED"));
        var task = new Intervention();
        task.setOrganizationId(actor.orgId()); task.setProperty(property); task.setRequestor(requestor);
        task.setTitle(v.get("title")); task.setType(v.get("type")); task.setDescription(emptyNull(v.get("notes")));
        task.setStatus(InterventionStatus.valueOf(v.get("status")));
        LocalTime time = LocalTime.of(11, 0);
        try { if (property.getDefaultCheckOutTime() != null) time = LocalTime.parse(property.getDefaultCheckOutTime()); }
        catch (java.time.format.DateTimeParseException ignored) { /* keep the conventional check-out hour */ }
        LocalDateTime start = LocalDate.parse(v.get("date")).atTime(time);
        task.setStartTime(start); task.setScheduledDate(start);
        if (task.getStatus() == InterventionStatus.COMPLETED) task.setCompletedAt(start);
        task.setNotes("Importé depuis " + batch.getSource());
        return tasks.save(task).getId();
    }

    private Property property(Long id, Actor actor) {
        if (id == null) throw bad("PROPERTY_LINK_REQUIRED");
        Property property = properties.findByIdWithOwner(id, actor.orgId())
            .orElseThrow(() -> new AccessDeniedException("IMPORT_PROPERTY_ACCESS"));
        if (!Objects.equals(property.getOrganizationId(), actor.orgId()) || (!actor.staff()
            && (property.getOwner() == null || !actor.subject().equals(property.getOwner().getKeycloakId()))))
            throw new AccessDeniedException("IMPORT_PROPERTY_ACCESS");
        return property;
    }

    private PmsImportBatch owned(UUID id, Actor actor) {
        var batch = batches.lockByIdAndOrg(id, actor.orgId()).orElseThrow(() -> new AccessDeniedException("IMPORT_BATCH_ACCESS"));
        if (!actor.subject().equals(batch.getCreatedBy())) throw new AccessDeniedException("IMPORT_BATCH_ACCESS");
        return batch;
    }

    private void checkPlans(List<ImportDocument> documents, List<ImportPlan> plans) {
        if (plans == null || plans.size() != documents.size()
            || plans.stream().map(ImportPlan::documentId).distinct().count() != documents.size()) throw bad("PLANS_REQUIRED");
        for (ImportDocument document : documents) {
            var plan = plans.stream().filter(p -> document.id().equals(p.documentId())).findFirst().orElseThrow(() -> bad("PLAN_MISSING"));
            if (plan.kind() == null || plan.fields() == null || plan.defaults() == null || plan.propertyLinks() == null
                || !Set.of("ISO", "DMY", "MDY", "EXCEL_1900").contains(plan.dateFormat())
                || !Set.of(".", ",").contains(plan.decimalSeparator())) throw bad("PLAN_INVALID");
            if (document.attachmentBase64() != null && plan.kind() != Kind.ARCHIVE) throw bad("ATTACHMENT_ARCHIVE_ONLY");
            Set<String> allowed = new HashSet<>();
            PmsImportSchema.FIELDS.get(plan.kind()).forEach(f -> allowed.add(f.key()));
            if (!allowed.containsAll(plan.fields().keySet()) || !allowed.containsAll(plan.defaults().keySet())
                || plan.fields().values().stream().anyMatch(c -> !document.columns().contains(c))) throw bad("MAPPING_INVALID");
            if (plan.propertyLinks().size() > PmsExportReader.MAX_ROWS || plan.defaults().values().stream().anyMatch(Objects::isNull))
                throw bad("MAPPING_INVALID");
        }
    }

    private View view(PmsImportBatch batch, Payload payload) {
        List<DocumentView> documents = payload.documents().stream().map(document -> {
            ImportPlan plan = payload.plans().stream().filter(p -> p.documentId().equals(document.id())).findFirst().orElseThrow();
            String propertyColumn = plan.fields().get("propertyRef");
            List<String> refs = !plan.kind().propertyScoped() ? List.of() : document.rows().stream()
                .map(r -> propertyColumn == null ? plan.defaults().getOrDefault("propertyRef", "") : r.getOrDefault(propertyColumn, ""))
                .map(String::trim).filter(s -> !s.isBlank()).distinct().sorted().toList();
            return new DocumentView(document.id(), document.name(), document.columns(), document.rows().size(),
                document.rows().stream().limit(5).map(row -> {
                    Map<String, String> sample = new LinkedHashMap<>();
                    row.forEach((key, value) -> sample.put(key, value.length() > 240 ? value.substring(0, 240) + "…" : value));
                    return sample;
                }).toList(), document.attachmentBase64() != null, refs,
                document.columns().stream().filter(c -> !plan.fields().containsValue(c)).toList());
        }).toList();
        return new View(batch.getId(), batch.getSource(), batch.getSourceAccount(), batch.getStatus(), batch.getCreatedAt(),
            documents, payload.plans(), payload.report());
    }

    private Payload read(PmsImportBatch batch) {
        try { return json.readValue(batch.getPayload(), Payload.class); }
        catch (IOException e) { throw new IllegalStateException("IMPORT_PAYLOAD_UNREADABLE"); }
    }
    private String write(Object value) {
        try { return json.writeValueAsString(value); }
        catch (IOException e) { throw new IllegalStateException("IMPORT_PAYLOAD_UNWRITABLE"); }
    }
    private String key(PmsImportBatch batch, Kind kind, String id) {
        return hash(write(List.of(batch.getOrganizationId(), batch.getSource(), batch.getSourceAccount(), kind, id)));
    }
    private static String hash(String value) {
        return hashBytes(value.getBytes(StandardCharsets.UTF_8));
    }
    private static String hashBytes(byte[] value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value)); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
    private static String required(String text, int max) {
        if (text == null || text.isBlank() || text.length() > max) throw bad("SOURCE_REQUIRED");
        return text.trim();
    }
    private static String emptyNull(String value) { return value.isBlank() ? null : value; }
    private static void issue(List<Issue> issues, Candidate row, String code) { issues.add(new Issue(row.document().id(), row.row(), code)); }
    private static IllegalArgumentException bad(String message) { return new IllegalArgumentException(message); }
}
