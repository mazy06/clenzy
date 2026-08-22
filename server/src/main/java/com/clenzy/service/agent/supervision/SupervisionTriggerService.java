package com.clenzy.service.agent.supervision;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Déclencheur event-driven de la boucle autonome : marque les logements « dirty »
 * (un événement métier les concerne) pour que le scanner les priorise.
 *
 * <p>Set Redis par org (TTL 1 jour). Best-effort : une panne Redis ne casse
 * jamais le flux métier appelant. Le debounce/coalescing est <b>naturel</b> :
 * plusieurs événements sur un même logement entre deux cadences du scanner =
 * une seule entrée dans le set = un seul scan.</p>
 */
@Service
public class SupervisionTriggerService {

    private static final String KEY_PREFIX = "supervision:dirty:org:";
    private static final Duration TTL = Duration.ofDays(1);

    private final StringRedisTemplate redisTemplate;

    public SupervisionTriggerService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /** Marque un logement comme à scanner (événement métier reçu). */
    public void markDirty(Long organizationId, Long propertyId) {
        if (organizationId == null || propertyId == null) {
            return;
        }
        try {
            String key = key(organizationId);
            redisTemplate.opsForSet().add(key, String.valueOf(propertyId));
            redisTemplate.expire(key, TTL);
        } catch (Exception e) {
            // best-effort : un marquage raté = ce logement ne sera pas auto-scanné ce cycle
        }
    }

    /**
     * Marque le logement une fois la transaction appelante <b>validee</b> — et
     * immediatement s'il n'y en a aucune.
     *
     * <p>Un marquage pose au milieu d'une transaction qui finit par echouer ferait
     * scanner un logement pour un evenement qui n'a jamais eu lieu. Le cout est
     * modeste (un scan a vide), la confusion l'est moins : la carte porterait sur
     * un etat inexistant.</p>
     */
    public void markDirtyAfterCommit(Long organizationId, Long propertyId) {
        if (organizationId == null || propertyId == null) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            markDirty(organizationId, propertyId);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                markDirty(organizationId, propertyId);
            }
        });
    }

    /**
     * Vide et retourne les logements « dirty » de l'org (lecture + suppression).
     * Vide → ensemble vide (rien à scanner).
     */
    public Set<Long> drainDirty(Long organizationId) {
        if (organizationId == null) {
            return Set.of();
        }
        try {
            String key = key(organizationId);
            Set<String> members = redisTemplate.opsForSet().members(key);
            if (members == null || members.isEmpty()) {
                return Set.of();
            }
            redisTemplate.delete(key);
            return members.stream().map(Long::parseLong).collect(Collectors.toSet());
        } catch (Exception e) {
            return Set.of();
        }
    }

    private static String key(Long organizationId) {
        return KEY_PREFIX + organizationId;
    }
}
