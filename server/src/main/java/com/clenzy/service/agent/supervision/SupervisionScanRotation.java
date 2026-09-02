package com.clenzy.service.agent.supervision;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Tour de rôle du balayage périodique : retient QUAND chaque logement a été
 * scanné pour la dernière fois, et désigne ceux dont c'est le tour.
 *
 * <p>C'est ce qui permet au balayage d'être un vrai filet : le déclenchement
 * événementiel ne couvre que les logements qui bougent (réservation, devis,
 * intervention), et un logement calme n'était jamais revu. Ici, tout logement
 * candidat finit par remonter — le plus anciennement vu d'abord.</p>
 *
 * <p>Sorted set Redis par org (score = seconde epoch du dernier scan, TTL 30
 * jours refixé à chaque écriture). Un logement absent du set n'a jamais été
 * scanné : il passe devant tous les autres. Une entrée qui survit à la
 * suppression de son logement est simplement ignorée — elle n'est jamais
 * candidate, puisque les candidats viennent de la base.</p>
 *
 * <p><b>Fail-closed</b> comme {@link SupervisionScanQuota} : Redis indisponible
 * → aucun logement désigné. Sans mémoire du dernier passage, désigner quand
 * même reviendrait à rescanner les mêmes logements à chaque cycle et à épuiser
 * le budget de l'organisation sur eux.</p>
 */
@Service
public class SupervisionScanRotation {

    private static final String KEY_PREFIX = "supervision:lastscan:org:";
    private static final Duration TTL = Duration.ofDays(30);
    /** Score d'un logement jamais scanné : passe avant tous les autres. */
    private static final double NEVER_SCANNED = Double.NEGATIVE_INFINITY;

    private final StringRedisTemplate redisTemplate;
    private final Clock clock;

    public SupervisionScanRotation(StringRedisTemplate redisTemplate, Clock clock) {
        this.redisTemplate = redisTemplate;
        this.clock = clock;
    }

    /**
     * Note qu'un logement vient d'être passé en revue — le tour de rôle repart
     * de lui. Appelé pour toute tentative ayant consommé du budget, y compris
     * en échec : sans quoi un logement qui échoue systématiquement resterait en
     * tête et empêcherait les suivants de passer.
     */
    public void markScanned(Long organizationId, Long propertyId) {
        if (organizationId == null || propertyId == null) {
            return;
        }
        try {
            String key = key(organizationId);
            redisTemplate.opsForZSet().add(key, String.valueOf(propertyId),
                    clock.instant().getEpochSecond());
            redisTemplate.expire(key, TTL);
        } catch (Exception e) {
            // Best-effort : au pire le logement est repris au cycle suivant.
        }
    }

    /**
     * Les {@code max} logements les plus anciennement scannés parmi
     * {@code candidates}, en écartant ceux revus depuis moins de
     * {@code minInterval}. Jamais scanné = priorité absolue.
     *
     * @return liste ordonnée du plus ancien au plus récent, vide s'il n'y a
     *         rien à revoir (ou si Redis est indisponible)
     */
    public List<Long> dueForScan(Long organizationId, Collection<Long> candidates,
                                 Duration minInterval, int max) {
        if (organizationId == null || candidates == null || candidates.isEmpty() || max <= 0) {
            return List.of();
        }
        final Map<Long, Double> lastScan;
        try {
            lastScan = lastScanScores(organizationId);
        } catch (Exception e) {
            return List.of(); // fail-closed : pas de mémoire, pas de désignation
        }
        final double cutoff = clock.instant().minus(minInterval).getEpochSecond();
        return candidates.stream()
                .filter(Objects::nonNull)
                .distinct()
                .map(id -> Map.entry(id, lastScan.getOrDefault(id, NEVER_SCANNED)))
                .filter(entry -> entry.getValue() <= cutoff)
                .sorted(Map.Entry.comparingByValue())
                .limit(max)
                .map(Map.Entry::getKey)
                .toList();
    }

    /** Dernier passage par logement (une seule lecture Redis pour l'org). */
    private Map<Long, Double> lastScanScores(Long organizationId) {
        Set<ZSetOperations.TypedTuple<String>> tuples =
                redisTemplate.opsForZSet().rangeWithScores(key(organizationId), 0, -1);
        if (tuples == null || tuples.isEmpty()) {
            return Map.of();
        }
        Map<Long, Double> scores = new HashMap<>(tuples.size());
        for (ZSetOperations.TypedTuple<String> tuple : tuples) {
            if (tuple == null || tuple.getValue() == null || tuple.getScore() == null) {
                continue;
            }
            try {
                scores.put(Long.parseLong(tuple.getValue()), tuple.getScore());
            } catch (NumberFormatException e) {
                // Membre étranger au format attendu : ignoré.
            }
        }
        return scores;
    }

    private static String key(Long organizationId) {
        return KEY_PREFIX + organizationId;
    }
}
