package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.Team;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.TeamRepository;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Les trois façons dont une intervention s'arrête sans que personne ne le voie.
 *
 * <p><b>En retard</b> — la date est passée, le statut encore ouvert.</p>
 *
 * <p><b>Sans exécutant</b> — planifiée, mais ni personne ni équipe ne lui est
 * rattachée. Le jour venu, personne ne se présente. L'écran des interventions
 * la montrait comme les autres, sans rien signaler.</p>
 *
 * <p><b>En attente de paiement</b> — le travail est fait, la facture attend, et
 * l'intervention reste figée. Un tableau de bord qui ne le dit pas laisse
 * l'argent dormir indéfiniment.</p>
 *
 * <p>À ne pas confondre avec {@code SERVICE_UNASSIGNED}, qui porte sur les
 * demandes de service : deux objets différents, à deux étapes différentes du
 * cycle. Les fondre aurait masqué l'un des deux.</p>
 */
@Component
public class InterventionActionSource implements ActionItemSource {

    /**
     * Une intervention non assignée n'est un problème qu'à l'approche de sa
     * date : plus tôt, l'assignation est simplement à venir.
     */
    private static final int UNASSIGNED_HORIZON_DAYS = 3;

    /** Au-delà, l'attente de règlement n'est plus un délai mais un oubli. */
    private static final int PAYMENT_STALE_DAYS = 5;

    /** Repli documenté quand le logement ne déclare pas sa zone. */
    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Europe/Paris");

    private static final DateTimeFormatter HOUR = DateTimeFormatter.ofPattern("HH:mm");

    /** « 28 mars » — le jour, sans l'année tant qu'on parle de la saison en cours. */
    private static final DateTimeFormatter DAY =
            DateTimeFormatter.ofPattern("d MMM", java.util.Locale.FRENCH);

    private final InterventionRepository interventionRepository;
    private final TeamRepository teamRepository;

    public InterventionActionSource(InterventionRepository interventionRepository,
                                    TeamRepository teamRepository) {
        this.interventionRepository = interventionRepository;
        this.teamRepository = teamRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.INTERVENTION_OVERDUE,
                ActionItemKind.INTERVENTION_UNASSIGNED,
                ActionItemKind.INTERVENTION_UNPAID);
    }

    @Override
    public Scope scope() {
        return Scope.BUSINESS;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        final List<ActionItemDto> items = new ArrayList<>();

        final List<Intervention> overdue = interventionRepository
                .findOverdueForOrg(ctx.organizationId(), ctx.nowDateTime()).stream()
                .filter(intervention -> ctx.covers(intervention.getProperty()))
                .toList();
        // Les noms d'équipe en UNE requête, jamais une par ligne : trente
        // interventions en retard feraient trente allers-retours pour trois mots.
        final Map<Long, String> teamNames = teamNames(overdue);
        overdue.stream()
                .map(intervention -> item(intervention, ActionItemKind.INTERVENTION_OVERDUE,
                        "critical", overdueDetail(intervention, teamNames, ctx.nowDateTime()),
                        // Le retard se compte depuis la fin du créneau — c'est
                        // l'instant où l'intervention aurait dû être terminée.
                        // À défaut de fin, depuis son début.
                        due(intervention)))
                .forEach(items::add);

        interventionRepository.findUnassignedForOrg(
                        ctx.organizationId(), ctx.nowDateTime().plusDays(UNASSIGNED_HORIZON_DAYS))
                .stream()
                .filter(intervention -> ctx.covers(intervention.getProperty()))
                .map(intervention -> item(intervention, ActionItemKind.INTERVENTION_UNASSIGNED,
                        "critical", "Aucun prestataire assigné", null))
                .forEach(items::add);

        interventionRepository.findAwaitingPaymentForOrg(
                        ctx.organizationId(), ctx.nowDateTime().minusDays(PAYMENT_STALE_DAYS))
                .stream()
                .filter(intervention -> ctx.covers(intervention.getProperty()))
                .map(intervention -> item(intervention, ActionItemKind.INTERVENTION_UNPAID,
                        "warning", "En attente de règlement", null))
                .forEach(items::add);

        return items;
    }

    /**
     * Le contexte d'une intervention en retard : son créneau, et l'équipe qui
     * devait s'en charger quand on la connaît.
     *
     * <p>Le retard lui-même n'est pas écrit ici : il se compte à l'affichage,
     * depuis {@code due()}. Une phrase figée au balayage annoncerait « 4 h de
     * retard » une heure plus tard, et ne se traduirait pas.</p>
     */
    private static String overdueDetail(Intervention intervention, Map<Long, String> teamNames,
                                        LocalDateTime now) {
        final String team = intervention.getTeamId() == null
                ? null
                : teamNames.get(intervention.getTeamId());
        final String window = window(intervention, now);
        return team == null ? window : window + " · " + teamMention(team);
    }

    /**
     * « équipe Zone Sud », mais « Équipe Entretien Paris » tel quel.
     *
     * <p>Beaucoup d'équipes sont nommées « Equipe … » par leur créateur :
     * préfixer sans regarder produisait « équipe Equipe Entretien Paris ».</p>
     */
    private static String teamMention(String team) {
        final String normalized = java.text.Normalizer
                .normalize(team, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(java.util.Locale.ROOT);
        return normalized.startsWith("equipe") ? team : "équipe " + team;
    }

    /**
     * « Créneau 11:00 → 15:00 », « Prévu à 11:00 », ou la même chose datée quand
     * l'intervention n'est pas d'aujourd'hui.
     *
     * <p>Une heure seule sur une ligne vieille de cinq mois — « Prévu à 11:00 ·
     * 161 j de retard » — ne dit pas de quel jour on parle. Le jour n'est écrit
     * que lorsqu'il n'est pas celui qu'on lit : le porter sur le ménage de ce
     * matin serait du bruit.</p>
     *
     * <p>Les heures sont rendues telles qu'elles sont saisies et stockées :
     * l'intervention est planifiée dans le temps local du logement, et la
     * convertir vers un autre repère déplacerait un créneau de ménage.</p>
     */
    private static String window(Intervention intervention, LocalDateTime now) {
        final LocalDateTime start = intervention.getStartTime();
        final LocalDateTime end = intervention.getEndTime();
        if (start == null) return "Créneau dépassé";

        final boolean today = start.toLocalDate().equals(now.toLocalDate());
        final String day = today ? "" : DAY.format(start) + " ";
        if (end == null) return "Prévu " + (today ? "à " : "le " + day) + HOUR.format(start);
        return "Créneau " + (today ? "" : "du " + day) + HOUR.format(start)
                + " → " + HOUR.format(end);
    }

    /**
     * L'instant où l'intervention aurait dû être terminée.
     *
     * <p>Dans la zone du logement, et non celle de la JVM : un ménage de 15:00
     * à Marrakech n'est pas en retard à la même seconde qu'un ménage de 15:00 à
     * Paris.</p>
     */
    private static Instant due(Intervention intervention) {
        final LocalDateTime reference = intervention.getEndTime() != null
                ? intervention.getEndTime()
                : intervention.getStartTime();
        if (reference == null) return null;
        return reference.atZone(zoneOf(intervention)).toInstant();
    }

    private static ZoneId zoneOf(Intervention intervention) {
        final Property property = intervention.getProperty();
        final String timezone = property == null ? null : property.getTimezone();
        try {
            return timezone == null || timezone.isBlank() ? DEFAULT_ZONE : ZoneId.of(timezone);
        } catch (DateTimeException unknownZone) {
            return DEFAULT_ZONE;
        }
    }

    /** Les noms des équipes concernées, en une requête. */
    private Map<Long, String> teamNames(List<Intervention> interventions) {
        final Set<Long> ids = interventions.stream()
                .map(Intervention::getTeamId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return teamRepository.findAllById(ids).stream()
                .filter(team -> team.getName() != null && !team.getName().isBlank())
                .collect(Collectors.toMap(Team::getId, Team::getName, (a, b) -> a));
    }

    private static ActionItemDto item(Intervention intervention, ActionItemKind kind,
                                      String severity, String detail, Instant waitingSince) {
        return new ActionItemDto(
                // La nature entre dans l'identité : une même intervention peut
                // être à la fois en retard et sans exécutant, et ce sont deux
                // lignes distinctes, avec deux gestes distincts.
                prefixOf(kind) + ":" + intervention.getId(),
                kind,
                severity,
                // Le LOGEMENT, pas le titre de l'intervention : celui-ci vient
                // du canal (« Menage Airbnb — Appartement Duplex Paris ») et
                // nomme souvent un autre logement que celui de la ligne. Deux
                // logements sur une même ligne, on ne sait plus lequel est vrai.
                // La nature de la prestation est portée par `actionType`, que
                // l'écran traduit — un libellé serveur ne se traduit pas.
                ActionItems.propertyName(intervention.getProperty()),
                detail,
                null,
                intervention.getId(),
                ActionItems.propertyId(intervention.getProperty()),
                ActionItems.propertyName(intervention.getProperty()),
                cost(intervention),
                null,
                intervention.getType(),
                null,
                null,
                null,
                waitingSince);
    }

    /** {@code overdue:} est conservé tel quel : c'est l'identité déjà connue du front. */
    private static String prefixOf(ActionItemKind kind) {
        return switch (kind) {
            case INTERVENTION_OVERDUE -> "overdue";
            case INTERVENTION_UNASSIGNED -> "intervention-unassigned";
            default -> "intervention-unpaid";
        };
    }

    /** Le montant réel s'il est connu, l'estimation sinon — jamais rien. */
    private static BigDecimal cost(Intervention intervention) {
        return intervention.getActualCost() != null
                ? intervention.getActualCost()
                : intervention.getEstimatedCost();
    }
}
