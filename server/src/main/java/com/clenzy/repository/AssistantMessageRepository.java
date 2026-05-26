package com.clenzy.repository;

import com.clenzy.model.AssistantMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AssistantMessageRepository extends JpaRepository<AssistantMessage, Long> {

    /**
     * Tous les messages d'une conversation, ordonnes chronologiquement.
     * Le filtre Hibernate filtre par organization_id en plus du conversation_id.
     */
    @Query("SELECT m FROM AssistantMessage m WHERE m.conversationId = :conversationId "
            + "ORDER BY m.createdAt ASC, m.id ASC")
    List<AssistantMessage> findByConversation(@Param("conversationId") Long conversationId);

    /**
     * Somme des prompt_tokens des messages user avec attachments (= vision tokens)
     * pour une org, depuis {@code since}. Utilisee par {@code VisionTokenUsageService}
     * pour mesurer la consommation 30j glissants.
     *
     * <p>Native query : on contourne le filtre Hibernate (job systeme cross-tenant
     * dans le scheduler hebdo).</p>
     */
    @Query(value = "SELECT COALESCE(SUM(prompt_tokens), 0) FROM assistant_message "
            + "WHERE organization_id = :orgId "
            + "AND attachments IS NOT NULL "
            + "AND created_at >= :since "
            + "AND prompt_tokens IS NOT NULL",
            nativeQuery = true)
    Long sumVisionPromptTokensSince(@Param("orgId") Long orgId,
                                      @Param("since") LocalDateTime since);
}
