package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.WelcomeGuideRepository;
import org.springframework.stereotype.Component;

import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Tout ce qu'une réservation peut laisser en suspens.
 *
 * <p>Cinq natures issues du même agrégat : déclaration voyageur manquante,
 * réservation jamais confirmée, solde à percevoir, solde jamais encaissé,
 * livret d'accueil absent. Les regrouper n'est pas cosmétique — elles partagent
 * le périmètre de l'hôte, le nommage d'une réservation sans voyageur et la
 * règle des trois jours qui fait basculer l'urgence.</p>
 */
@Component
public class ReservationActionSource implements ActionItemSource {

    /** En deçà, le ménage ne se planifie plus et le solde ne se réclame plus. */
    private static final int URGENT_DAYS = 3;

    /** Une déclaration plus vieille que ça ne se rattrape plus. */
    private static final int DECLARATION_LOOKBACK_DAYS = 30;

    /** Un solde d'un séjour terminé depuis plus longtemps est une perte, pas une créance. */
    private static final int ABANDONED_LOOKBACK_DAYS = 90;

    private final ReservationRepository reservationRepository;
    private final WelcomeGuideRepository welcomeGuideRepository;

    public ReservationActionSource(ReservationRepository reservationRepository,
                                   WelcomeGuideRepository welcomeGuideRepository) {
        this.reservationRepository = reservationRepository;
        this.welcomeGuideRepository = welcomeGuideRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.GUEST_DECLARATION_MISSING, ActionItemKind.RESERVATION_PENDING, ActionItemKind.BALANCE_DUE, ActionItemKind.BALANCE_ABANDONED, ActionItemKind.WELCOME_GUIDE_MISSING);
    }

    @Override
    public Scope scope() {
        return Scope.BUSINESS;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        final List<ActionItemDto> items = new ArrayList<>();
        items.addAll(missingDeclarations(ctx));
        items.addAll(unconfirmed(ctx));
        items.addAll(abandonedBalances(ctx));
        items.addAll(balancesDue(ctx));
        items.addAll(missingWelcomeGuides(ctx));
        return items;
    }

    /**
     * Séjours arrivés sans déclaration voyageur — obligation légale non remplie.
     *
     * <p>Rétrospectif sur trente jours : au-delà, la déclaration ne se rattrape
     * plus et la carte deviendrait un reproche permanent.</p>
     */
    private List<ActionItemDto> missingDeclarations(ActionItemContext ctx) {
        return reservationRepository.findWithoutGuestDeclaration(
                        ctx.organizationId(),
                        ctx.today().minusDays(DECLARATION_LOOKBACK_DAYS),
                        ctx.today())
                .stream()
                .filter(r -> ctx.covers(r.getProperty()))
                .map(r -> item(r, ActionItemKind.GUEST_DECLARATION_MISSING, "critical", null))
                .toList();
    }

    /**
     * Réservations jamais confirmées dont l'arrivée approche.
     *
     * <p>Le statut « pending » les exclut de tout le reste du produit : pas de
     * ménage, pas de message de séjour, pas de solde réclamé. Le voyageur arrive
     * dans un logement que personne n'a préparé.</p>
     */
    private List<ActionItemDto> unconfirmed(ActionItemContext ctx) {
        return reservationRepository.findPendingWithUpcomingCheckIn(
                        ctx.organizationId(), ctx.today(), ctx.today().plusDays(7))
                .stream()
                .filter(r -> ctx.covers(r.getProperty()))
                .map(r -> item(r, ActionItemKind.RESERVATION_PENDING, urgency(ctx, r), null))
                .toList();
    }

    /**
     * Séjours terminés dont le solde n'a jamais été encaissé.
     *
     * <p>Le bloc « soldes à percevoir » ne regarde que l'avenir, si bien que
     * l'argent disparaissait de l'écran au moment précis où il devenait
     * vraiment dû.</p>
     */
    private List<ActionItemDto> abandonedBalances(ActionItemContext ctx) {
        return reservationRepository.findWithBalanceAfterStay(
                        ctx.organizationId(),
                        ctx.today().minusDays(ABANDONED_LOOKBACK_DAYS),
                        ctx.today())
                .stream()
                .filter(r -> ctx.covers(r.getProperty()))
                .map(r -> item(r, ActionItemKind.BALANCE_ABANDONED, "critical", r.getAmountDue()))
                .toList();
    }

    /** Séjours à venir dont il reste un solde à percevoir avant l'arrivée. */
    private List<ActionItemDto> balancesDue(ActionItemContext ctx) {
        return reservationRepository.findConfirmedByCheckInRange(
                        ctx.today(), ctx.today().plusDays(30), ctx.organizationId())
                .stream()
                .filter(r -> ctx.covers(r.getProperty()))
                .filter(r -> r.getAmountDue() != null && r.getAmountDue().signum() > 0)
                .sorted(java.util.Comparator.comparing(Reservation::getCheckIn))
                .map(r -> item(r, ActionItemKind.BALANCE_DUE, urgency(ctx, r), r.getAmountDue()))
                .toList();
    }

    /**
     * Arrivées proches sans livret d'accueil publié.
     *
     * <p>Un livret non publié rejette tous les accès publics : le voyageur
     * reçoit un lien mort, et le code d'accès ne lui est pas délivrable.</p>
     */
    private List<ActionItemDto> missingWelcomeGuides(ActionItemContext ctx) {
        return reservationRepository.findConfirmedByCheckInRange(
                        ctx.today(), ctx.today().plusDays(2), ctx.organizationId())
                .stream()
                .filter(r -> ctx.covers(r.getProperty()))
                .filter(r -> r.getProperty() != null
                        && !welcomeGuideRepository.existsPublishedForProperty(
                                r.getProperty().getId(), ctx.organizationId()))
                .map(r -> new ActionItemDto(
                        "guide:" + r.getId(),
                        ActionItemKind.WELCOME_GUIDE_MISSING,
                        "warning",
                        ActionItems.propertyName(r.getProperty()),
                        r.getGuestName(),
                        r.getGuestName(),
                        r.getId(),
                        ActionItems.propertyId(r.getProperty()),
                        ActionItems.propertyName(r.getProperty()),
                        null, null, null, null))
                .toList();
    }

    /** Forme commune : le voyageur en titre, la référence en second. */
    private static ActionItemDto item(Reservation r, ActionItemKind kind, String severity,
                                      java.math.BigDecimal amount) {
        final String reference = "RES-" + r.getId();
        return new ActionItemDto(
                prefixOf(kind) + ":" + r.getId(),
                kind,
                severity,
                ActionItems.firstNonBlank(r.getGuestName(), reference),
                reference,
                r.getGuestName(),
                r.getId(),
                ActionItems.propertyId(r.getProperty()),
                ActionItems.propertyName(r.getProperty()),
                amount,
                null, null, null);
    }

    /**
     * Préfixe d'identité de ligne.
     *
     * <p>Il doit rester stable : le front s'en sert comme clé de rendu, et deux
     * natures portant sur la même réservation ne doivent pas se confondre.</p>
     */
    private static String prefixOf(ActionItemKind kind) {
        return switch (kind) {
            case GUEST_DECLARATION_MISSING -> "declaration";
            case RESERVATION_PENDING -> "pending";
            case BALANCE_ABANDONED -> "abandoned";
            case BALANCE_DUE -> "balance";
            default -> kind.name().toLowerCase();
        };
    }

    private static String urgency(ActionItemContext ctx, Reservation r) {
        return ChronoUnit.DAYS.between(ctx.today(), r.getCheckIn()) <= URGENT_DAYS
                ? "critical" : "warning";
    }
}
