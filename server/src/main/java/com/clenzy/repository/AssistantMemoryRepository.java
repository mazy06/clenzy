package com.clenzy.repository;

import com.clenzy.model.AssistantMemory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
}
