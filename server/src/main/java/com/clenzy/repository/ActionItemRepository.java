package com.clenzy.repository;

import com.clenzy.model.ActionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Accès à la file d'attente persistée.
 *
 * <p>Lecture dominante : la file ouverte d'une organisation, en une requête
 * indexée qui ne joint aucune table métier.</p>
 */
@Repository
public interface ActionItemRepository extends JpaRepository<ActionItem, Long> {

    /**
     * La file ouverte, hors actions reportées à plus tard.
     *
     * <p>Ordonnée ici et non en mémoire : le plafonnement se fait ensuite sur
     * une liste déjà triée par urgence.</p>
     */
    @Query("""
            SELECT a FROM ActionItem a
            WHERE a.organizationId = :orgId
              AND a.status = 'OPEN'
              AND (a.snoozedUntil IS NULL OR a.snoozedUntil <= :now)
            ORDER BY a.severityRank ASC, a.deadlineAt ASC NULLS LAST, a.firstSeenAt ASC
            """)
    List<ActionItem> findOpenForOrg(@Param("orgId") Long orgId, @Param("now") Instant now);

    Optional<ActionItem> findByOrganizationIdAndKindAndSubjectRef(
            Long organizationId, String kind, String subjectRef);

    /**
     * Les lignes dérivées d'une organisation, <b>ouvertes comme closes</b>.
     *
     * <p>Les closes sont indispensables : une anomalie qui disparaît puis
     * revient — un solde payé puis de nouveau dû, un flux qui se rétablit puis
     * retombe — retrouve la même identité {@code (org, nature, sujet)}. Ne
     * charger que les ouvertes ferait tenter une insertion sur une clé déjà
     * prise, et le balayage échouerait sur une contrainte d'unicité.</p>
     */
    @Query("""
            SELECT a FROM ActionItem a
            WHERE a.organizationId = :orgId
              AND a.source = 'DERIVED'
              AND a.kind IN :kinds
            """)
    List<ActionItem> findDerivedForOrg(@Param("orgId") Long orgId,
                                       @Param("kinds") Collection<String> kinds);

    /**
     * Referme d'un coup les lignes dérivées que le balayage n'a plus retrouvées.
     *
     * <p>Restreint aux natures effectivement balayées : si une source échoue,
     * ses lignes ne doivent pas être closes — on effacerait des actions
     * toujours valides parce qu'une requête a échoué.</p>
     */
    @Modifying
    @Query("""
            UPDATE ActionItem a
               SET a.status = 'RESOLVED', a.resolvedAt = :sweptAt, a.resolvedBy = 'sweep'
             WHERE a.organizationId = :orgId
               AND a.source = 'DERIVED'
               AND a.status = 'OPEN'
               AND a.kind IN :kinds
               AND a.lastSeenAt < :sweptAt
            """)
    int closeUnseen(@Param("orgId") Long orgId,
                    @Param("kinds") Collection<String> kinds,
                    @Param("sweptAt") Instant sweptAt);

    /** Organisations ayant au moins une action ouverte — pour cibler les balayages. */
    @Query("SELECT DISTINCT a.organizationId FROM ActionItem a WHERE a.status = 'OPEN'")
    List<Long> findOrganizationIdsWithOpenItems();
}
