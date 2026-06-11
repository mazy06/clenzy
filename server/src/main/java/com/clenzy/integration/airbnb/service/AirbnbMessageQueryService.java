package com.clenzy.integration.airbnb.service;

import com.clenzy.model.ConversationChannel;
import com.clenzy.model.ConversationMessage;
import com.clenzy.repository.ConversationMessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Lectures des messages Airbnb (inbox unifie) pour la couche presentation
 * — refactor T-ARCH-01 : plus aucun repository dans les controllers.
 *
 * <p>Le scope organisation est garanti par le parametre {@code orgId}, resolu
 * du {@link com.clenzy.tenant.TenantContext} par le controller : la query
 * repository filtre explicitement sur l'organisation.</p>
 */
@Service
public class AirbnbMessageQueryService {

    private final ConversationMessageRepository messageRepository;

    public AirbnbMessageQueryService(ConversationMessageRepository messageRepository) {
        this.messageRepository = messageRepository;
    }

    /** Messages du channel AIRBNB de l'organisation (conversation pre-chargee). */
    @Transactional(readOnly = true)
    public List<ConversationMessage> findOrgAirbnbMessages(Long orgId) {
        return messageRepository.findByOrgAndChannelWithConversation(orgId, ConversationChannel.AIRBNB);
    }
}
