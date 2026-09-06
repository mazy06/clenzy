package com.clenzy.service.dashboard;

import com.clenzy.dto.BulkGestureDto;
import com.clenzy.dto.BulkGestureResultDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.ActionItem;
import com.clenzy.repository.ActionItemRepository;
import com.clenzy.service.dashboard.gesture.ActionGestureHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Applique un geste à toute une rubrique de la file.
 *
 * <p>Trente envois tombés ensemble parce qu'un fournisseur a eu une panne se
 * reprennent ensemble : les rouvrir un à un, c'est trente fois la même
 * décision. Le lot n'existe donc que là où la répétition n'ajoute aucune
 * décision — {@link ActionGestureHandler#bulkable()} en est le seul juge, et il
 * répond non par défaut.</p>
 *
 * <p><b>Le client ne fournit aucune liste d'identifiants.</b> Il nomme une
 * nature et un geste ; c'est le serveur qui va chercher les lignes ouvertes de
 * cette nature <b>dans l'organisation du demandeur</b>. Laisser le client
 * choisir les cibles reviendrait à lui laisser désigner des lignes qu'il n'a
 * jamais vues — l'écran n'en reçoit qu'une dizaine.</p>
 *
 * <p><b>Aucune transaction ici, à dessein.</b> Chaque geste ouvre la sienne, et
 * plusieurs partent chez un fournisseur externe. Une transaction qui
 * envelopperait le lot resterait ouverte pendant tous ces appels réseau et
 * saturerait le pool de connexions ; elle annulerait de surcroît des envois
 * déjà partis, qu'aucun rollback ne rattrape.</p>
 */
@Service
public class ActionItemBulkService {

    private static final Logger log = LoggerFactory.getLogger(ActionItemBulkService.class);

    /**
     * Lignes traitées par appel.
     *
     * <p>Le lot tient dans une requête HTTP : au-delà, le fil d'exécution reste
     * pris pendant des minutes et le navigateur abandonne avant la fin, laissant
     * l'utilisateur sans réponse alors que les gestes, eux, continuent de
     * partir. Le reliquat est annoncé, et un second appel le reprend.</p>
     */
    static final int BATCH_SIZE = 50;

    /**
     * Le lot se réserve, comme un geste isolé se réserve.
     *
     * <p>Plus long que le verrou par ligne : c'est la durée d'un lot entier, et
     * deux lots simultanés sur la même rubrique se marcheraient dessus — le
     * second ne trouverait que des lignes déjà en cours de traitement et
     * n'écrirait qu'une liste d'échecs trompeurs.</p>
     */
    private static final Duration BULK_LOCK = Duration.ofMinutes(2);

    private final ActionItemRepository actionItemRepository;
    private final ActionItemActionService actionService;
    private final StringRedisTemplate redisTemplate;
    private final Clock clock;

    /** Les gestes de masse autorisés, par nature. */
    private final Map<ActionItemKind, String> bulkableByKind;

    public ActionItemBulkService(ActionItemRepository actionItemRepository,
                                 ActionItemActionService actionService,
                                 StringRedisTemplate redisTemplate,
                                 Clock clock,
                                 List<ActionGestureHandler> handlers) {
        this.actionItemRepository = actionItemRepository;
        this.actionService = actionService;
        this.redisTemplate = redisTemplate;
        this.clock = clock;
        this.bulkableByKind = index(handlers);
    }

    /**
     * Range les gestes de masse par nature, et <b>échoue au démarrage</b> si
     * deux d'entre eux revendiquent la même.
     *
     * <p>Une nature ne peut porter qu'un geste de masse : deux boutons pour la
     * même rubrique n'auraient aucun moyen d'être distingués par l'écran, qui
     * n'en affiche qu'un. Mieux vaut que l'application refuse de démarrer que
     * de laisser Spring trancher par l'ordre d'injection.</p>
     */
    private static Map<ActionItemKind, String> index(List<ActionGestureHandler> handlers) {
        final Map<ActionItemKind, String> byKind = new HashMap<>();
        for (ActionGestureHandler handler : handlers) {
            if (!handler.bulkable()) continue;
            for (ActionItemKind kind : handler.kinds()) {
                final String previous = byKind.put(kind, handler.action());
                if (previous != null) {
                    throw new IllegalStateException("Deux gestes de masse revendiquent " + kind
                            + " : " + previous + " et " + handler.action());
                }
            }
        }
        return Map.copyOf(byKind);
    }

    /** Les rubriques qui peuvent se traiter d'un geste, pour que l'écran sache quoi proposer. */
    public List<BulkGestureDto> bulkGestures() {
        return bulkableByKind.entrySet().stream()
                .map(entry -> new BulkGestureDto(entry.getKey(), entry.getValue()))
                .sorted(Comparator.comparing(gesture -> gesture.kind().name()))
                .collect(Collectors.toList());
    }

    /**
     * Applique le geste de la nature à toutes ses lignes ouvertes, par lot.
     *
     * <p>Un échec n'interrompt pas le lot : les vingt-neuf autres lignes n'y
     * sont pour rien. Il n'est pas avalé pour autant — il est journalisé, et il
     * ressort dans le résultat, nommé, pour que l'utilisateur sache exactement
     * ce qui reste à faire. C'est l'inverse d'un {@code catch} silencieux : rien
     * ne disparaît, tout est rendu.</p>
     *
     * @throws IllegalStateException si la nature ne porte aucun geste de masse,
     *                               ou si un lot est déjà en cours dessus
     */
    public BulkGestureResultDto apply(Long orgId, ActionItemKind kind, Jwt jwt) {
        final String action = bulkableByKind.get(kind);
        if (action == null) {
            throw new IllegalStateException("Aucun geste de masse pour " + kind);
        }
        if (!claim(orgId, kind)) {
            throw new IllegalStateException("Un traitement de masse est deja en cours sur cette rubrique");
        }

        try {
            return run(orgId, kind, action, jwt);
        } finally {
            // Rendu tout de suite : le résultat annonce un reliquat et invite à
            // relancer. Un verrou qui ne tomberait qu'à expiration refuserait
            // pendant deux minutes le second lot qu'on vient de demander.
            redisTemplate.delete(lockKey(orgId, kind));
        }
    }

    /** Le lot lui-même, une fois la rubrique réservée. */
    private BulkGestureResultDto run(Long orgId, ActionItemKind kind, String action, Jwt jwt) {
        final Instant now = clock.instant();
        final List<ActionItem> batch = actionItemRepository.findOpenForOrgAndKind(
                orgId, kind.name(), now, PageRequest.of(0, BATCH_SIZE));

        final List<BulkGestureResultDto.Failure> failures = new ArrayList<>();
        int succeeded = 0;
        for (ActionItem item : batch) {
            try {
                actionService.act(item.getId(), orgId, action, jwt);
                succeeded++;
            } catch (RuntimeException failure) {
                log.warn("Geste de masse {} en echec sur l'action {} (org={}) : {}",
                        action, item.getId(), orgId, failure.toString());
                failures.add(new BulkGestureResultDto.Failure(
                        item.getId(), item.getTitle(), readableReason(failure)));
            }
        }

        // Recompté après coup, jamais déduit : les gestes qui aboutissent ne
        // referment pas tous leur ligne immédiatement — c'est le balayage qui
        // le fait, une fois la cause disparue. Une soustraction annoncerait un
        // reliquat qui n'existe pas.
        final long remaining = actionItemRepository.countOpenForOrgAndKind(orgId, kind.name(), now);

        log.info("Geste de masse {} sur {} : {}/{} aboutis, {} restants (org={})",
                action, kind, succeeded, batch.size(), remaining, orgId);
        return new BulkGestureResultDto(
                batch.size(), succeeded, failures.size(), remaining, List.copyOf(failures));
    }

    /**
     * La raison, quand elle est faite pour être lue.
     *
     * <p>Les refus métier portent une phrase écrite pour l'utilisateur. Tout le
     * reste — panne réseau, contrainte violée — porte un message technique
     * qui, affiché tel quel, renseigne surtout un attaquant. Il est journalisé,
     * pas rendu.</p>
     */
    private static String readableReason(RuntimeException failure) {
        if (failure instanceof IllegalStateException || failure instanceof IllegalArgumentException) {
            final String message = failure.getMessage();
            if (message != null && !message.isBlank()) return message;
        }
        return "Echec technique";
    }

    /** Réserve cette rubrique le temps du lot. */
    private boolean claim(Long orgId, ActionItemKind kind) {
        return Boolean.TRUE.equals(redisTemplate.opsForValue()
                .setIfAbsent(lockKey(orgId, kind), "1", BULK_LOCK));
    }

    private static String lockKey(Long orgId, ActionItemKind kind) {
        return "action-item:bulk:" + orgId + ":" + kind.name();
    }
}
