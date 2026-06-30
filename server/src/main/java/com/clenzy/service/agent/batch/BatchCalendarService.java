package com.clenzy.service.agent.batch;

import com.clenzy.exception.CalendarConflictException;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.CalendarEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

/**
 * Opérations batch sur le calendrier (P2-12) — agent {@code ops}.
 *
 * <p>Blocage d'une plage de dates sur <b>plusieurs logements</b> avec les garde-fous
 * validés : <b>preview obligatoire</b> (dry-run, aucun write) → <b>token</b> qui
 * verrouille le périmètre exact previewé → <b>apply</b> borné, <b>ownership revalidé
 * par item</b>, conflits (jours bookés) <b>ignorés sans casser le lot</b>. Aucune
 * action monétaire.</p>
 *
 * <p>Le blocage unitaire passe par {@link CalendarEngine#block} (guard ownership
 * règle audit #3 + {@link CalendarConflictException} atomique — pas de check-then-act).</p>
 */
@Service
public class BatchCalendarService {

    private static final Logger log = LoggerFactory.getLogger(BatchCalendarService.class);
    private static final int MAX_PROPERTIES = 50;
    private static final String SOURCE = "ASSISTANT_BATCH";

    private final PropertyRepository propertyRepository;
    private final CalendarEngine calendarEngine;
    private final Clock clock;

    public BatchCalendarService(PropertyRepository propertyRepository,
                                CalendarEngine calendarEngine,
                                Clock clock) {
        this.propertyRepository = propertyRepository;
        this.calendarEngine = calendarEngine;
        this.clock = clock;
    }

    public record PreviewItem(Long propertyId, String propertyName, String status,
                              int daysToBlock, int conflictDays) {}

    public record BatchPreview(String from, String to, int properties, int totalDaysToBlock,
                               int propertiesWithConflict, List<PreviewItem> items,
                               String confirmationToken, String headline) {}

    public record ApplyItem(Long propertyId, String propertyName, String result,
                            int daysBlocked, String detail) {}

    public record BatchApplyResult(String from, String to, int applied, int skipped,
                                   List<ApplyItem> items, String headline) {}

    // ─── PREVIEW (read-only) ────────────────────────────────────────────────

    public BatchPreview preview(Long orgId, List<Long> propertyIds, LocalDate from, LocalDate to, String notes) {
        validate(propertyIds, from, to);
        int totalDays = (int) (ChronoUnit.DAYS.between(from, to) + 1);

        List<PreviewItem> items = new ArrayList<>();
        int totalToBlock = 0;
        int conflicts = 0;
        for (Long id : new TreeSet<>(propertyIds)) {
            Property p = ownedProperty(id, orgId);
            if (p == null) {
                items.add(new PreviewItem(id, null, "DENIED", 0, 0));
                continue;
            }
            Map<LocalDate, CalendarDayStatus> status = statusMap(id, from, to, orgId);
            int booked = (int) status.values().stream().filter(s -> s == CalendarDayStatus.BOOKED).count();
            int blocked = (int) status.values().stream()
                    .filter(s -> s == CalendarDayStatus.BLOCKED || s == CalendarDayStatus.MAINTENANCE).count();
            if (booked > 0) {
                conflicts++;
                items.add(new PreviewItem(id, p.getName(), "CONFLICT", 0, booked));
            } else {
                int toBlock = Math.max(0, totalDays - blocked);
                totalToBlock += toBlock;
                items.add(new PreviewItem(id, p.getName(), "OK", toBlock, 0));
            }
        }

        String token = token(propertyIds, from, to, notes);
        return new BatchPreview(from.toString(), to.toString(), items.size(), totalToBlock,
                conflicts, items, token, previewHeadline(totalToBlock, items.size(), conflicts));
    }

    // ─── APPLY (write, token requis) ────────────────────────────────────────

    public BatchApplyResult apply(Long orgId, String keycloakId, List<Long> propertyIds,
                                  LocalDate from, LocalDate to, String notes, String confirmationToken) {
        validate(propertyIds, from, to);
        if (confirmationToken == null || !confirmationToken.equals(token(propertyIds, from, to, notes))) {
            throw new IllegalArgumentException(
                    "Token de confirmation invalide ou absent : lancez d'abord 'preview_batch_block_calendar' "
                            + "sur le même périmètre et confirmez avec le token retourné.");
        }

        List<ApplyItem> items = new ArrayList<>();
        int applied = 0;
        int skipped = 0;
        for (Long id : new TreeSet<>(propertyIds)) {
            Property p = ownedProperty(id, orgId);
            if (p == null) {
                skipped++;
                items.add(new ApplyItem(id, null, "SKIPPED", 0, "DENIED"));
                continue;
            }
            try {
                // CalendarEngine.block traite 'to' comme EXCLUSIF ; les schémas/preview annoncent
                // une plage INCLUSIVE → +1 jour pour bloquer aussi la dernière nuit.
                List<CalendarDay> days = calendarEngine.block(id, from, to.plusDays(1), orgId, SOURCE, notes, keycloakId);
                applied++;
                items.add(new ApplyItem(id, p.getName(), "APPLIED", days.size(), null));
            } catch (CalendarConflictException e) {
                skipped++;
                items.add(new ApplyItem(id, p.getName(), "SKIPPED", 0, "CONFLICT"));
            } catch (Exception e) {
                log.warn("Batch block échec property {} : {}", id, e.getMessage());
                skipped++;
                items.add(new ApplyItem(id, p.getName(), "SKIPPED", 0, "ERROR"));
            }
        }
        return new BatchApplyResult(from.toString(), to.toString(), applied, skipped, items,
                applied + " logement(s) bloqué(s), " + skipped + " ignoré(s).");
    }

    // ─── helpers ────────────────────────────────────────────────────────────

    private void validate(List<Long> propertyIds, LocalDate from, LocalDate to) {
        if (propertyIds == null || propertyIds.isEmpty()) {
            throw new IllegalArgumentException("propertyIds est requis (liste non vide)");
        }
        if (propertyIds.size() > MAX_PROPERTIES) {
            throw new IllegalArgumentException("Trop de logements (" + propertyIds.size()
                    + ") — maximum " + MAX_PROPERTIES + " par lot.");
        }
        if (from == null || to == null) {
            throw new IllegalArgumentException("from et to sont requis");
        }
        if (from.isAfter(to)) {
            throw new IllegalArgumentException("from doit être <= to");
        }
        if (from.isBefore(LocalDate.now(clock).minusDays(1))) {
            throw new IllegalArgumentException("Impossible de bloquer une date passée");
        }
    }

    /** Ownership règle audit #3 : findById contourne le filtre Hibernate → vérifier l'org. */
    private Property ownedProperty(Long id, Long orgId) {
        Property p = propertyRepository.findById(id).orElse(null);
        if (p == null || p.getOrganizationId() == null || !p.getOrganizationId().equals(orgId)) {
            return null;
        }
        return p;
    }

    private Map<LocalDate, CalendarDayStatus> statusMap(Long propertyId, LocalDate from, LocalDate to, Long orgId) {
        Map<LocalDate, CalendarDayStatus> map = new HashMap<>();
        for (CalendarDay d : calendarEngine.getDays(propertyId, from, to, orgId)) {
            if (d.getDate() != null) {
                map.put(d.getDate(), d.getStatus());
            }
        }
        return map;
    }

    /** Token déterministe du périmètre (ids triés + dates + notes) — verrouille le preview. */
    private static String token(List<Long> propertyIds, LocalDate from, LocalDate to, String notes) {
        String canonical = new TreeSet<>(propertyIds) + "|" + from + "|" + to + "|" + (notes == null ? "" : notes);
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(canonical.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 8; i++) {
                sb.append(String.format("%02x", hash[i]));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Hash indisponible", e);
        }
    }

    private static String previewHeadline(int totalToBlock, int count, int conflicts) {
        StringBuilder sb = new StringBuilder();
        sb.append(totalToBlock).append(" nuit(s) à bloquer sur ").append(count).append(" logement(s)");
        if (conflicts > 0) {
            sb.append(" — ").append(conflicts).append(" en conflit (jours déjà réservés, ignorés)");
        }
        sb.append(". Confirmez avec le token pour appliquer.");
        return sb.toString();
    }
}
