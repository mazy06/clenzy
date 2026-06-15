package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationChannel;
import com.clenzy.model.ConversationMessage;
import com.clenzy.repository.ConversationMessageRepository;
import com.clenzy.repository.ConversationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Ingestion des messages OTA via Channex dans l'inbox unifiée (CLZ Domaine 1) — idempotence.
 */
class ChannexMessagingServiceTest {

    private final ChannexClient channexClient = mock(ChannexClient.class);
    private final ChannexPropertyMappingRepository mappingRepository = mock(ChannexPropertyMappingRepository.class);
    private final ConversationRepository conversationRepository = mock(ConversationRepository.class);
    private final ConversationMessageRepository messageRepository = mock(ConversationMessageRepository.class);
    private final ChannexMessagingService service = new ChannexMessagingService(
        channexClient, mappingRepository, conversationRepository, messageRepository);
    private final ObjectMapper mapper = new ObjectMapper();

    private JsonNode payload(String messageId) throws Exception {
        return mapper.readTree("{"
            + "\"thread_id\":\"th-1\",\"property_id\":\"chx-1\",\"channel\":\"AIRBNB\","
            + "\"message\":\"Bonjour\",\"author_type\":\"guest\",\"author_name\":\"Alice\","
            + "\"id\":\"" + messageId + "\"}");
    }

    private void mappingExists() {
        ChannexPropertyMapping m = new ChannexPropertyMapping();
        m.setOrganizationId(42L);
        m.setClenzyPropertyId(100L);
        when(mappingRepository.findByChannexPropertyIdAnyOrg(eq("chx-1"))).thenReturn(Optional.of(m));
    }

    @Test
    void newMessageIsPersisted() throws Exception {
        mappingExists();
        when(messageRepository.findByOrganizationIdAndChannelSourceAndExternalMessageId(
            eq(42L), eq(ConversationChannel.AIRBNB), eq("msg-1"))).thenReturn(Optional.empty());
        when(conversationRepository.findByOrganizationIdAndChannelAndExternalConversationId(any(), any(), any()))
            .thenReturn(Optional.empty());
        when(conversationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(messageRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        assertThat(service.onChannexMessage(payload("msg-1"))).isPresent();
        verify(messageRepository).save(any(ConversationMessage.class));
    }

    @Test
    void duplicateMessageIsSkipped() throws Exception {
        mappingExists();
        ConversationMessage existing = new ConversationMessage();
        when(messageRepository.findByOrganizationIdAndChannelSourceAndExternalMessageId(
            eq(42L), eq(ConversationChannel.AIRBNB), eq("msg-1"))).thenReturn(Optional.of(existing));

        Optional<ConversationMessage> result = service.onChannexMessage(payload("msg-1"));

        assertThat(result).containsSame(existing);
        verify(messageRepository, never()).save(any());
        verify(conversationRepository, never()).save(any()); // pas de re-upsert non plus
    }
}
