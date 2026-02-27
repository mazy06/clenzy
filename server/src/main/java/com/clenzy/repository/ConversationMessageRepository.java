package com.clenzy.repository;

import com.clenzy.model.ConversationMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, Long> {

    Page<ConversationMessage> findByConversationIdAndOrganizationIdOrderBySentAtAsc(
        Long conversationId, Long organizationId, Pageable pageable);
}
