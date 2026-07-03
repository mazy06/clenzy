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

import java.util.ArrayList;
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

    // ─── Fenêtrage d'historique (lever #2 / correctif M4) ──────────────────

    @Test
    @DisplayName("historique > MAX_HISTORY_MESSAGES → fenêtre glissante des N derniers")
    void longHistory_isWindowedToLastN() {
        List<AssistantMessage> history = new ArrayList<>();
        for (int i = 0; i < ContextBudget.MAX_HISTORY_MESSAGES + 6; i++) {
            history.add(AssistantMessage.user(1L, 7L, "msg-" + i));
        }

        List<ChatMessage> messages = mapper.toChatMessages(history);

        assertThat(messages).hasSize(ContextBudget.MAX_HISTORY_MESSAGES);
        // Le tour le plus récent (queue) est conservé.
        assertThat(messages.get(messages.size() - 1).content())
                .isEqualTo("msg-" + (ContextBudget.MAX_HISTORY_MESSAGES + 5));
    }

    @Test
    @DisplayName("fenêtre commençant sur des ROLE_TOOL orphelins → tête élaguée (pas de tool_result orphelin)")
    void windowStartingOnOrphanToolResults_elidesThem() {
        int max = ContextBudget.MAX_HISTORY_MESSAGES;
        List<AssistantMessage> history = new ArrayList<>();
        for (int i = 0; i < 4; i++) history.add(AssistantMessage.user(1L, 7L, "u" + i));
        // Indices 4 et 5 = début de fenêtre (taille max+4) → ROLE_TOOL orphelins.
        history.add(AssistantMessage.tool(1L, 7L, "tc-a", "{}"));
        history.add(AssistantMessage.tool(1L, 7L, "tc-b", "{}"));
        while (history.size() < max + 4) history.add(AssistantMessage.user(1L, 7L, "u" + history.size()));

        List<ChatMessage> messages = mapper.toChatMessages(history);

        assertThat(messages).isNotEmpty();
        // Aucun tool_result en tête (son tool_call serait hors fenêtre → requête invalide).
        assertThat(messages.get(0).role()).isNotEqualTo(ChatMessage.ROLE_TOOL);
    }

    @Test
    @DisplayName("fenêtre 100% ROLE_TOOL → garde-fou : liste NON vide (pas de 400)")
    void windowAllToolResults_guardReturnsNonEmpty() {
        List<AssistantMessage> history = new ArrayList<>();
        for (int i = 0; i < ContextBudget.MAX_HISTORY_MESSAGES + 1; i++) {
            history.add(AssistantMessage.tool(1L, 7L, "tc-" + i, "{}"));
        }

        List<ChatMessage> messages = mapper.toChatMessages(history);

        assertThat(messages).isNotEmpty();
        assertThat(messages).hasSize(ContextBudget.MAX_HISTORY_MESSAGES);
    }

    // ─── Vision : image resolue UNIQUEMENT pour le dernier message user (T-04) ──

    @Test
    @DisplayName("image d'un ANCIEN message user → placeholder, pas de resolution storage")
    void pastUserImage_replacedByPlaceholder_notResolved() {
        String json = "[{\"storageKey\":\"42\",\"mediaType\":\"image/jpeg\"}]";
        List<AssistantMessage> history = List.of(
                AssistantMessage.user(1L, 7L, "voici le frigo", json),
                AssistantMessage.assistant(1L, 7L, "Le joint est use, prevoyez un remplacement.", null),
                AssistantMessage.user(1L, 7L, "et combien ca couterait ?"));

        List<ChatMessage> messages = mapper.toChatMessages(history);

        assertThat(messages).hasSize(3);
        // L'ancien message garde son texte + placeholder, SANS bloc image.
        assertThat(messages.get(0).content())
                .startsWith("voici le frigo")
                .contains(ConversationHistoryMapper.PAST_IMAGE_PLACEHOLDER);
        assertThat(messages.get(0).attachments()).isNullOrEmpty();
        // Aucun fetch storage : ni garde ni retrieve.
        verify(photoStorageService, never()).assertReadableInCurrentOrg(org.mockito.ArgumentMatchers.anyString());
        verify(photoStorageService, never()).retrieve(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    @DisplayName("image du DERNIER message user → toujours resolue (tour courant)")
    void lastUserImage_stillResolved() {
        doNothing().when(photoStorageService).assertReadableInCurrentOrg("42");
        when(photoStorageService.retrieve("42")).thenReturn(new byte[]{1, 2, 3});
        String json = "[{\"storageKey\":\"42\",\"mediaType\":\"image/jpeg\"}]";
        List<AssistantMessage> history = List.of(
                AssistantMessage.user(1L, 7L, "bonjour"),
                AssistantMessage.assistant(1L, 7L, "Bonjour !", null),
                AssistantMessage.user(1L, 7L, "voici le frigo", json));

        List<ChatMessage> messages = mapper.toChatMessages(history);

        assertThat(messages.get(2).attachments()).hasSize(1);
        verify(photoStorageService).retrieve("42");
    }

    // ─── Rolling summary (X6) ────────────────────────────────────────────────

    @Test
    @DisplayName("historique fenêtré + résumé → résumé injecté en tête (message user)")
    void windowedHistory_withSummary_prependsSummary() {
        List<AssistantMessage> history = new ArrayList<>();
        for (int i = 0; i < ContextBudget.MAX_HISTORY_MESSAGES + 6; i++) {
            history.add(AssistantMessage.user(1L, 7L, "msg-" + i));
        }

        List<ChatMessage> messages = mapper.toChatMessages(history, "Résumé : l'utilisateur gère 3 logements.");

        // 1 message de résumé + la fenêtre.
        assertThat(messages).hasSize(ContextBudget.MAX_HISTORY_MESSAGES + 1);
        assertThat(messages.get(0).role()).isEqualTo(ChatMessage.ROLE_USER);
        assertThat(messages.get(0).content()).contains("Résumé du début de la conversation");
        assertThat(messages.get(0).content()).contains("3 logements");
    }

    @Test
    @DisplayName("historique NON fenêtré → résumé ignoré (rien à résumer)")
    void shortHistory_summaryIgnored() {
        List<AssistantMessage> history = List.of(
                AssistantMessage.user(1L, 7L, "bonjour"),
                AssistantMessage.assistant(1L, 7L, "Bonjour !", null));

        List<ChatMessage> messages = mapper.toChatMessages(history, "un résumé quelconque");

        assertThat(messages).hasSize(2);
        assertThat(messages.get(0).content()).isEqualTo("bonjour");
    }

    @Test
    @DisplayName("résultat d'outil volumineux → tronqué via le mapper (copie LLM)")
    void oversizedToolResult_isCappedByMapper() {
        String big = "y".repeat(ContextBudget.MAX_TOOL_RESULT_CHARS + 4000);
        List<AssistantMessage> history = List.of(
                AssistantMessage.user(1L, 7L, "liste tout"),
                AssistantMessage.tool(1L, 7L, "tc-1", big));

        List<ChatMessage> messages = mapper.toChatMessages(history);

        ChatMessage toolMsg = messages.get(messages.size() - 1);
        assertThat(toolMsg.role()).isEqualTo(ChatMessage.ROLE_TOOL);
        assertThat(toolMsg.content().length()).isLessThan(big.length());
        assertThat(toolMsg.content()).contains("tronqué");
    }
}
