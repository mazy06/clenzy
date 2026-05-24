package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.model.ChannexSyncLog;
import com.clenzy.integration.channex.repository.ChannexSyncLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Service d'enregistrement des operations Channex en historique persistant
 * — Phase 3 (sync logs page).
 *
 * <p><b>Pourquoi un service dedie</b> : on persiste les logs depuis plusieurs
 * services (push, pull, resync content), parfois dans des transactions qui
 * vont rollback (ex: pushProperty echoue). Pour ne PAS perdre le log d'echec,
 * on utilise {@link Propagation#REQUIRES_NEW} → chaque log est commit dans
 * sa propre transaction, independamment du caller.</p>
 *
 * <p>Best-effort : un echec d'ecriture du log n'a pas le droit de faire
 * tomber la logique metier. Toute exception est swallow + log warn.</p>
 */
@Service
public class ChannexSyncLogService {

    private static final Logger log = LoggerFactory.getLogger(ChannexSyncLogService.class);

    private final ChannexSyncLogRepository repository;

    public ChannexSyncLogService(ChannexSyncLogRepository repository) {
        this.repository = repository;
    }

    /**
     * Enregistre une operation de sync. Cree une transaction independante du
     * caller (REQUIRES_NEW) pour ne pas perdre le log si le caller rollback.
     *
     * @param orgId        organisation
     * @param propertyId   property Clenzy
     * @param mappingId    UUID du mapping (peut etre null si pre-mapping)
     * @param type         type d'operation
     * @param status       resultat
     * @param recordCount  nb d'updates / bookings concernes
     * @param startedAt    instant de debut (pour calcul de duration)
     * @param errorMessage detail si echec (tronque a 1000 chars)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Long orgId, Long propertyId, UUID mappingId,
                        ChannexSyncLog.SyncType type, ChannexSyncLog.Status status,
                        int recordCount, Instant startedAt, String errorMessage) {
        try {
            ChannexSyncLog logEntry = new ChannexSyncLog();
            logEntry.setOrganizationId(orgId);
            logEntry.setClenzyPropertyId(propertyId);
            logEntry.setMappingId(mappingId);
            logEntry.setSyncType(type);
            logEntry.setStatus(status);
            logEntry.setRecordCount(recordCount);
            logEntry.setStartedAt(startedAt != null ? startedAt : Instant.now());
            logEntry.setFinishedAt(Instant.now());
            logEntry.setDurationMs(java.time.Duration.between(logEntry.getStartedAt(),
                logEntry.getFinishedAt()).toMillis());
            if (errorMessage != null && errorMessage.length() > 1000) {
                logEntry.setErrorMessage(errorMessage.substring(0, 1000) + "…");
            } else {
                logEntry.setErrorMessage(errorMessage);
            }
            repository.save(logEntry);
        } catch (Exception e) {
            // Ne JAMAIS impacter la logique metier sur un echec d'ecriture de log
            log.warn("ChannexSyncLog: ecriture KO property={} type={} status={}: {}",
                propertyId, type, status, e.getMessage());
        }
    }
}
