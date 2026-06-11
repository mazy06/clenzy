package com.clenzy.service.assistant;

import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests pour {@link AssistantConversationService} — controles d'ownership
 * extraits de {@code AssistantController} (T-ARCH-01).
 *
 * <p>Garantie centrale : un user ne lit/archive JAMAIS la conversation d'un
 * autre user — equivalent cross-user du test 403 cross-org (ici materialise
 * par une {@code IllegalArgumentException} / un {@code Optional.empty()},
 * traduits en 4xx par la couche web).</p>
 */
@ExtendWith(MockitoExtension.class)
class AssistantConversationServiceTest {

    private static final String OWNER = "user-123";
    private static final String STRANGER = "user-456";

    @Mock private AssistantConversationRepository conversationRepository;
    @Mock private AssistantMessageRepository messageRepository;

    private AssistantConversationService service;

    @BeforeEach
    void setUp() {
        service = new AssistantConversationService(conversationRepository, messageRepository);
    }

    private AssistantConversation conversation(Long id, String keycloakId) {
        AssistantConversation c = new AssistantConversation(1L, keycloakId);
        c.setId(id);
        return c;
    }

    @Test
    void listActiveConversations_delegatesToUserScopedQuery() {
        Page<AssistantConversation> page = new PageImpl<>(
                List.of(conversation(1L, OWNER)), Pageable.ofSize(20), 1);
        when(conversationRepository.findActiveByUser(OWNER, PageRequest.of(0, 20)))
                .thenReturn(page);

        Page<AssistantConversation> result =
                service.listActiveConversations(OWNER, PageRequest.of(0, 20));

        assertEquals(1, result.getContent().size());
    }

    @Test
    void findOwnedConversation_otherOwner_returnsEmpty() {
        when(conversationRepository.findByIdAndUser(42L, STRANGER)).thenReturn(Optional.empty());

        assertTrue(service.findOwnedConversation(42L, STRANGER).isEmpty());
    }

    @Test
    void getMessagesForOwner_ownerMatch_returnsMessages() {
        AssistantConversation c = conversation(42L, OWNER);
        when(conversationRepository.findByIdAndUser(42L, OWNER)).thenReturn(Optional.of(c));
        AssistantMessage m1 = AssistantMessage.user(42L, 1L, "hi");
        when(messageRepository.findByConversation(42L)).thenReturn(List.of(m1));

        List<AssistantMessage> messages = service.getMessagesForOwner(42L, OWNER);

        assertEquals(1, messages.size());
    }

    @Test
    void getMessagesForOwner_otherOwnersConversation_throwsAndNeverReadsMessages() {
        when(conversationRepository.findByIdAndUser(99L, STRANGER)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.getMessagesForOwner(99L, STRANGER));

        assertTrue(ex.getMessage().contains("99"));
        verify(messageRepository, never()).findByConversation(anyLong());
    }

    @Test
    void archiveConversation_ownerMatch_setsArchivedAtAndSaves() {
        AssistantConversation c = conversation(42L, OWNER);
        when(conversationRepository.findByIdAndUser(42L, OWNER)).thenReturn(Optional.of(c));

        service.archiveConversation(42L, OWNER);

        assertNotNull(c.getArchivedAt());
        verify(conversationRepository).save(c);
    }

    @Test
    void archiveConversation_otherOwnersConversation_throwsAndNeverSaves() {
        when(conversationRepository.findByIdAndUser(99L, STRANGER)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> service.archiveConversation(99L, STRANGER));
        verify(conversationRepository, never()).save(any());
    }

    @Test
    void findAttachmentsJsonForUser_delegatesUserScopedLookup() {
        when(messageRepository.findAttachmentsJsonByStorageKeyForUser("key-1", OWNER))
                .thenReturn("[{\"storageKey\":\"key-1\"}]");

        assertEquals("[{\"storageKey\":\"key-1\"}]",
                service.findAttachmentsJsonForUser("key-1", OWNER));
    }

    @Test
    void findAttachmentsJsonForUser_strangerKey_returnsNull() {
        when(messageRepository.findAttachmentsJsonByStorageKeyForUser("key-1", STRANGER))
                .thenReturn(null);

        assertNull(service.findAttachmentsJsonForUser("key-1", STRANGER));
    }
}
