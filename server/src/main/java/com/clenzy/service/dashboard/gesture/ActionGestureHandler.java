package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;

import java.util.Set;

/**
 * Un geste que l'on peut faire depuis la carte d'une action.
 *
 * <p>Le service qui les portait tous avait fini avec vingt-cinq dépendances :
 * chaque geste ajouté y injectait le sien, et la classe est devenue le God
 * Object que ce projet interdit — celui-là même qu'on avait chassé de
 * {@code DashboardOperationsService} quelques heures plus tôt. Le remède est le
 * même : un gestionnaire porte son geste et ses dépendances, l'orchestrateur ne
 * fait plus qu'aiguiller.</p>
 *
 * <p><b>La nature déclarée est un garde, pas une étiquette.</b> Le nom du geste
 * vient du client : sans elle, « libérer la caution » envoyé sur un identifiant
 * d'invitation appellerait le service des cautions avec un identifiant
 * étranger. L'aiguillage refuse donc tout geste dont la nature ne correspond
 * pas — la garde n'est plus à écrire, elle découle de la déclaration.</p>
 */
public interface ActionGestureHandler {

    /** Le nom du geste, tel qu'il arrive du client. */
    String action();

    /**
     * Les natures sur lesquelles ce geste s'applique.
     *
     * <p>Plusieurs quand un même geste vaut pour plusieurs natures : relancer
     * un envoi couvre aussi bien un document non délivré qu'un message
     * voyageur en échec.</p>
     */
    Set<ActionItemKind> kinds();

    void handle(GestureContext context);
}
