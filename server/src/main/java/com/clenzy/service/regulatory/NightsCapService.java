package com.clenzy.service.regulatory;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.RegulatoryConfig;
import com.clenzy.model.RegulatoryConfig.RegulatoryType;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.RegulatoryConfigRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.NotificationService;
import com.clenzy.service.RegulatoryComplianceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Plafond annuel de nuitees d'une residence principale louee en meuble de tourisme
 * (France, Code du tourisme L324-1-1 IV : 120 nuits par an, abaissable par la commune).
 *
 * <p><b>Doctrine (decision produit 2026-10-01).</b> Le plafond n'est jamais un refus
 * silencieux : un humain peut DEROGER, mais l'organisation en est toujours prevenue.</p>
 * <ul>
 *   <li>Saisie manuelle au-dela du plafond : refusee sauf derogation explicite,
 *       qui notifie les gestionnaires.</li>
 *   <li>Moteur de reservation : les dates qui feraient depasser le plafond ne sont
 *       pas vendables (aucun humain n'est la pour deroger en direct).</li>
 *   <li>Canaux (OTA, iCal) : impossible de refuser — la reservation est acceptee,
 *       l'organisation est prevenue et l'agent Conformite propose de fermer le calendrier.</li>
 * </ul>
 *
 * <p>Seule une regle {@code ALUR_120_DAYS} ACTIVE declenche quoi que ce soit : sans elle,
 * aucun plafond n'est presume (un logement secondaire n'en a pas).</p>
 */
@Service
public class NightsCapService {

    private static final Logger log = LoggerFactory.getLogger(NightsCapService.class);

    /** Source des jours fermes par le plafond — distingue ces blocages des blocages manuels. */
    public static final String CALENDAR_SOURCE = "REGULATORY_CAP";

    private final RegulatoryConfigRepository configRepository;
    private final RegulatoryComplianceService complianceService;
    private final CalendarDayRepository calendarDayRepository;
    private final CalendarEngine calendarEngine;
    private final NotificationService notificationService;

    public NightsCapService(RegulatoryConfigRepository configRepository,
                            RegulatoryComplianceService complianceService,
                            CalendarDayRepository calendarDayRepository,
                            CalendarEngine calendarEngine,
                            NotificationService notificationService) {
        this.configRepository = configRepository;
        this.complianceService = complianceService;
        this.calendarDayRepository = calendarDayRepository;
        this.calendarEngine = calendarEngine;
        this.notificationService = notificationService;
    }

    /** Une annee civile depassee par un sejour envisage. */
    public record YearOverrun(int year, int rentedNights, int newNights, int maxNights) {
        public int excess() {
            return rentedNights + newNights - maxNights;
        }
    }

    /** Plafond actif du logement, s'il en a un. */
    public Optional<Integer> activeCap(Long propertyId, Long orgId) {
        return configRepository.findByPropertyAndType(propertyId, RegulatoryType.ALUR_120_DAYS, orgId)
                .filter(c -> Boolean.TRUE.equals(c.getIsEnabled()))
                .map(RegulatoryConfig::getMaxDaysPerYear)
                .map(max -> max == null ? 120 : max);
    }

    /**
     * Annees que le sejour {@code [checkIn, checkOut)} ferait depasser. Vide si le logement
     * n'a pas de plafond actif ou si le sejour tient dans le plafond de chaque annee.
     */
    public List<YearOverrun> overruns(Long propertyId, Long orgId, LocalDate checkIn, LocalDate checkOut) {
        if (propertyId == null || checkIn == null || checkOut == null || !checkOut.isAfter(checkIn)) {
            return List.of();
        }
        Optional<Integer> cap = activeCap(propertyId, orgId);
        if (cap.isEmpty()) {
            return List.of();
        }
        List<YearOverrun> out = new ArrayList<>();
        for (int year = checkIn.getYear(); year <= checkOut.minusDays(1).getYear(); year++) {
            LocalDate from = LocalDate.of(year, 1, 1);
            int newNights = RegulatoryComplianceService.overlapNights(checkIn, checkOut, from, from.plusYears(1));
            int rented = complianceService.rentedNightsInYear(propertyId, orgId, year);
            if (rented + newNights > cap.get()) {
                out.add(new YearOverrun(year, rented, newNights, cap.get()));
            }
        }
        return out;
    }

    /**
     * Depassements CONSTATES sur les annees que touche un sejour deja enregistre (import
     * d'un canal) : la reservation compte deja dans les nuits louees, on compare donc le
     * total au plafond sans rien y ajouter.
     */
    public List<YearOverrun> existingOverruns(Long propertyId, Long orgId, LocalDate checkIn, LocalDate checkOut) {
        if (propertyId == null || checkIn == null || checkOut == null || !checkOut.isAfter(checkIn)) {
            return List.of();
        }
        Optional<Integer> cap = activeCap(propertyId, orgId);
        if (cap.isEmpty()) {
            return List.of();
        }
        List<YearOverrun> out = new ArrayList<>();
        for (int year = checkIn.getYear(); year <= checkOut.minusDays(1).getYear(); year++) {
            int rented = complianceService.rentedNightsInYear(propertyId, orgId, year);
            if (rented > cap.get()) {
                out.add(new YearOverrun(year, rented, 0, cap.get()));
            }
        }
        return out;
    }

    /** Message lisible decrivant un depassement — reutilise par l'API, les cartes et les notifications. */
    public static String describe(List<YearOverrun> overruns) {
        StringBuilder sb = new StringBuilder();
        for (YearOverrun o : overruns) {
            if (!sb.isEmpty()) {
                sb.append(" ; ");
            }
            sb.append(o.year()).append(" : ").append(o.rentedNights()).append(" nuit(s) déjà louée(s) + ")
                    .append(o.newNights()).append(" = ").append(o.rentedNights() + o.newNights())
                    .append(" pour un plafond de ").append(o.maxNights());
        }
        return sb.toString();
    }

    /** Jours encore vendables de {@code from} au 31 decembre (aucune ligne = jour libre). */
    public int freeDaysRestOfYear(Long propertyId, Long orgId, LocalDate from) {
        LocalDate endExclusive = LocalDate.of(from.getYear() + 1, 1, 1);
        int total = (int) java.time.temporal.ChronoUnit.DAYS.between(from, endExclusive);
        long taken = calendarDayRepository.findByPropertyAndDateRange(propertyId, from, endExclusive.minusDays(1), orgId)
                .stream().filter(d -> d.getStatus() != CalendarDayStatus.AVAILABLE).count();
        return Math.max(0, total - (int) taken);
    }

    /**
     * Ferme a la vente les jours encore LIBRES de {@code from} au 31 decembre : les jours
     * deja reserves, bloques ou en maintenance sont laisses tels quels (un blocage manuel
     * garde sa source). Chaque plage libre contigue devient un blocage
     * {@value #CALENDAR_SOURCE}, propage aux canaux par l'outbox du calendrier.
     *
     * @return nombre de jours fermes
     */
    public int closeRestOfYear(Long propertyId, Long orgId, LocalDate from, String actorId) {
        LocalDate endExclusive = LocalDate.of(from.getYear() + 1, 1, 1);
        Map<LocalDate, CalendarDayStatus> taken = new HashMap<>();
        for (CalendarDay day : calendarDayRepository.findByPropertyAndDateRange(
                propertyId, from, endExclusive.minusDays(1), orgId)) {
            if (day.getStatus() != CalendarDayStatus.AVAILABLE) {
                taken.put(day.getDate(), day.getStatus());
            }
        }
        int closed = 0;
        LocalDate spanStart = null;
        for (LocalDate d = from; !d.isAfter(endExclusive); d = d.plusDays(1)) {
            boolean free = d.isBefore(endExclusive) && !taken.containsKey(d);
            if (free && spanStart == null) {
                spanStart = d;
            } else if (!free && spanStart != null) {
                calendarEngine.block(propertyId, spanStart, d, orgId, CALENDAR_SOURCE,
                        "Plafond annuel de nuitées atteint", actorId);
                closed += (int) java.time.temporal.ChronoUnit.DAYS.between(spanStart, d);
                spanStart = null;
            }
        }
        log.info("Plafond de nuitées : {} jour(s) fermé(s) pour le logement {} (org {}) jusqu'au 31/12/{}",
                closed, propertyId, orgId, from.getYear());
        return closed;
    }

    /**
     * Previent les gestionnaires qu'un humain a deroge au plafond. Best-effort : la
     * derogation est deja actee, une notification manquee ne doit pas l'annuler.
     */
    public void notifyDerogation(Long orgId, Long propertyId, String propertyName, String detail, String actor) {
        try {
            notificationService.notifyAdminsAndManagersByOrgId(orgId, NotificationKey.NIGHTS_CAP_DEROGATION,
                    "Dérogation au plafond de nuitées",
                    "Le plafond annuel de nuitées de « " + (propertyName != null ? propertyName : "logement " + propertyId)
                            + " » a été dépassé par décision manuelle" + (actor != null ? " (" + actor + ")" : "")
                            + ". " + detail + ". Résidence principale : 120 nuits par an au plus (Code du tourisme "
                            + "L324-1-1) — l'exploitant s'expose à une amende civile.",
                    "/properties/" + propertyId);
        } catch (RuntimeException e) {
            log.error("Notification de dérogation au plafond non envoyée (org {}, logement {}) : {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    /** Previent qu'un canal a importe une reservation au-dela du plafond (aucun refus possible). */
    public void notifyChannelOverrun(Long orgId, Long propertyId, String propertyName, String source, String detail) {
        try {
            notificationService.notifyAdminsAndManagersByOrgId(orgId, NotificationKey.NIGHTS_CAP_EXCEEDED,
                    "Plafond de nuitées dépassé",
                    "Une réservation " + (source != null ? source : "importée")
                            + " dépasse le plafond annuel de « "
                            + (propertyName != null ? propertyName : "logement " + propertyId) + " » : " + detail
                            + ". Fermez le calendrier pour le reste de l'année depuis la carte de l'agent Conformité.",
                    "/properties/" + propertyId);
        } catch (RuntimeException e) {
            log.error("Notification de dépassement du plafond non envoyée (org {}, logement {}) : {}",
                    orgId, propertyId, e.getMessage());
        }
    }
}
