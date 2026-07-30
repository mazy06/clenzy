package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.ActionItem;
import com.clenzy.repository.ActionItemRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

/**
 * Charge une action de la file, et refuse celle d'une autre organisation.
 *
 * <p>La vérification est extraite ici parce qu'elle doit être <b>impossible à
 * oublier</b> : chaque geste et chaque lecture de contexte part d'un identifiant
 * fourni par le client, et {@code findById} contourne le filtre Hibernate. Un
 * identifiant d'action se devine.</p>
 *
 * <p>Pas de {@code @Transactional} : une lecture unique n'en a pas besoin, le
 * repository ouvre la sienne. L'annotation aurait surtout donné l'illusion
 * d'une transaction à des appelants qui, tous, en ouvrent une ailleurs.</p>
 */
@Component
public class ActionItemLoader {

    private final ActionItemRepository actionItemRepository;

    public ActionItemLoader(ActionItemRepository actionItemRepository) {
        this.actionItemRepository = actionItemRepository;
    }

    /** L'action, si elle appartient bien à cette organisation. */
    public ActionItem load(Long actionItemId, Long orgId) {
        final ActionItem item = actionItemRepository.findById(actionItemId)
                .orElseThrow(() -> new IllegalArgumentException("Action introuvable"));
        if (orgId == null || !orgId.equals(item.getOrganizationId())) {
            throw new AccessDeniedException("Action hors organisation");
        }
        return item;
    }

    /**
     * L'action, à condition qu'elle soit bien de la nature attendue.
     *
     * <p>Sans ce contrôle, demander le récapitulatif d'un reversement sur
     * l'identifiant d'une invitation irait chercher un reversement portant
     * l'identifiant de cette invitation.</p>
     */
    public ActionItem loadOfKind(Long actionItemId, Long orgId, ActionItemKind expected, String refusal) {
        final ActionItem item = load(actionItemId, orgId);
        if (!expected.name().equals(item.getKind())) {
            throw new IllegalStateException(refusal);
        }
        return item;
    }
}
