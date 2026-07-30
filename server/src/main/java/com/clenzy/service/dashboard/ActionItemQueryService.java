package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.dto.DashboardOperationsDto.ActionItemsDto;
import com.clenzy.model.ActionItem;
import com.clenzy.model.UserRole;
import com.clenzy.repository.ActionItemRepository;
import com.clenzy.repository.PropertyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Lecture de la file « à traiter ».
 *
 * <p>Une requête indexée sur une seule table, quel que soit le nombre de
 * natures. Auparavant, afficher cette carte déclenchait une requête par nature,
 * chacune hydratant des entités entières pour n'en montrer que quelques-unes :
 * le coût d'affichage croissait avec chaque angle mort qu'on corrigeait, ce qui
 * décourageait précisément d'en corriger.</p>
 */
@Service
@Transactional(readOnly = true)
public class ActionItemQueryService {

    /** Au-delà, la liste n'est plus lisible — et le reste vit dans son module. */
    private static final int MAX_ROWS = 40;

    /**
     * Plafond par nature.
     *
     * <p>Sans lui, une organisation avec vingt avis sans réponse ne voyait QUE
     * des avis : le solde à percevoir et le calendrier en panne, plus urgents,
     * étaient poussés hors de la carte.</p>
     *
     * <p>Dix, pas trois : l'écran n'affiche que les premières lignes mais déplie
     * le reste sur place. Il faut donc lui transmettre de quoi déplier.</p>
     */
    private static final int MAX_PER_KIND = 10;

    /** Le terrain n'a pas à connaître les soldes, les avis ni les canaux. */
    private static final Set<UserRole> OPERATIONAL_ROLES = EnumSet.of(
            UserRole.TECHNICIAN, UserRole.HOUSEKEEPER, UserRole.LAUNDRY, UserRole.EXTERIOR_TECH);

    private final ActionItemRepository actionItemRepository;
    private final PropertyRepository propertyRepository;
    private final Clock clock;

    public ActionItemQueryService(ActionItemRepository actionItemRepository,
                                  PropertyRepository propertyRepository,
                                  Clock clock) {
        this.actionItemRepository = actionItemRepository;
        this.propertyRepository = propertyRepository;
        this.clock = clock;
    }

    /**
     * La file, filtrée selon qui regarde.
     *
     * <p>Deux filtrages, tous deux appliqués <b>à la lecture</b> et non à la
     * collecte : la table est commune à toute l'organisation, et la balayer une
     * fois par rôle serait absurde.</p>
     *
     * <ul>
     *   <li><b>Natures techniques</b> — réservées au staff plateforme. Une
     *       file de messages saturée n'est pas une information qu'un hôte peut
     *       exploiter, et l'afficher ne ferait que du bruit.</li>
     *   <li><b>Périmètre de l'hôte</b> — un hôte ne voit que ses logements. Les
     *       lignes sans logement (litige, invitation) relèvent de
     *       l'organisation : elles lui sont masquées.</li>
     * </ul>
     */
    public ActionItemsDto getActionItems(Long orgId, UserRole role, String keycloakId) {
        if (OPERATIONAL_ROLES.contains(role)) {
            return new ActionItemsDto(List.of(), 0, Map.of());
        }

        final Set<ActionItemKind> allowedKinds = allowedKinds(role);
        // Une seule requête, projetant des identifiants et non des entités : cette
        // liste ne sert qu'à filtrer.
        final Set<Long> ownedProperties = role == UserRole.HOST
                ? Set.copyOf(propertyRepository.findIdsByOwnerKeycloakId(keycloakId, orgId))
                : Set.of();

        final List<ActionItemDto> all = actionItemRepository
                .findOpenForOrg(orgId, clock.instant()).stream()
                .filter(item -> isKnownKind(item.getKind()))
                .filter(item -> allowedKinds.contains(ActionItemKind.valueOf(item.getKind())))
                .filter(item -> visibleToOwner(item, ownedProperties, role == UserRole.HOST))
                .map(ActionItemQueryService::toDto)
                .toList();

        final Map<ActionItemKind, List<ActionItemDto>> byKind = all.stream()
                .collect(Collectors.groupingBy(ActionItemDto::kind, LinkedHashMap::new,
                        Collectors.toList()));

        final List<ActionItemDto> shown = byKind.values().stream()
                .flatMap(rows -> rows.stream().limit(MAX_PER_KIND))
                .limit(MAX_ROWS)
                .toList();

        // Les décomptes portent sur AVANT plafonnement : c'est ce qui permet à
        // l'écran d'écrire « Avis sans réponse (12) » en n'en affichant que trois.
        final Map<ActionItemKind, Integer> totals = byKind.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().size(),
                        (a, b) -> a, LinkedHashMap::new));

        return new ActionItemsDto(shown, all.size(), totals);
    }

    /**
     * Les natures que ce rôle a le droit de voir.
     *
     * <p>Tout sauf les natures techniques, sauf pour le staff plateforme.
     * Exprimé par complément et non par énumération : une nature métier
     * ajoutée demain est visible sans qu'on ait à l'inscrire quelque part, et
     * seule une nature explicitement technique est cloisonnée.</p>
     */
    private static Set<ActionItemKind> allowedKinds(UserRole role) {
        if (role != null && role.isPlatformStaff()) return EnumSet.allOf(ActionItemKind.class);
        return EnumSet.complementOf(TECHNICAL_KINDS);
    }

    /**
     * Natures techniques, déclarées ici parce que la lecture ne dépend pas des
     * sources : elle doit fonctionner même si une source est retirée du
     * contexte, sans quoi ses lignes déjà écrites deviendraient visibles de
     * tous.
     */
    private static final EnumSet<ActionItemKind> TECHNICAL_KINDS = EnumSet.of(
            ActionItemKind.AUTOMATION_FAILED,
            ActionItemKind.OUTBOX_DEAD_LETTER,
            ActionItemKind.INTEGRATION_DISCONNECTED);

    /**
     * Une nature inconnue est ignorée plutôt que fatale.
     *
     * <p>La table survit au code : après un retour arrière, elle peut contenir
     * des natures que cette version ne connaît plus. Les laisser lever une
     * exception ferait tomber tout le tableau de bord.</p>
     */
    private static boolean isKnownKind(String kind) {
        for (ActionItemKind known : ActionItemKind.values()) {
            if (known.name().equals(kind)) return true;
        }
        return false;
    }

    private static boolean visibleToOwner(ActionItem item, Set<Long> owned, boolean scoped) {
        if (!scoped) return true;
        return item.getPropertyId() != null && owned.contains(item.getPropertyId());
    }

    private static ActionItemDto toDto(ActionItem item) {
        return new ActionItemDto(
                item.getSubjectRef(),
                ActionItemKind.valueOf(item.getKind()),
                item.getSeverity(),
                item.getTitle(),
                item.getDetail(),
                item.getSubject(),
                item.getTargetId(),
                item.getPropertyId(),
                item.getPropertyName(),
                item.getAmount(),
                item.getBadge(),
                item.getActionType(),
                null,
                item.getCurrency(),
                item.getId());
    }
}
