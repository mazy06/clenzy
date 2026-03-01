package com.clenzy.repository;

import com.clenzy.model.ConversationChannel;
import com.clenzy.model.ConversationMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, Long> {

    Page<ConversationMessage> findByConversationIdAndOrganizationIdOrderBySentAtAsc(
        Long conversationId, Long organizationId, Pageable pageable);

    @Query("SELECT m FROM ConversationMessage m JOIN FETCH m.conversation " +
           "WHERE m.organizationId = :orgId AND m.channelSource = :channel " +
           "ORDER BY m.sentAt DESC")
    List<ConversationMessage> findByOrgAndChannelWithConversation(
        @Param("orgId") Long organizationId,
        @Param("channel") ConversationChannel channelSource);
}
