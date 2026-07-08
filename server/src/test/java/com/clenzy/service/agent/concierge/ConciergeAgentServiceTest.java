package com.clenzy.service.agent.concierge;

import com.clenzy.dto.AiSuggestedResponseDto;
import com.clenzy.dto.ConversationAnalysisDto;
import com.clenzy.model.Conversation;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.ai.RunCreditGuard;
import com.clenzy.service.messaging.ConversationAiAssistService;
import com.clenzy.tenant.TenantScopedExecutor;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Concierge C1 (SUGGEST) : génération du brouillon sur message entrant.
 * Zéro envoi ; escalade sur sentiment négatif ; métrage crédits (pré-vol).
 */
@ExtendWith(MockitoExtension.class)
class ConciergeAgentServiceTest {

    private static final Long ORG = 1L;
    private static final Long CONV = 55L;
    private static final Long PROP = 7L;

    @Mock private ConversationAiAssistService aiAssist;
    @Mock private ConversationRepository conversationRepository;
    @Mock private SupervisionActivityService activityService;
    @Mock private NotificationService notificationService;
    @Mock private RunCreditGuard runCreditGuard;
    @Mock private TenantScopedExecutor tenantScopedExecutor;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private ConciergeAgentService service;
    private Conversation conversation;

    @BeforeEach
    void setUp() {
        service = new ConciergeAgentService(aiAssist, conversationRepository, activityService,
                notificationService, runCreditGuard, tenantScopedExecutor, objectMapper, true);
        Property property = new Property();
        property.setId(PROP);
        conversation = new Conversation();
        conversation.setId(CONV);
        conversation.setOrganizationId(ORG);
        conversation.setProperty(property);
    }

    @Test
    void generateDraft_persistsDraftAndFeeds_noEscalationWhenPositive() {
        when(conversationRepository.findByIdAndOrganizationId(CONV, ORG))
                .thenReturn(Optional.of(conversation));
        when(runCreditGuard.beginRun(ORG)).thenReturn(true);
        when(aiAssist.analyzeLastInbound(ORG, CONV))
                .thenReturn(new ConversationAnalysisDto("POSITIVE", 0.82, false));
        when(aiAssist.suggestReply(ORG, CONV))
                .thenReturn(new AiSuggestedResponseDto("Bonjour, voici la réponse.", "friendly", "fr", List.of()));

        service.generateDraft(ORG, CONV);

        ArgumentCaptor<Conversation> captor = ArgumentCaptor.forClass(Conversation.class);
        verify(conversationRepository).save(captor.capture());
        assertThat(captor.getValue().getAiDraftReply()).isEqualTo("Bonjour, voici la réponse.");
        assertThat(captor.getValue().getAiDraftMeta()).contains("POSITIVE").contains("friendly");
        verify(activityService).recordModuleAct(eq(ORG), eq(PROP), eq("com"),
                eq("concierge_drafted"), anyString());
        verify(runCreditGuard).endRun();
        verifyNoInteractions(notificationService); // positif, non urgent → pas d'escalade
    }

    @Test
    void generateDraft_negativeSentiment_escalatesToAssignedHost() {
        conversation.setAssignedToKeycloakId("host-kc");
        when(conversationRepository.findByIdAndOrganizationId(CONV, ORG))
                .thenReturn(Optional.of(conversation));
        when(runCreditGuard.beginRun(ORG)).thenReturn(true);
        when(aiAssist.analyzeLastInbound(ORG, CONV))
                .thenReturn(new ConversationAnalysisDto("NEGATIVE", 0.15, false));
        when(aiAssist.suggestReply(ORG, CONV))
                .thenReturn(new AiSuggestedResponseDto("Je suis désolé…", "empathetic", "fr", List.of()));

        service.generateDraft(ORG, CONV);

        verify(notificationService).notify(eq("host-kc"), eq(NotificationKey.CONCIERGE_ESCALATION),
                anyString(), anyString(), anyString());
    }

    @Test
    void generateDraft_creditsExhausted_skipsLlmAndNoReservation() {
        when(conversationRepository.findByIdAndOrganizationId(CONV, ORG))
                .thenReturn(Optional.of(conversation));
        when(runCreditGuard.beginRun(ORG)).thenReturn(false);

        service.generateDraft(ORG, CONV);

        verify(aiAssist, never()).suggestReply(anyLong(), anyLong());
        verify(conversationRepository, never()).save(any());
        verify(runCreditGuard, never()).endRun();
    }

    @Test
    void onInboundMessage_whenDisabled_doesNothing() {
        ConciergeAgentService disabled = new ConciergeAgentService(aiAssist, conversationRepository,
                activityService, notificationService, runCreditGuard, tenantScopedExecutor, objectMapper, false);

        disabled.onInboundMessage(new InboundGuestMessageEvent(ORG, CONV));

        verifyNoInteractions(tenantScopedExecutor, runCreditGuard, aiAssist);
    }
}
