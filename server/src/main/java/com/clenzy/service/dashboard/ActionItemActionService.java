package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.ActionItem;
import com.clenzy.service.dashboard.gesture.ActionGestureHandler;
import com.clenzy.service.dashboard.gesture.GestureContext;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Le point d'entrée unique des gestes qu'on peut faire depuis la carte d'une
 * action, sans quitter le tableau de bord.
 *
 * <p>Une file d'actions ne sert à rien si chaque ligne oblige à partir chercher
 * l'écran qui porte le geste — c'est-à-dire à savoir déjà ce que la file vient
 * de nous apprendre.</p>
 *
 * <p><b>Ce service ne fait plus que trois choses</b>, et c'est le but : réserver
 * le geste contre le double-clic, charger l'action en vérifiant qu'elle
 * appartient bien à l'organisation du demandeur, puis appeler le seul
 * {@link ActionGestureHandler} qui réponde au couple (geste, nature). Le travail
 * métier vit dans les handlers, un par geste, chacun ne portant que ses propres
 * dépendances.</p>
 *
 * <p><b>Pourquoi un point d'entrée et pas dix endpoints.</b> Dix endpoints, ce
 * sont dix vérifications d'organisation à ne pas oublier. Ici elle est faite une
 * fois, avant que le moindre handler ne voie l'identifiant.</p>
 *
 * <p><b>Le couple (geste, nature) est un garde, pas un index.</b> Le nom du
 * geste vient du client : sans lui, « libérer la caution » envoyé sur un
 * identifiant d'invitation appellerait le service des cautions avec un
 * identifiant étranger.</p>
 *
 * <p><b>Aucun envoi n'est fait dans une transaction ouverte par ce service.</b>
 * Un envoi est un appel réseau : le tenir dans une transaction la garde ouverte
 * pendant toute sa durée, et une lenteur du fournisseur devient une saturation
 * du pool de connexions.</p>
 */
@Service
public class ActionItemActionService {

    /** Duree du verrou anti double-clic : le temps qu'un geste aboutisse. */
    private static final Duration GESTURE_LOCK = Duration.ofSeconds(20);

    private final ActionItemLoader loader;
    private final StringRedisTemplate redisTemplate;

    /** Les gestes, indexés par leur couple (nom, nature) — voir {@link #index}. */
    private final Map<GestureKey, ActionGestureHandler> handlers;

    /** Les noms de gestes connus, toutes natures confondues. */
    private final Set<String> knownActions;

    public ActionItemActionService(ActionItemLoader loader,
                                   StringRedisTemplate redisTemplate,
                                   List<ActionGestureHandler> handlers) {
        this.loader = loader;
        this.redisTemplate = redisTemplate;
        this.handlers = index(handlers);
        this.knownActions = handlers.stream()
                .map(ActionGestureHandler::action)
                .collect(Collectors.toUnmodifiableSet());
    }

    /**
     * Range les handlers par couple (geste, nature), et <b>échoue au démarrage</b>
     * si deux d'entre eux revendiquent le même.
     *
     * <p>Un doublon signifierait qu'un geste part vers l'un ou l'autre selon
     * l'ordre d'injection de Spring — c'est-à-dire au hasard. Mieux vaut que
     * l'application refuse de démarrer que d'approuver un reversement par le
     * mauvais chemin un jour sur deux.</p>
     */
    private static Map<GestureKey, ActionGestureHandler> index(List<ActionGestureHandler> handlers) {
        final Map<GestureKey, ActionGestureHandler> byKey = new HashMap<>();
        for (ActionGestureHandler handler : handlers) {
            for (ActionItemKind kind : handler.kinds()) {
                final GestureKey key = new GestureKey(handler.action(), kind);
                final ActionGestureHandler previous = byKey.put(key, handler);
                if (previous != null) {
                    throw new IllegalStateException("Deux gestes revendiquent " + key + " : "
                            + previous.getClass().getSimpleName() + " et "
                            + handler.getClass().getSimpleName());
                }
            }
        }
        return Map.copyOf(byKey);
    }

    /**
     * Exécute le geste nommé sur cette action.
     *
     * <p>Rien n'est marqué « traité » ici : ce sont les services métier qui
     * changent l'état, et le balayage suivant fera disparaître la ligne. C'est
     * ce qui garantit qu'une ligne ne disparaît que si le geste a réellement
     * abouti.</p>
     *
     * @throws IllegalStateException si le geste ne s'applique pas à cette nature
     */
    public void act(Long actionItemId, Long orgId, String action, Jwt jwt) {
        act(actionItemId, orgId, action, null, jwt);
    }

    /**
     * Variante des gestes qui visent une cible choisie par l'utilisateur —
     * aujourd'hui l'assignation d'une intervention.
     */
    public void act(Long actionItemId, Long orgId, String action, Long assigneeTeamId, Jwt jwt) {
        act(actionItemId, orgId, action, assigneeTeamId, null, jwt);
    }

    /** Variante des gestes qui portent une date — la replanification. */
    public void act(Long actionItemId, Long orgId, String action,
                    Long assigneeTeamId, LocalDateTime scheduledAt, Jwt jwt) {
        // Un second clic, ou une re-soumission du navigateur, rejouerait le
        // geste. La plupart sont anodins a repeter — acquitter deux fois une
        // alerte ne change rien — mais renvoyer une invitation en cree une
        // NOUVELLE a chaque appel, et confirmer deux fois retraverse le moteur
        // de reservation. Le verrou couvre donc tous les gestes indistinctement.
        if (!claim(actionItemId, action)) {
            throw new IllegalStateException("Ce geste vient d'etre lance : laissez-lui le temps d'aboutir");
        }
        final ActionItem item = loader.load(actionItemId, orgId);
        final ActionItemKind kind = ActionItemKind.valueOf(item.getKind());

        resolve(action, kind).handle(
                new GestureContext(item, orgId, assigneeTeamId, scheduledAt, jwt));
    }

    /**
     * Réessaie l'envoi que cette action signale.
     *
     * <p>Un geste comme les autres, exposé sous son propre chemin parce que
     * l'écran l'appelle sans rien avoir à choisir. Il passe par la même porte —
     * donc par le même verrou et la même vérification d'organisation.</p>
     */
    public void retry(Long actionItemId, Long orgId) {
        act(actionItemId, orgId, "retry", null);
    }

    /**
     * Le handler du couple, ou un refus.
     *
     * <p>Deux refus distincts, parce qu'ils ne disent pas la même chose : un
     * geste que personne ne porte est une erreur de client, un geste porté mais
     * appliqué à la mauvaise nature est une tentative de détournement.</p>
     */
    private ActionGestureHandler resolve(String action, ActionItemKind kind) {
        final ActionGestureHandler handler = handlers.get(new GestureKey(action, kind));
        if (handler != null) return handler;
        if (!knownActions.contains(action)) {
            throw new IllegalStateException("Geste inconnu : " + action);
        }
        throw new IllegalStateException("Le geste " + action + " ne s'applique pas a " + kind);
    }

    /**
     * Reserve ce geste pour quelques secondes.
     *
     * <p>Les fournisseurs de messagerie n'offrent aucune cle d'idempotence —
     * l'email part par SMTP, qui n'en a pas la notion, et l'API WhatsApp de Meta
     * n'en expose pas. Ce verrou ne protege donc pas d'un doublon venu du
     * reseau, mais il elimine celui qui vient de chez nous : le double-clic.</p>
     *
     * <p>Court a dessein : il empeche la repetition immediate, pas une seconde
     * decision prise en connaissance de cause dix secondes plus tard.</p>
     */
    private boolean claim(Long actionItemId, String action) {
        return Boolean.TRUE.equals(redisTemplate.opsForValue()
                .setIfAbsent("action-item:act:" + actionItemId + ":" + action, "1", GESTURE_LOCK));
    }

    /** Le couple qui identifie un geste : son nom, et la nature qu'il accepte. */
    private record GestureKey(String action, ActionItemKind kind) {
        @Override
        public String toString() {
            return action + " sur " + kind;
        }
    }
}
