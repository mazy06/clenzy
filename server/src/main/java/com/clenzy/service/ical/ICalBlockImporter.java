package com.clenzy.service.ical;

import com.clenzy.dto.ICalImportDto.ICalEventPreview;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.CalendarEngine.BlockReconcileResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Reconcilie les blocages d'un feed iCal (ex: "Airbnb (Not available)", "Blocked")
 * vers le calendrier Clenzy : chaque plage indisponible cote OTA devient un
 * {@code CalendarDay} en statut BLOCKED, visible au planning ET respecte par le
 * booking engine Clenzy (anti double-booking).
 *
 * <p>Symetrique de {@link ICalReservationImporter} (qui gere les vraies reservations) :
 * la separation reservation / blocage est faite en amont par le type d'evenement
 * ("reservation" vs "blocked") produit par {@code ICalEventParser}.</p>
 *
 * <p>La mutation du calendrier passe par {@link CalendarEngine#reconcileImportedBlocks}
 * (invariant : toute ecriture calendrier passe par le moteur) : add idempotent,
 * jours BOOKED preserves, et liberation des blocages de CE feed disparus du flux.</p>
 */
@Component
public class ICalBlockImporter {

    private static final Logger log = LoggerFactory.getLogger(ICalBlockImporter.class);

    /**
     * Horizon de liberation des blocages disparus. Les blocages OTA d'une location
     * courte duree portent rarement au-dela de ~1 an ; 24 mois couvre largement les
     * carnets ouverts tout en bornant le scan. Les blocages declares au-dela sont
     * tout de meme appliques (la fenetre s'etend jusqu'a la date la plus lointaine).
     */
    private static final int RELEASE_HORIZON_MONTHS = 24;

    private final CalendarEngine calendarEngine;

    public ICalBlockImporter(CalendarEngine calendarEngine) {
        this.calendarEngine = calendarEngine;
    }

    /**
     * Reconcilie les evenements de type "blocked" du feed vers des CalendarDay BLOCKED.
     *
     * <p>Garde-fou anti-purge (calque sur {@link ICalOrphanDetector}) : si le feed ne
     * declare AUCUN blocage futur, on ne libere rien — un flux transitoirement tronque
     * ne doit pas effacer des blocages legitimes. La levee d'un blocage reellement
     * retire de l'OTA est prise en compte des qu'il reste au moins un blocage dans le
     * feed (cas normal d'un calendrier partiellement debloque).</p>
     */
    public void importBlocks(ICalImportSession session, List<ICalEventPreview> blockedEvents) {
        try {
            LocalDate today = LocalDate.now();
            Set<LocalDate> blockedDates = expandFutureBlockedDates(blockedEvents, today);

            if (blockedDates.isEmpty()) {
                // Aucun blocage futur dans le feed : on ne touche pas aux blocages existants
                // (le feed peut etre tronque ; la liberation reste manuelle dans ce cas).
                log.debug("iCal blocks feed #{}: aucun blocage futur — calendrier inchange", session.feed.getId());
                return;
            }

            LocalDate maxBlocked = blockedDates.stream().max(LocalDate::compareTo).orElse(today);
            LocalDate horizon = today.plusMonths(RELEASE_HORIZON_MONTHS);
            LocalDate to = maxBlocked.isAfter(horizon) ? maxBlocked.plusDays(1) : horizon.plusDays(1);

            String source = blockSource(session);
            BlockReconcileResult result = calendarEngine.reconcileImportedBlocks(
                    session.property.getId(), today, to, blockedDates, session.orgId, source, "ical-sync");

            session.blocksApplied += result.blocked();
            session.blocksReleased += result.released();
            if (result.blocked() > 0 || result.released() > 0) {
                log.info("iCal blocks feed #{}: {} jour(s) bloque(s), {} jour(s) libere(s)",
                        session.feed.getId(), result.blocked(), result.released());
            }
        } catch (Exception e) {
            // Pas un swallow : compte dans le resultat de sync (statut PARTIAL).
            log.warn("Erreur reconciliation blocages iCal feed #{}: {}", session.feed.getId(), e.getMessage());
            session.errors.add("Reconciliation blocages: " + e.getMessage());
        }
    }

    /**
     * Etend les evenements bloques en l'ensemble des dates indisponibles (jour par jour),
     * sur [dtStart, dtEnd) — dtEnd exclusif comme un checkout. Les jours passes sont
     * exclus (on ne bloque pas l'historique).
     */
    private static Set<LocalDate> expandFutureBlockedDates(List<ICalEventPreview> blockedEvents, LocalDate today) {
        Set<LocalDate> dates = new HashSet<>();
        for (ICalEventPreview event : blockedEvents) {
            LocalDate start = event.getDtStart();
            if (start == null) {
                continue;
            }
            LocalDate end = event.getDtEnd() != null ? event.getDtEnd() : start.plusDays(1);
            for (LocalDate date = start; date.isBefore(end); date = date.plusDays(1)) {
                if (!date.isBefore(today)) {
                    dates.add(date);
                }
            }
        }
        return dates;
    }

    /** Source attribuee aux blocages de ce feed (cle de liberation des blocages disparus). */
    private static String blockSource(ICalImportSession session) {
        return "ICAL:" + session.feed.getId();
    }
}
