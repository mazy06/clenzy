package com.clenzy.service;

import com.clenzy.dto.DashboardOperationsDto;
import com.clenzy.dto.DashboardOperationsDto.ArrivalDto;
import com.clenzy.dto.DashboardOperationsDto.CleaningDto;
import com.clenzy.dto.DashboardOperationsDto.DepartureDto;
import com.clenzy.dto.DashboardOperationsDto.UpcomingArrivalDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Blocs opérationnels du Dashboard : journée en cours et arrivées à venir.
 *
 * <p>La file « à traiter » <b>n'est plus ici</b> : elle est devenue une table
 * persistée, alimentée hors du chemin de l'utilisateur, et lue par
 * {@code ActionItemQueryService}. Elle occupait cinq cents lignes et huit
 * repositories dans cette classe, et chaque nouvelle nature aggravait le
 * coût d'affichage du tableau de bord.</p>
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

    /** Longueur de l'extrait de notes affiché sur une arrivée. */
    private static final int NOTES_EXCERPT_LENGTH = 140;


    private static final Set<UserRole> OPERATIONAL_ROLES = EnumSet.of(
            UserRole.TECHNICIAN, UserRole.HOUSEKEEPER, UserRole.LAUNDRY, UserRole.EXTERIOR_TECH);

    private final ReservationRepository reservationRepository;
    private final InterventionRepository interventionRepository;
    private final SecurityDepositRepository securityDepositRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    /** La base ne stocke qu'une cle opaque : l'URL servable se fabrique ici. */
    private final GuestPhotoUrlResolver guestPhotoUrls;

    public DashboardOperationsService(ReservationRepository reservationRepository,
                                      InterventionRepository interventionRepository,
                                      SecurityDepositRepository securityDepositRepository,
                                      UserRepository userRepository,
                                      GuestPhotoUrlResolver guestPhotoUrls,
                                      Clock clock) {
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.securityDepositRepository = securityDepositRepository;
        this.userRepository = userRepository;
        this.guestPhotoUrls = guestPhotoUrls;
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
                        truncate(r.getNotes(), NOTES_EXCERPT_LENGTH),
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
                        r.getGuest() == null ? null
                            : guestPhotoUrls.publicUrl(r.getGuest().getId(), r.getGuest().getAvatarUrl()),
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
