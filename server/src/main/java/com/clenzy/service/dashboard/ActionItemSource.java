package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;

import java.util.List;
import java.util.Set;

/**
 * Une famille d'actions en attente, capable de se découvrir elle-même.
 *
 * <p>Chaque source porte son propre accès aux données : ajouter une nature est
 * un fichier, pas une modification de l'orchestrateur. Sans cela, vingt-cinq
 * natures auraient produit un service de mille deux cents lignes et vingt
 * dépendances.</p>
 *
 * <p>Ces sources ne sont plus interrogées à l'affichage. C'est le
 * {@link ActionItemReconciler} qui les appelle, hors du chemin de
 * l'utilisateur, et qui écrit le résultat dans la file persistée. L'écran, lui,
 * lit une table indexée.</p>
 */
public interface ActionItemSource {

    /**
     * Ce que cette source rend visible.
     *
     * <p>{@link Scope#BUSINESS} — une décision de gestion : un paiement, un
     * séjour, une équipe. {@link Scope#TECHNICAL} — une panne de plomberie
     * interne : automatisation en échec, file de messages saturée, intégration
     * déconnectée. Le second groupe n'a de sens que pour l'équipe plateforme ;
     * l'afficher à un hôte reviendrait à lui montrer une alarme qu'il ne peut
     * pas éteindre.</p>
     */
    enum Scope {
        BUSINESS,
        TECHNICAL
    }

    /** Les actions en attente pour cette organisation, ou une liste vide. */
    List<ActionItemDto> collect(ActionItemContext context);

    /**
     * Les natures que cette source a autorité pour produire.
     *
     * <p>Le réconciliateur s'en sert pour savoir quoi refermer : une ligne
     * d'une de ces natures que la source ne remonte plus a cessé d'exister.
     * Déclarer une nature qu'on ne produit pas reviendrait donc à effacer le
     * travail d'une autre source.</p>
     */
    Set<ActionItemKind> kinds();

    Scope scope();
}
