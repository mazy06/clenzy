package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.service.AiTargetResolver;
import com.clenzy.service.ResolvedTarget;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Rolling summary (X6) : régénération PARESSEUSE (seuil de messages hors-fenêtre
 * depuis le dernier résumé), no-op si feature off / historique court, et
 * persistance du résumé + du curseur de couverture.
 */
@ExtendWith(MockitoExtension.class)
class ConversationSummaryServiceTest {

    @Mock private ChatLLMProvider chatProvider;
    @Mock private AiTargetResolver targetResolver;
    @Mock private AssistantConversationRepository conversationRepository;
    @Mock private AssistantMessageRepository messageRepository;

    private final AgentContext ctx = AgentContext.minimal(42L, "kc-1");

    private ConversationSummaryService service(boolean enabled, int threshold) {
        return new ConversationSummaryService(chatProvider, targetResolver, conversationRepository,
                messageRepository, null, enabled, threshold);
    }

    private static AssistantConversation conv() {
        AssistantConversation c = new AssistantConversation(42L, "kc-1");
        c.setId(9L);
        return c;
    }

    private static List<AssistantMessage> messages(int n) {
        List<AssistantMessage> list = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            list.add(AssistantMessage.user(9L, 42L, "msg-" + i));
        }
        return list;
    }

    private void stubProviderAnswering(String summary) {
        when(targetResolver.resolvePrimary(any(), any(), any()))
                .thenReturn(new ResolvedTarget("anthropic", "claude-sonnet-4", "sk", null, null));
        lenient().doAnswer(inv -> {
            Consumer<ChatEvent> h = inv.getArgument(1);
            h.accept(new ChatEvent.Done(50, 20, "claude-sonnet-4", "end_turn", summary));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any(), any());
        lenient().doAnswer(inv -> {
            Consumer<ChatEvent> h = inv.getArgument(1);
            h.accept(new ChatEvent.Done(50, 20, "claude-sonnet-4", "end_turn", summary));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());
    }

    @Test
    void disabled_isNoOp() {
        service(false, 10).refreshIfNeeded(conv(), ctx, null);

        verify(messageRepository, never()).findByConversation(any());
        verify(conversationRepository, never()).save(any());
    }

    @Test
    void withinWindow_noSummary() {
        when(messageRepository.findByConversation(9L))
                .thenReturn(messages(ContextBudget.MAX_HISTORY_MESSAGES)); // rien hors fenêtre

        service(true, 10).refreshIfNeeded(conv(), ctx, null);

        verify(conversationRepository, never()).save(any());
    }

    @Test
    void notEnoughNewOutOfWindow_skipsRefresh() {
        // 5 messages hors fenêtre, seuil 10 → pas encore.
        when(messageRepository.findByConversation(9L))
                .thenReturn(messages(ContextBudget.MAX_HISTORY_MESSAGES + 5));

        service(true, 10).refreshIfNeeded(conv(), ctx, null);

        verify(conversationRepository, never()).save(any());
    }

    @Test
    void enoughOutOfWindow_generatesAndPersistsSummary() {
        int outOfWindow = 12;
        when(messageRepository.findByConversation(9L))
                .thenReturn(messages(ContextBudget.MAX_HISTORY_MESSAGES + outOfWindow));
        stubProviderAnswering("Résumé : gère 3 logements, préfère le ton formel.");
        AssistantConversation conversation = conv();

        service(true, 10).refreshIfNeeded(conversation, ctx, null);

        assertThat(conversation.getRollingSummary()).contains("3 logements");
        assertThat(conversation.getSummaryCoversCount()).isEqualTo(outOfWindow);
        verify(conversationRepository).save(conversation);
    }
}
