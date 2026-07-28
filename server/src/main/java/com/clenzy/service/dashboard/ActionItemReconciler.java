package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.model.ActionItem;
import com.clenzy.model.UserRole;
import com.clenzy.repository.ActionItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Remet la file en accord avec la réalité, pour une organisation.
 *
 * <p>C'est le seul endroit qui interroge encore le métier. Il le fait hors du
 * chemin de l'utilisateur : l'écran, lui, lit une table indexée.</p>
 *
 * <p><b>Ce que le balayage ne trouve plus, il le referme.</b> C'est le
 * mécanisme central, et il évite d'avoir à publier un événement de clôture pour
 * chaque nature dérivée : si une réservation a été confirmée, la source ne la
 * remonte plus, la ligne se ferme d'elle-même. La table ne peut donc pas
 * dériver silencieusement.</p>
 *
 * <p><b>Deux garde-fous</b>, sans lesquels ce mécanisme serait dangereux :</p>
 * <ul>
 *   <li>Les lignes issues d'un <b>événement</b> ne sont jamais refermées ici :
 *       aucune requête ne peut redécouvrir un litige bancaire, le balayage le
 *       ferait donc disparaître à son premier passage.</li>
 *   <li>Une source qui <b>échoue</b> ne referme rien : seules les natures
 *       effectivement collectées entrent dans la clôture. Sans cela, une
 *       requête en erreur effacerait des actions parfaitement valides.</li>
 * </ul>
 */
@Service
public class ActionItemReconciler {

    private static final Logger log = LoggerFactory.getLogger(ActionItemReconciler.class);

    private final List<ActionItemSource> sources;
    private final ActionItemRepository repository;
    private final Clock clock;

    public ActionItemReconciler(List<ActionItemSource> sources,
                                ActionItemRepository repository,
                                Clock clock) {
        this.sources = sources;
        this.repository = repository;
        this.clock = clock;
    }

    /**
     * Recalcule la file d'une organisation et l'enregistre.
     *
     * <p>Le balayage voit <b>tout</b> ce que l'organisation contient, natures
     * techniques comprises : le cloisonnement par rôle est une affaire de
     * lecture, pas de collecte. Restreindre ici obligerait à balayer une fois
     * par rôle.</p>
     *
     * @return le nombre d'actions ouvertes après réconciliation
     */
    @Transactional
    public int reconcile(Long organizationId) {
        final Instant sweptAt = clock.instant();
        // Le balayage n'a pas d'utilisateur : pas de périmètre propriétaire, et
        // un rôle plateforme pour que rien ne soit écarté à la collecte.
        final ActionItemContext context = ActionItemContext.of(
                organizationId, UserRole.SUPER_ADMIN, null, clock);

        final List<ActionItemDto> found = new ArrayList<>();
        final Set<String> sweptKinds = new HashSet<>();

        for (ActionItemSource source : sources) {
            try {
                final List<ActionItemDto> items = source.collect(context);
                found.addAll(items);
                // Les natures d'une source qui a RÉUSSI, même sans résultat :
                // c'est ce qui permet de refermer une ligne devenue caduque.
                source.kinds().forEach(kind -> sweptKinds.add(kind.name()));
            } catch (RuntimeException e) {
                // On n'avale pas : on trace et on exclut ses natures de la
                // clôture, pour ne rien effacer sur la foi d'une requête ratée.
                log.error("Balayage : la source {} a echoue pour org={} — ses natures sont "
                        + "exclues de la cloture", source.getClass().getSimpleName(), organizationId, e);
            }
        }

        if (sweptKinds.isEmpty()) return 0;

        upsert(organizationId, found, sweptKinds, sweptAt);
        final int closed = repository.closeUnseen(organizationId, sweptKinds, sweptAt);

        log.debug("Balayage org={} : {} action(s) confirmee(s), {} close(s)",
                organizationId, found.size(), closed);
        return found.size();
    }

    /**
     * Écrit l'état trouvé, en réutilisant les lignes existantes.
     *
     * <p>Réutiliser plutôt que recréer n'est pas une économie : c'est ce qui
     * préserve {@code firstSeenAt}, l'assignation et le report. Une action
     * recréée à chaque balayage perdrait son âge — et l'âge est précisément ce
     * qui distingue un oubli d'un délai normal.</p>
     *
     * <p>Les lignes <b>closes</b> sont relues elles aussi : une anomalie qui
     * revient reprend son ancienne ligne et repasse à l'état ouvert. Sans cela
     * on tenterait une insertion sur une identité déjà prise, et le balayage
     * s'arrêterait sur une contrainte d'unicité.</p>
     */
    private void upsert(Long organizationId, List<ActionItemDto> found,
                        Set<String> sweptKinds, Instant sweptAt) {
        final Map<String, ActionItem> existing = repository
                .findDerivedForOrg(organizationId, sweptKinds).stream()
                .collect(Collectors.toMap(
                        item -> key(item.getKind(), item.getSubjectRef()),
                        Function.identity(),
                        (a, b) -> a));

        final List<ActionItem> toSave = new ArrayList<>();
        for (ActionItemDto dto : found) {
            final ActionItem item = existing.getOrDefault(
                    key(dto.kind().name(), dto.id()), newItem(organizationId, dto, sweptAt));
            apply(item, dto, sweptAt);
            toSave.add(item);
        }
        repository.saveAll(toSave);
    }

    private static ActionItem newItem(Long organizationId, ActionItemDto dto, Instant sweptAt) {
        final ActionItem item = new ActionItem();
        item.setOrganizationId(organizationId);
        item.setKind(dto.kind().name());
        // L'identifiant de ligne du DTO EST l'identité de l'action (« balance:88 »).
        item.setSubjectRef(dto.id());
        item.setSource(ActionItem.SOURCE_DERIVED);
        item.setFirstSeenAt(sweptAt);
        return item;
    }

    /** Rafraîchit ce que l'écran affiche ; ne touche ni à l'âge ni à l'assignation. */
    private static void apply(ActionItem item, ActionItemDto dto, Instant sweptAt) {
        item.setStatus(ActionItem.STATUS_OPEN);
        item.setSeverity(dto.severity());
        item.setTitle(dto.title());
        item.setDetail(dto.detail());
        item.setSubject(dto.subject());
        item.setTargetId(dto.targetId());
        item.setPropertyId(dto.propertyId());
        item.setPropertyName(dto.propertyName());
        item.setAmount(dto.amount());
        item.setCurrency(dto.currency());
        item.setBadge(dto.badge());
        item.setActionType(dto.actionType());
        item.setLastSeenAt(sweptAt);
    }

    private static String key(String kind, String subjectRef) {
        return kind + '|' + subjectRef;
    }
}
