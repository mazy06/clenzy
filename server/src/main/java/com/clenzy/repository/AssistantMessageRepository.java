package com.clenzy.repository;

import com.clenzy.model.AssistantMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AssistantMessageRepository extends JpaRepository<AssistantMessage, Long> {

    /**
     * Tous les messages d'une conversation, ordonnes chronologiquement.
     * Le filtre Hibernate filtre par organization_id en plus du conversation_id.
     */
    @Query("SELECT m FROM AssistantMessage m WHERE m.conversationId = :conversationId "
            + "ORDER BY m.createdAt ASC, m.id ASC")
    List<AssistantMessage> findByConversation(@Param("conversationId") Long conversationId);
}
