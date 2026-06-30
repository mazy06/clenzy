package com.clenzy.service;

import com.clenzy.config.ai.AiModelDeprecatedEvent;
import com.clenzy.model.NotificationKey;
import com.clenzy.repository.PlatformAiModelRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

@ExtendWith(MockitoExtension.class)
@DisplayName("AiModelDeprecationListener — notification SUPER_ADMIN + dedup en memoire")
class AiModelDeprecationListenerTest {

    @Mock private NotificationService notificationService;
    @Mock private PlatformAiModelRepository modelRepository;
    private AiModelDeprecationListener listener;

    @BeforeEach
    void setUp() {
        // fresh listener per test (le Set dedup repart vide). Suggester réel sur
        // un repo vide → suggestion vide (le contenu testé reste inchangé).
        listener = new AiModelDeprecationListener(
                notificationService, new AiModelReplacementSuggester(modelRepository));
    }

    @Test
    @DisplayName("Premier event -> notifyAllPlatformStaff appele avec cle AI_MODEL_EOL")
    void firstEvent_triggersNotification() {
        listener.onAiModelDeprecated(new AiModelDeprecatedEvent(
                "nvidia", "qwen/qwen2.5-coder-32b-instruct", "{\"status\":410}"));

        ArgumentCaptor<String> title = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> actionUrl = ArgumentCaptor.forClass(String.class);
        verify(notificationService).notifyAllPlatformStaff(
                eq(NotificationKey.AI_MODEL_EOL), title.capture(), message.capture(), actionUrl.capture());

        assertThat(title.getValue()).contains("qwen/qwen2.5-coder-32b-instruct");
        assertThat(message.getValue()).contains("nvidia")
                .contains("Parametres > IA");
        assertThat(actionUrl.getValue()).isEqualTo("/settings?tab=ai");
    }

    @Test
    @DisplayName("Meme event re-emis -> notification dedup (un seul appel)")
    void duplicateEvent_skipped() {
        AiModelDeprecatedEvent event = new AiModelDeprecatedEvent(
                "nvidia", "qwen/qwen2.5-coder-32b-instruct", "{}");

        listener.onAiModelDeprecated(event);
        listener.onAiModelDeprecated(event);
        listener.onAiModelDeprecated(event);

        verify(notificationService, times(1))
                .notifyAllPlatformStaff(eq(NotificationKey.AI_MODEL_EOL), any(), any(), any());
        verifyNoMoreInteractions(notificationService);
    }

    @Test
    @DisplayName("Deux modeles distincts -> deux notifications (dedup par modele)")
    void differentModels_bothNotified() {
        listener.onAiModelDeprecated(new AiModelDeprecatedEvent(
                "nvidia", "qwen/qwen2.5-coder-32b-instruct", "{}"));
        listener.onAiModelDeprecated(new AiModelDeprecatedEvent(
                "nvidia", "meta/llama-3.1-70b-instruct", "{}"));

        verify(notificationService, times(2))
                .notifyAllPlatformStaff(eq(NotificationKey.AI_MODEL_EOL), any(), any(), any());
    }

    @Test
    @DisplayName("Meme modele chez deux providers distincts -> deux notifs (cle = provider|model)")
    void sameModelDifferentProviders_bothNotified() {
        listener.onAiModelDeprecated(new AiModelDeprecatedEvent(
                "nvidia", "qwen/qwen2.5-coder-32b-instruct", "{}"));
        listener.onAiModelDeprecated(new AiModelDeprecatedEvent(
                "bedrock", "qwen/qwen2.5-coder-32b-instruct", "{}"));

        verify(notificationService, times(2))
                .notifyAllPlatformStaff(eq(NotificationKey.AI_MODEL_EOL), any(), any(), any());
    }
}
