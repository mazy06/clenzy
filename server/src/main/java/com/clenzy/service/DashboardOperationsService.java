package com.clenzy.service;

import com.clenzy.dto.DashboardOperationsDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.dto.DashboardOperationsDto.ActionItemsDto;
import com.clenzy.dto.DashboardOperationsDto.ArrivalDto;
import com.clenzy.dto.DashboardOperationsDto.CleaningDto;
import com.clenzy.dto.DashboardOperationsDto.DepartureDto;
import com.clenzy.dto.DashboardOperationsDto.UpcomingArrivalDto;
import com.clenzy.model.GuestReview;
import com.clenzy.model.ICalFeed;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.repository.ICalFeedRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Blocs opérationnels du Dashboard : journée en cours, arrivées à venir,
 * éléments à traiter.
 *
 * <p>Même discipline que {@code DashboardOverviewSummaryService} : org-scope
 * strict issu du contexte tenant, scoping par rôle (HOST → ses logements,
 * rôles opérationnels → leurs interventions), lecture seule, aucune entité
 * exposée, dates dans la zone du {@link Clock} applicatif.</p>
 *
 * <p>Toutes les listes sont <b>bornées</b> : l'écran affiche quelques lignes.
 * Une organisation avec 400 arrivées le même jour ne doit pas les transporter.</p>
 */
@Service
@Transactional(readOnly = true)
public class DashboardOperationsService {

    /** Au-delà, la liste n'est plus lisible à l'écran — et le reste vit dans son module. */
    private static final int MAX_ROWS = 40;

    /** Un flux muet depuis plus d'une journée est considéré en dérive. */
    private static final int FEED_STALE_HOURS = 24;

    /** Longueur de l'extrait d'avis affiché dans « à traiter ». */
    private static final int REVIEW_EXCERPT_LENGTH = 140;

    /**
     * Délai avant de considérer qu'une prestation ne trouvera pas preneur seule.
     *
     * <p>Un cycle du planificateur d'assignation ({@code AutoAssignScheduler},
     * toutes les 15 min) : au-delà, la recherche automatique a déjà eu sa chance.</p>
     */
    private static final int ASSIGNMENT_GRACE_MINUTES = 15;

    /**
     * Plafond par nature d'action.
     *
     * <p>Sans lui, une organisation avec vingt avis sans réponse ne voyait QUE
     * des avis : le solde à percevoir et le calendrier en panne, plus urgents,
     * étaient poussés hors de la carte.</p>
     *
     * <p>Dix, pas trois : l'écran n'affiche que les premières lignes mais déplie
     * le reste sur place, sans changer d'écran. Il faut donc lui transmettre de
     * quoi déplier — sinon le bouton « voir les autres » n'aurait rien à
     * montrer.</p>
     */
    private static final int MAX_PER_KIND = 10;

    private static final Set<UserRole> OPERATIONAL_ROLES = EnumSet.of(
            UserRole.TECHNICIAN, UserRole.HOUSEKEEPER, UserRole.LAUNDRY, UserRole.EXTERIOR_TECH);

    private final ReservationRepository reservationRepository;
    private final InterventionRepository interventionRepository;
    private final SecurityDepositRepository securityDepositRepository;
    private final GuestReviewRepository guestReviewRepository;
    private final ICalFeedRepository iCalFeedRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    public DashboardOperationsService(ReservationRepository reservationRepository,
                                      InterventionRepository interventionRepository,
                                      SecurityDepositRepository securityDepositRepository,
                                      GuestReviewRepository guestReviewRepository,
                                      ICalFeedRepository iCalFeedRepository,
                                      ServiceRequestRepository serviceRequestRepository,
                                      PropertyRepository propertyRepository,
                                      UserRepository userRepository,
                                      Clock clock) {
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.securityDepositRepository = securityDepositRepository;
        this.guestReviewRepository = guestReviewRepository;
        this.iCalFeedRepository = iCalFeedRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    // ─── Journée en cours ───────────────────────────────────────────────────

    public DashboardOperationsDto getToday(Long orgId, UserRole role, String keycloakId) {
        final LocalDate today = LocalDate.now(clock);
        final String ownerKc = role == UserRole.HOST ? keycloakId : null;

        // Un intervenant n'a rien à faire du carnet d'arrivées de l'organisation :
        // il ne voit que SES interventions. Sans ce garde, l'endpoint exposait le
        // nom des voyageurs et les logements de toute l'org à n'importe quel
        // utilisateur authentifié.
        final boolean seesGuestFlow = !OPERATIONAL_ROLES.contains(role);

        final List<ArrivalDto> arrivals = seesGuestFlow
                ? toArrivals(scopeToOwner(
                        reservationRepository.findConfirmedByCheckInRange(today, today, orgId), ownerKc))
                : List.of();
        final List<DepartureDto> departures = seesGuestFlow
                ? toDepartures(scopeToOwner(
                        reservationRepository.findConfirmedByCheckOutRange(today, today, orgId), ownerKc))
                : List.of();

        return new DashboardOperationsDto(arrivals, departures,
                todayCleanings(orgId, today, role, keycloakId));
    }

    private List<ArrivalDto> toArrivals(List<Reservation> reservations) {
        return reservations.stream()
                .sorted(Comparator.comparing(r -> checkInTimeOf(r), Comparator.nullsLast(String::compareTo)))
                .limit(MAX_ROWS)
                .map(r -> new ArrivalDto(
                        r.getId(),
                        r.getGuestName(),
                        propertyId(r.getProperty()),
                        propertyName(r.getProperty()),
                        checkInTimeOf(r),
                        r.getSource(),
                        r.getSourceName(),
                        truncate(r.getNotes(), REVIEW_EXCERPT_LENGTH),
                        r.getGuestCount() == null ? 0 : r.getGuestCount()))
                .toList();
    }

    private List<DepartureDto> toDepartures(List<Reservation> reservations) {
        final List<Long> ids = reservations.stream().map(Reservation::getId).toList();
        // Une seule requête pour tout le lot : pas de N+1 sur les cautions.
        final Map<Long, SecurityDeposit> heldByReservation = ids.isEmpty()
                ? Map.of()
                : securityDepositRepository.findHeldByReservationIds(ids).stream()
                        .collect(Collectors.toMap(SecurityDeposit::getReservationId,
                                Function.identity(), (a, b) -> a));

        return reservations.stream()
                .sorted(Comparator.comparing(r -> checkOutTimeOf(r), Comparator.nullsLast(String::compareTo)))
                .limit(MAX_ROWS)
                .map(r -> {
                    final SecurityDeposit deposit = heldByReservation.get(r.getId());
                    return new DepartureDto(
                            r.getId(),
                            r.getGuestName(),
                            propertyId(r.getProperty()),
                            propertyName(r.getProperty()),
                            checkOutTimeOf(r),
                            deposit == null ? null : deposit.getId(),
                            deposit == null ? null : remainingDeposit(deposit));
                })
                .toList();
    }

    /** Montant encore retenu : le capturé n'est plus libérable. */
    private BigDecimal remainingDeposit(SecurityDeposit deposit) {
        final BigDecimal amount = deposit.getAmount() == null ? BigDecimal.ZERO : deposit.getAmount();
        final BigDecimal captured = deposit.getCapturedAmount() == null
                ? BigDecimal.ZERO : deposit.getCapturedAmount();
        final BigDecimal remaining = amount.subtract(captured);
        return remaining.signum() > 0 ? remaining : BigDecimal.ZERO;
    }

    private List<CleaningDto> todayCleanings(Long orgId, LocalDate today, UserRole role, String keycloakId) {
        final String ownerKc = role == UserRole.HOST ? keycloakId : null;
        final Long assigneeId = OPERATIONAL_ROLES.contains(role)
                ? userRepository.findByKeycloakId(keycloakId).map(User::getId).orElse(-1L)
                : null;

        final List<Intervention> scheduled = interventionRepository.findForDashboardWindow(
                today.atStartOfDay(), today.plusDays(1).atStartOfDay(), orgId, ownerKc, assigneeId);

        return scheduled.stream()
                .filter(this::isCleaning)
                .sorted(Comparator.comparing(Intervention::getStartTime,
                        Comparator.nullsLast(LocalDateTime::compareTo)))
                .limit(MAX_ROWS)
                .map(i -> new CleaningDto(
                        i.getId(),
                        propertyId(i.getProperty()),
                        propertyName(i.getProperty()),
                        assigneeName(i.getAssignedUser()),
                        formatTime(i.getStartTime()),
                        formatTime(i.getEndTime()),
                        i.getStatus() == null ? null : i.getStatus().name()))
                .toList();
    }

    /** {@code Intervention.type} est une chaîne libre : on reconnaît la famille « nettoyage ». */
    private boolean isCleaning(Intervention intervention) {
        final String type = intervention.getType();
        return type != null && type.toUpperCase().contains("CLEANING");
    }

    // ─── Arrivées à venir ───────────────────────────────────────────────────

    public List<UpcomingArrivalDto> getUpcomingArrivals(Long orgId, int days, UserRole role, String keycloakId) {
        if (OPERATIONAL_ROLES.contains(role)) return List.of();
        final LocalDate today = LocalDate.now(clock);
        final String ownerKc = role == UserRole.HOST ? keycloakId : null;

        final List<Reservation> upcoming = scopeToOwner(
                reservationRepository.findConfirmedByCheckInRange(today, today.plusDays(days), orgId),
                ownerKc);

        return upcoming.stream()
                .sorted(Comparator.comparing(Reservation::getCheckIn))
                .limit(MAX_ROWS)
                .map(r -> new UpcomingArrivalDto(
                        r.getId(),
                        r.getGuestName(),
                        propertyId(r.getProperty()),
                        propertyName(r.getProperty()),
                        r.getCheckIn(),
                        nightsOf(r),
                        r.getSource(),
                        r.getSourceName(),
                        r.getPaymentStatus() == null ? null : r.getPaymentStatus().name(),
                        r.getTotalPrice(),
                        r.getAmountDue()))
                .toList();
    }

    private int nightsOf(Reservation reservation) {
        if (reservation.getCheckIn() == null || reservation.getCheckOut() == null) return 0;
        final long nights = ChronoUnit.DAYS.between(reservation.getCheckIn(), reservation.getCheckOut());
        return nights > 0 ? (int) nights : 0;
    }

    // ─── À traiter ──────────────────────────────────────────────────────────

    /**
     * File « à traiter » — **toutes** les actions en attente, agrégées et ordonnées
     * côté serveur.
     *
     * <p>Cinq sources : les soldes de séjour restant dus, les demandes de service
     * impayées, les prestations sans prestataire, les calendriers en dérive et
     * les avis sans réponse.</p>
     *
     * <p>Les cartes des agents n'y figurent <b>pas</b> : elles vivent dans la
     * constellation, où elles portent leur contexte et leurs actions. Les
     * reprendre ici affichait deux fois le même sujet — un avis apparaissait à
     * la fois comme carte d'agent et dans sa propre rubrique — et le comptait
     * deux fois.</p>
     *
     * <p>Deux garde-fous, appris de l'écran réel : chaque nature est <b>plafonnée
     * séparément</b> — sans quoi vingt avis sans réponse noyaient le solde à
     * percevoir et la panne de calendrier, qui sont pourtant les urgences — et le
     * total réel est renvoyé à part, pour que le badge d'en-tête compte ce qui
     * attend et non ce qui est affiché.</p>
     */
    public ActionItemsDto getActionItems(Long orgId, UserRole role, String keycloakId) {
        // Soldes, avis, canaux et cartes d'agent relèvent de la gestion, pas du terrain.
        if (OPERATIONAL_ROLES.contains(role)) {
            return new ActionItemsDto(List.of(), 0, Map.of());
        }
        final LocalDate today = LocalDate.now(clock);
        final String ownerKc = role == UserRole.HOST ? keycloakId : null;

        final List<ActionItemDto> all = new ArrayList<>();
        all.addAll(balancesDue(orgId, today, ownerKc));
        all.addAll(unpaidServiceRequests(orgId, ownerKc));
        all.addAll(stuckServiceRequests(orgId, ownerKc));
        all.addAll(staleFeeds(orgId, ownerKc));
        all.addAll(unansweredReviews(orgId, ownerKc));

        final Map<ActionItemKind, List<ActionItemDto>> byKind = all.stream()
                .sorted(BY_URGENCY)
                .collect(Collectors.groupingBy(ActionItemDto::kind, LinkedHashMap::new, Collectors.toList()));

        final List<ActionItemDto> shown = byKind.values().stream()
                .flatMap(rows -> rows.stream().limit(MAX_PER_KIND))
                .sorted(BY_URGENCY)
                .limit(MAX_ROWS)
                .toList();

        // Les décomptes portent sur AVANT plafonnement : c'est ce qui permet à
        // l'écran d'écrire « Avis sans réponse (12) » en n'en affichant que trois.
        final Map<ActionItemKind, Integer> totals = byKind.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().size(),
                        (a, b) -> a, () -> new LinkedHashMap<>()));

        return new ActionItemsDto(shown, all.size(), totals);
    }

    /** Sévérité d'abord, puis l'ordre de déclaration des natures. */
    private static final Comparator<ActionItemDto> BY_URGENCY =
            Comparator.<ActionItemDto>comparingInt(item -> severityRank(item.severity()))
                    .thenComparing(item -> item.kind().ordinal());

    private static int severityRank(String severity) {
        if ("critical".equalsIgnoreCase(severity)) return 0;
        if ("warning".equalsIgnoreCase(severity)) return 1;
        return 2;
    }

    /**
     * Charge les logements référencés par identifiant, en une requête, filtrés à
     * ceux du propriétaire quand {@code ownerKc} est fourni.
     *
     * <p>Deux sources ne portent qu'un {@code propertyId} nu (cartes d'agent et
     * avis) : ce chargement est à la fois ce qui donne le nom affiché et ce qui
     * applique le périmètre de l'hôte.</p>
     */
    private Map<Long, Property> propertiesById(java.util.stream.Stream<Long> ids, String ownerKc) {
        final Set<Long> propertyIds = ids.filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        if (propertyIds.isEmpty()) return Map.of();
        return propertyRepository.findAllById(propertyIds).stream()
                .filter(p -> ownerKc == null || isOwnedBy(p, ownerKc))
                .collect(Collectors.toMap(Property::getId, Function.identity(), (a, b) -> a));
    }

    /** Séjours à venir dont il reste un solde à percevoir avant l'arrivée. */
    private List<ActionItemDto> balancesDue(Long orgId, LocalDate today, String ownerKc) {
        return scopeToOwner(
                reservationRepository.findConfirmedByCheckInRange(today, today.plusDays(30), orgId),
                ownerKc)
                .stream()
                .filter(r -> r.getAmountDue() != null && r.getAmountDue().signum() > 0)
                .sorted(Comparator.comparing(Reservation::getCheckIn))
                .map(r -> new ActionItemDto(
                        "balance:" + r.getId(),
                        ActionItemKind.BALANCE_DUE,
                        // Une arrivée dans moins de trois jours ne peut plus attendre.
                        ChronoUnit.DAYS.between(today, r.getCheckIn()) <= 3 ? "critical" : "warning",
                        r.getGuestName() == null ? "RES-" + r.getId() : r.getGuestName(),
                        "RES-" + r.getId(),
                        r.getGuestName(),
                        r.getId(),
                        propertyId(r.getProperty()),
                        propertyName(r.getProperty()),
                        r.getAmountDue(),
                        null,
                        null,
                        null))
                .toList();
    }

    /** Demandes de service réalisées et non réglées. */
    private List<ActionItemDto> unpaidServiceRequests(Long orgId, String ownerKc) {
        return serviceRequestRepository.findUnpaidForOrg(orgId).stream()
                .filter(request -> ownerKc == null || isOwnedBy(request.getProperty(), ownerKc))
                .map(request -> new ActionItemDto(
                        "service:" + request.getId(),
                        ActionItemKind.SERVICE_UNPAID,
                        "warning",
                        request.getTitle(),
                        propertyName(request.getProperty()),
                        null,
                        request.getId(),
                        propertyId(request.getProperty()),
                        propertyName(request.getProperty()),
                        request.getEstimatedCost(),
                        null,
                        null,
                        null))
                .toList();
    }

    /**
     * Prestations sans prestataire que l'automatisme n'assignera plus.
     *
     * <p>C'est la contrepartie de {@link #unpaidServiceRequests} : celle-ci ne
     * montre que les prestations facturables, or une prestation sans prestataire
     * ne le sera jamais. Elle n'apparaissait donc nulle part, alors que c'est
     * l'urgence réelle : le ménage n'aura pas lieu.</p>
     */
    private List<ActionItemDto> stuckServiceRequests(Long orgId, String ownerKc) {
        final LocalDateTime now = LocalDateTime.now(clock);
        return serviceRequestRepository
                .findStuckUnassignedForOrg(orgId, now.minusMinutes(ASSIGNMENT_GRACE_MINUTES)).stream()
                .filter(request -> ownerKc == null || isOwnedBy(request.getProperty(), ownerKc))
                .map(request -> new ActionItemDto(
                        "unassigned:" + request.getId(),
                        ActionItemKind.SERVICE_UNASSIGNED,
                        // Une date déjà passée ne se rattrape pas ; une recherche
                        // épuisée attend un geste mais la date tient encore.
                        request.getDesiredDate() != null && request.getDesiredDate().isBefore(now)
                                ? "critical" : "warning",
                        request.getTitle(),
                        propertyName(request.getProperty()),
                        null,
                        request.getId(),
                        propertyId(request.getProperty()),
                        propertyName(request.getProperty()),
                        // Le coût est déjà calculé (moteur ménage, devis) : le
                        // taire ferait perdre l'ordre de grandeur de l'enjeu.
                        request.getEstimatedCost(),
                        null,
                        null,
                        null))
                .toList();
    }

    private List<ActionItemDto> unansweredReviews(Long orgId, String ownerKc) {
        final List<GuestReview> reviews = guestReviewRepository.findPublicWithoutHostResponse(orgId);
        if (reviews.isEmpty()) return List.of();

        // GuestReview ne porte qu'un propertyId : un seul aller-retour pour les noms.
        final Map<Long, Property> byId = propertiesById(
                reviews.stream().map(GuestReview::getPropertyId), ownerKc);

        return reviews.stream()
                .filter(r -> r.getPropertyId() != null && byId.containsKey(r.getPropertyId()))
                .map(r -> new ActionItemDto(
                        "review:" + r.getId(),
                        ActionItemKind.REVIEW_UNANSWERED,
                        // Une mauvaise note sans réponse s'aggrave avec le temps.
                        r.getRating() != null && r.getRating() <= 3 ? "warning" : "info",
                        r.getGuestName() == null || r.getGuestName().isBlank()
                                ? propertyName(byId.get(r.getPropertyId()))
                                : r.getGuestName(),
                        truncate(r.getReviewText(), REVIEW_EXCERPT_LENGTH),
                        r.getGuestName(),
                        r.getId(),
                        r.getPropertyId(),
                        propertyName(byId.get(r.getPropertyId())),
                        null,
                        r.getRating() == null ? null : r.getRating() + "\u2605",
                        null,
                        null))
                .toList();
    }

    /**
     * Flux de calendrier muets ou en échec.
     *
     * <p>L'ancienneté part en {@code amount} plutôt qu'en texte : « 30 h sans
     * succès » fabriqué ici serait du français en dur dans une interface qui
     * parle aussi anglais et arabe. Le serveur donne le nombre, le front la
     * phrase.</p>
     */
    private List<ActionItemDto> staleFeeds(Long orgId, String ownerKc) {
        final LocalDateTime now = LocalDateTime.now(clock);
        final LocalDateTime staleBefore = now.minusHours(FEED_STALE_HOURS);

        return iCalFeedRepository.findStaleOrFailing(orgId, staleBefore).stream()
                // Comme les quatre autres sources : un hôte ne voit que ses logements.
                .filter(f -> ownerKc == null || isOwnedBy(f.getProperty(), ownerKc))
                .map(f -> {
                    final Long hours = hoursSince(f.getLastSyncAt(), now);
                    return new ActionItemDto(
                            "feed:" + f.getId(),
                            ActionItemKind.FEED_STALE,
                            // Un calendrier muet est la première cause de double-réservation.
                            "critical",
                            f.getSourceName(),
                            propertyName(f.getProperty()),
                            null,
                            f.getId(),
                            propertyId(f.getProperty()),
                            propertyName(f.getProperty()),
                            hours == null ? null : BigDecimal.valueOf(hours),
                            null,
                            null,
                            null);
                })
                .toList();
    }

    private Long hoursSince(LocalDateTime lastSyncAt, LocalDateTime now) {
        return lastSyncAt == null ? null : ChronoUnit.HOURS.between(lastSyncAt, now);
    }

    // ─── Utilitaires ────────────────────────────────────────────────────────

    /**
     * Restreint aux logements d'un hôte. Les requêtes d'arrivée/départ sont
     * org-scopées mais pas owner-scopées : le filtre se fait ici, sur des lots
     * déjà bornés à une journée (ou sept).
     */
    private List<Reservation> scopeToOwner(List<Reservation> reservations, String ownerKc) {
        if (ownerKc == null) return reservations;
        return reservations.stream()
                .filter(r -> isOwnedBy(r.getProperty(), ownerKc))
                .toList();
    }

    private boolean isOwnedBy(Property property, String ownerKc) {
        return property != null
                && property.getOwner() != null
                && ownerKc.equals(property.getOwner().getKeycloakId());
    }

    private Long propertyId(Property property) {
        return property == null ? null : property.getId();
    }

    private String propertyName(Property property) {
        return property == null ? null : property.getName();
    }

    private String assigneeName(User user) {
        if (user == null) return null;
        final String full = String.join(" ",
                user.getFirstName() == null ? "" : user.getFirstName(),
                user.getLastName() == null ? "" : user.getLastName()).trim();
        return full.isEmpty() ? null : full;
    }

    /** Heure d'arrivée de la réservation, à défaut celle du logement. */
    private String checkInTimeOf(Reservation reservation) {
        if (reservation.getCheckInTime() != null && !reservation.getCheckInTime().isBlank()) {
            return reservation.getCheckInTime();
        }
        final Property property = reservation.getProperty();
        return property == null ? null : property.getDefaultCheckInTime();
    }

    private String checkOutTimeOf(Reservation reservation) {
        if (reservation.getCheckOutTime() != null && !reservation.getCheckOutTime().isBlank()) {
            return reservation.getCheckOutTime();
        }
        final Property property = reservation.getProperty();
        return property == null ? null : property.getDefaultCheckOutTime();
    }

    private String formatTime(LocalDateTime dateTime) {
        if (dateTime == null) return null;
        return String.format("%02d:%02d", dateTime.getHour(), dateTime.getMinute());
    }

    private String truncate(String value, int max) {
        if (value == null) return null;
        final String trimmed = value.strip();
        if (trimmed.isEmpty()) return null;
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max) + "…";
    }
}
