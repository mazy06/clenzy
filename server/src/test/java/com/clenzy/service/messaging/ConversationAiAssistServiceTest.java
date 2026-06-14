package com.clenzy.service.messaging;

import com.clenzy.dto.AiSuggestedResponseDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationMessage;
import com.clenzy.model.MessageDirection;
import com.clenzy.service.AiMessagingService;
import com.clenzy.service.agent.kb.KbSearchService;
import com.clenzy.service.agent.kb.KbSearchService.KbSearchHit;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Copilote de réponse messagerie (CLZ Domaine 6) : draft ancré sur le dernier message guest + RAG.
 */
class ConversationAiAssistServiceTest {

    private final ConversationService conversationService = mock(ConversationService.class);
    private final AiMessagingService aiMessagingService = mock(AiMessagingService.class);
    private final KbSearchService kbSearchService = mock(KbSearchService.class);
    private final com.clenzy.service.SentimentAnalysisService sentimentAnalysisService =
        mock(com.clenzy.service.SentimentAnalysisService.class);
    private final TranslationService translationService = mock(TranslationService.class);
    private final ConversationAiAssistService service = new ConversationAiAssistService(
        conversationService, aiMessagingService, kbSearchService, sentimentAnalysisService, translationService);

    private ConversationMessage inbound(String content) {
        ConversationMessage m = new ConversationMessage();
        m.setDirection(MessageDirection.INBOUND);
        m.setContent(content);
        return m;
    }

    @Test
    void buildsDraftFromLastGuestMessageAndKb() {
        Conversation conv = new Conversation();
        when(conversationService.getById(5L, 42L)).thenReturn(Optional.of(conv));
        when(conversationService.getMessages(eq(5L), eq(42L), any()))
            .thenReturn(new PageImpl<>(List.of(inbound("Quel est le code wifi ?"))));
        when(kbSearchService.search(eq("Quel est le code wifi ?"), eq(42L), eq(3)))
            .thenReturn(List.of(new KbSearchHit(1L, 1L, "WiFi", "guide.md", "Le code wifi est CLENZY2026", 0.9)));
        AiSuggestedResponseDto dto = new AiSuggestedResponseDto("Le code wifi est CLENZY2026", "friendly", "fr", List.of());
        when(aiMessagingService.generateSuggestedResponseAi(eq("Quel est le code wifi ?"), contains("WiFi"), isNull(), eq(42L)))
            .thenReturn(dto);

        AiSuggestedResponseDto result = service.suggestReply(42L, 5L);

        assertThat(result).isSameAs(dto);
        verify(kbSearchService).search(eq("Quel est le code wifi ?"), eq(42L), eq(3));
        verify(aiMessagingService).generateSuggestedResponseAi(eq("Quel est le code wifi ?"), contains("Base de connaissances"), isNull(), eq(42L));
    }

    @Test
    void throwsNotFoundForUnknownConversation() {
        when(conversationService.getById(404L, 42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.suggestReply(42L, 404L))
            .isInstanceOf(NotFoundException.class);
    }

    @Test
    void analyzeLastInbound_returnsSentimentAndUrgency() {
        Conversation conv = new Conversation();
        when(conversationService.getById(5L, 42L)).thenReturn(Optional.of(conv));
        when(conversationService.getMessages(eq(5L), eq(42L), any()))
            .thenReturn(new PageImpl<>(List.of(inbound("C'est inadmissible, je veux un remboursement !"))));
        when(sentimentAnalysisService.analyze(any(), isNull())).thenReturn(
            new com.clenzy.service.SentimentAnalysisService.SentimentResult(
                -0.8, com.clenzy.model.SentimentLabel.NEGATIVE, List.of()));
        when(aiMessagingService.isUrgent(any())).thenReturn(true);

        var dto = service.analyzeLastInbound(42L, 5L);

        assertThat(dto.sentiment()).isEqualTo("NEGATIVE");
        assertThat(dto.urgent()).isTrue();
        assertThat(dto.score()).isEqualTo(-0.8);
    }

    @Test
    void translateLastInbound_translatesViaTranslationService() {
        Conversation conv = new Conversation();
        when(conversationService.getById(5L, 42L)).thenReturn(Optional.of(conv));
        when(conversationService.getMessages(eq(5L), eq(42L), any()))
            .thenReturn(new PageImpl<>(List.of(inbound("What is the wifi code?"))));
        when(translationService.translate("What is the wifi code?", "fr"))
            .thenReturn("Quel est le code wifi ?");

        var dto = service.translateLastInbound(42L, 5L, "fr");

        assertThat(dto.targetLanguage()).isEqualTo("fr");
        assertThat(dto.translatedText()).isEqualTo("Quel est le code wifi ?");
    }
}
