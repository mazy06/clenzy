package com.clenzy.service.migration;

import com.clenzy.model.PmsMigrationPlan;
import com.clenzy.repository.PmsImportBatchRepository;
import com.clenzy.repository.PmsMigrationPlanRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Cutover checklist. Deadlines derive from the contract end date the host enters: the notice must be sent
 * {@code noticeDays} before it, and every export should be done a week before access ends, because most
 * PMS cut access (or delete data) as soon as the account closes.
 */
@Service
@Transactional
public class PmsMigrationPlanService {
    /** Ordered steps. IMPORT_COMMITTED is derived from completed import batches, never ticked by hand. */
    public static final List<String> STEPS = List.of(
        "EXPORT_RESERVATIONS", "EXPORT_GUESTS", "EXPORT_FINANCE", "EXPORT_REVIEWS", "EXPORT_MESSAGES_FILES",
        "IMPORT_COMMITTED", "TOTALS_RECONCILED", "NOTICE_SENT", "OTA_DISCONNECTED_OLD", "OTA_CONNECTED_BAITLY",
        "OLD_PMS_CLOSED");
    static final int EXPORT_BUFFER_DAYS = 7;

    public record Step(String key, boolean done, boolean derived) {}
    public record View(String sourcePms, LocalDate contractEndDate, Integer noticeDays, LocalDate noticeDeadline,
                       LocalDate exportDeadline, Long daysUntilExportDeadline, List<Step> steps, String nextStep,
                       Instant updatedAt) {}
    public record Update(String sourcePms, LocalDate contractEndDate, Integer noticeDays, Map<String, Boolean> checklist) {}

    private final PmsMigrationPlanRepository plans;
    private final PmsImportBatchRepository batches;
    private final ObjectMapper json;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public PmsMigrationPlanService(PmsMigrationPlanRepository plans, PmsImportBatchRepository batches, ObjectMapper json) {
        this(plans, batches, json, Clock.systemUTC());
    }

    PmsMigrationPlanService(PmsMigrationPlanRepository plans, PmsImportBatchRepository batches, ObjectMapper json, Clock clock) {
        this.plans = plans; this.batches = batches; this.json = json; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public View get(PmsImportService.Actor actor) {
        return view(plans.findByOrganizationIdAndCreatedBy(actor.orgId(), actor.subject()).orElse(null), actor);
    }

    public View save(Update update, PmsImportService.Actor actor) {
        if (update == null) throw new IllegalArgumentException("PLAN_INVALID");
        if (update.sourcePms() != null && update.sourcePms().length() > 80) throw new IllegalArgumentException("PLAN_INVALID");
        if (update.noticeDays() != null && (update.noticeDays() < 0 || update.noticeDays() > 730))
            throw new IllegalArgumentException("PLAN_INVALID");
        Map<String, Boolean> checklist = new TreeMap<>();
        if (update.checklist() != null) update.checklist().forEach((key, done) -> {
            if (!STEPS.contains(key) || "IMPORT_COMMITTED".equals(key) || done == null) throw new IllegalArgumentException("PLAN_INVALID");
            if (done) checklist.put(key, true);
        });
        PmsMigrationPlan plan = plans.findByOrganizationIdAndCreatedBy(actor.orgId(), actor.subject()).orElseGet(() -> {
            PmsMigrationPlan created = new PmsMigrationPlan();
            created.setOrganizationId(actor.orgId()); created.setCreatedBy(actor.subject());
            return created;
        });
        plan.setSourcePms(update.sourcePms() == null || update.sourcePms().isBlank() ? null : update.sourcePms().trim());
        plan.setContractEndDate(update.contractEndDate());
        plan.setNoticeDays(update.noticeDays());
        plan.setChecklist(write(checklist));
        plan.setUpdatedAt(Instant.now(clock));
        return view(plans.save(plan), actor);
    }

    private View view(PmsMigrationPlan plan, PmsImportService.Actor actor) {
        Map<String, Boolean> ticked = plan == null ? Map.of() : read(plan.getChecklist());
        boolean imported = batches.existsByOrganizationIdAndCreatedByAndStatus(actor.orgId(), actor.subject(), "COMPLETED");
        List<Step> steps = STEPS.stream().map(key -> "IMPORT_COMMITTED".equals(key)
            ? new Step(key, imported, true) : new Step(key, Boolean.TRUE.equals(ticked.get(key)), false)).toList();
        LocalDate end = plan == null ? null : plan.getContractEndDate();
        Integer notice = plan == null ? null : plan.getNoticeDays();
        LocalDate noticeDeadline = end == null || notice == null ? null : end.minusDays(notice);
        LocalDate exportDeadline = end == null ? null : end.minusDays(EXPORT_BUFFER_DAYS);
        Long daysLeft = exportDeadline == null ? null : ChronoUnit.DAYS.between(LocalDate.now(clock), exportDeadline);
        String next = steps.stream().filter(s -> !s.done()).map(Step::key).findFirst().orElse(null);
        return new View(plan == null ? null : plan.getSourcePms(), end, notice, noticeDeadline, exportDeadline, daysLeft,
            steps, next, plan == null ? null : plan.getUpdatedAt());
    }

    private Map<String, Boolean> read(String value) {
        try { return json.readValue(value, new TypeReference<Map<String, Boolean>>() {}); }
        catch (IOException e) { return Map.of(); }
    }

    private String write(Object value) {
        try { return json.writeValueAsString(value); }
        catch (IOException e) { throw new IllegalStateException("PLAN_UNWRITABLE"); }
    }
}
