package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatMessage;
import com.clenzy.model.AssistantMessage;
import com.clenzy.service.PhotoStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Resolution des attachments du chat assistant : la garde fail-closed
 * {@code assertReadableInCurrentOrg} est appelee AVANT {@code retrieve}
 * (audit 2026-06, A1-AGENT-IA-01).
 */
@ExtendWith(MockitoExtension.class)
class ConversationHistoryMapperTest {

    @Mock private PhotoStorageService photoStorageService;

    private ConversationHistoryMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new ConversationHistoryMapper(new ObjectMapper(), photoStorageService);
    }

    private List<AssistantMessage> userWithAttachment(String storageKey) {
        String json = "[{\"storageKey\":\"" + storageKey + "\",\"mediaType\":\"image/jpeg\"}]";
        return List.of(AssistantMessage.user(1L, 7L, "voici le frigo", json));
    }

    @Test
    @DisplayName("storageKey refuse (cross-org) → AccessDenied propage, pas avale")
    void deniedStorageKey_propagatesAccessDenied() {
        doThrow(new AccessDeniedException("Attachment non autorise"))
                .when(photoStorageService).assertReadableInCurrentOrg("99");

        assertThatThrownBy(() -> mapper.toChatMessages(userWithAttachment("99")))
                .isInstanceOf(AccessDeniedException.class);

        // retrieve ne doit JAMAIS etre atteint si la garde refuse
        verify(photoStorageService, never()).retrieve("99");
    }

    @Test
    @DisplayName("storageKey autorise → resolu en attachment base64")
    void allowedStorageKey_resolvedToBase64() {
        doNothing().when(photoStorageService).assertReadableInCurrentOrg("42");
        when(photoStorageService.retrieve("42")).thenReturn(new byte[]{1, 2, 3});

        List<ChatMessage> messages = mapper.toChatMessages(userWithAttachment("42"));

        assertThat(messages).hasSize(1);
        assertThat(messages.get(0).attachments()).hasSize(1);
        verify(photoStorageService).assertReadableInCurrentOrg(eq("42"));
        verify(photoStorageService).retrieve("42");
    }

    @Test
    @DisplayName("message sans attachment → pas d'appel a la garde")
    void noAttachment_noGuardCall() {
        List<ChatMessage> messages = mapper.toChatMessages(
                List.of(AssistantMessage.user(1L, 7L, "bonjour")));

        assertThat(messages).hasSize(1);
        verify(photoStorageService, never()).assertReadableInCurrentOrg(org.mockito.ArgumentMatchers.anyString());
    }
}
