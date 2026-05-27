package com.clenzy.repository;

import com.clenzy.model.AssistantMemory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AssistantMemoryRepository extends JpaRepository<AssistantMemory, Long> {

    /**
     * Liste de toutes les memoires d'un user, triees par scope ASC puis updatedAt DESC.
     * Utilisee par l'orchestrateur pour injecter la memoire dans le system prompt.
     * Le filtre Hibernate organizationFilter ajoute la contrainte multi-tenant.
     */
    @Query("SELECT m FROM AssistantMemory m WHERE m.keycloakId = :keycloakId "
            + "ORDER BY m.scope ASC, m.updatedAt DESC, m.id DESC")
    List<AssistantMemory> findAllByUser(@Param("keycloakId") String keycloakId);

    /**
     * Variante paginee — utilisee pour limiter le nombre d'entrees injectees
     * dans le system prompt (top N plus recentes).
     */
    @Query("SELECT m FROM AssistantMemory m WHERE m.keycloakId = :keycloakId "
            + "ORDER BY m.updatedAt DESC, m.id DESC")
    List<AssistantMemory> findRecentByUser(@Param("keycloakId") String keycloakId, Pageable pageable);

    /**
     * Resolution d'une entree par (user, key) pour l'upsert du tool remember_fact.
     */
    @Query("SELECT m FROM AssistantMemory m WHERE m.keycloakId = :keycloakId "
            + "AND m.memoryKey = :memoryKey")
    Optional<AssistantMemory> findByUserAndKey(@Param("keycloakId") String keycloakId,
                                                @Param("memoryKey") String memoryKey);

    /**
     * Suppression par cle (forget_fact). Retourne le nombre de lignes supprimees.
     */
    @Modifying
    @Query("DELETE FROM AssistantMemory m WHERE m.keycloakId = :keycloakId "
            + "AND m.memoryKey = :memoryKey")
    int deleteByUserAndKey(@Param("keycloakId") String keycloakId,
                            @Param("memoryKey") String memoryKey);

    /**
     * Recherche par similarite cosine via pgvector (operator {@code <=>}).
     *
     * <p><b>Filtre tenant explicite</b> : les native queries Hibernate ne sont
     * PAS soumises au {@code organizationFilter}, donc on filtre manuellement
     * sur {@code organization_id} en plus de {@code keycloak_id}. Defense en
     * profondeur : un meme keycloakId pourrait theoriquement avoir des
     * memoires dans plusieurs orgs (cas SUPER_ADMIN multi-org) — ce filtre
     * empeche la fuite cross-org.</p>
     *
     * <p>Retourne une {@code List<Object[]>} : {@code [id, distance]}. Le caller
     * hydrate les entites via {@code findAllById} en respectant l'ordre.</p>
     */
    @Query(value = """
            SELECT id, (embedding <=> CAST(:queryEmbedding AS vector)) AS distance
            FROM assistant_memory
            WHERE keycloak_id = :keycloakId
              AND organization_id = :organizationId
              AND embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:queryEmbedding AS vector)
            LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> searchByCosineSimilarity(@Param("queryEmbedding") String queryEmbedding,
                                              @Param("keycloakId") String keycloakId,
                                              @Param("organizationId") Long organizationId,
                                              @Param("limit") int limit);

    /**
     * Bump batch de {@code last_accessed_at} sur un ensemble d'ids. Utilise par
     * le service apres chaque lecture pour eviter le N+1.
     */
    @Modifying
    @Query("UPDATE AssistantMemory m SET m.lastAccessedAt = :now WHERE m.id IN :ids")
    int touchLastAccessed(@Param("ids") List<Long> ids, @Param("now") LocalDateTime now);

    /**
     * Suppression des entrees inactives : non lues depuis {@code threshold} OU
     * arrivees a echeance (expires_at depasse). Retourne le nombre d'entrees
     * supprimees. Appelee par {@code AssistantMemoryCleanupScheduler}.
     */
    @Modifying
    @Query("DELETE FROM AssistantMemory m WHERE "
            + "m.lastAccessedAt < :staleBefore "
            + "OR (m.expiresAt IS NOT NULL AND m.expiresAt < :now)")
    int deleteStaleAndExpired(@Param("staleBefore") LocalDateTime staleBefore,
                                @Param("now") LocalDateTime now);
}
