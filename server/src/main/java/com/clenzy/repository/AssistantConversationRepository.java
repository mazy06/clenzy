package com.clenzy.repository;

import com.clenzy.model.AssistantConversation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface AssistantConversationRepository extends JpaRepository<AssistantConversation, Long> {

    /**
     * Liste paginee des conversations actives (non archivees) d'un user, triees par updatedAt DESC.
     * Le filtre Hibernate organizationFilter garantit qu'on ne lit que les conv du tenant courant.
     */
    @Query("SELECT c FROM AssistantConversation c WHERE c.keycloakId = :keycloakId "
            + "AND c.archivedAt IS NULL ORDER BY c.updatedAt DESC")
    Page<AssistantConversation> findActiveByUser(@Param("keycloakId") String keycloakId, Pageable pageable);

    /**
     * Recherche d'une conversation par id avec validation d'ownership user.
     * Retourne empty si l'id n'existe pas OU appartient a un autre user.
     */
    @Query("SELECT c FROM AssistantConversation c WHERE c.id = :id AND c.keycloakId = :keycloakId")
    Optional<AssistantConversation> findByIdAndUser(@Param("id") Long id,
                                                    @Param("keycloakId") String keycloakId);
}
