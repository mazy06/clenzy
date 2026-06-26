package com.clenzy.service.retention;

import com.clenzy.repository.GuestDeclarationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * {@link PurgeSource} de la fiche de police / déclaration voyageur — cible {@code police-records}.
 *
 * <p>Ferme la boucle de purge de la {@link com.clenzy.model.GuestDeclaration} : suppression
 * obligatoire à <b>6 mois / 180 jours</b> (CESEDA R814-3 ; cf. {@code RETENTION-POLICY.md} §6 et
 * {@code RETENTION-PURGE.md} §7). La durée n'est PAS codée ici — elle vient de la config
 * {@code clenzy.retention.purge.targets[name=police-records].retention-days}. Le {@code cutoff} est
 * calculé par le moteur ({@code now - retentionDays}).</p>
 *
 * <p><b>Fournir cette source ne déclenche RIEN</b> tant que {@code clenzy.retention.purge.enabled}
 * reste à {@code false} (défaut) et qu'aucune cible {@code police-records} n'est configurée : le
 * moteur reste inerte (no-op {@code purge-disabled} / {@code unknown-target}). C'est voulu — la
 * source lève seulement le verrou #2 (« aucune PurgeSource fournie »).</p>
 *
 * <p>Horodatage de référence : {@code created_at}. La conversion {@code Instant → LocalDateTime}
 * utilise la zone système, cohérente avec l'écriture {@code @CreationTimestamp} (zone JVM) — il
 * s'agit d'un balayage de rétention système, pas d'une date affichée à un voyageur.</p>
 */
@Component
public class GuestDeclarationPurgeSource implements PurgeSource {

    /** Doit matcher {@code clenzy.retention.purge.targets[].name}. */
    static final String TARGET_NAME = "police-records";

    private final GuestDeclarationRepository repository;
    private final ZoneId zoneId;

    @Autowired
    public GuestDeclarationPurgeSource(GuestDeclarationRepository repository) {
        this(repository, ZoneId.systemDefault());
    }

    /** Constructeur testable (zone explicite). */
    GuestDeclarationPurgeSource(GuestDeclarationRepository repository, ZoneId zoneId) {
        this.repository = repository;
        this.zoneId = zoneId;
    }

    @Override
    public String targetName() {
        return TARGET_NAME;
    }

    @Override
    @Transactional(readOnly = true)
    public long countExpired(Instant cutoff) {
        return repository.countByCreatedAtLessThanEqual(toLocalDateTime(cutoff));
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int deleteExpiredBatch(Instant cutoff, int limit) {
        if (limit <= 0) {
            return 0;
        }
        // Tri stable par id, borné par le batch : on sélectionne au plus `limit` ids puis on supprime.
        List<Long> ids = repository.findIdsCreatedBefore(toLocalDateTime(cutoff), PageRequest.of(0, limit));
        if (ids.isEmpty()) {
            return 0;
        }
        repository.deleteAllByIdInBatch(ids);
        return ids.size();
    }

    private LocalDateTime toLocalDateTime(Instant cutoff) {
        return LocalDateTime.ofInstant(cutoff, zoneId);
    }
}
