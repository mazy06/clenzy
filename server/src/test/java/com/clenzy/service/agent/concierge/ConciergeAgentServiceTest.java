package com.clenzy.service.agent.concierge;

import com.clenzy.dto.AiSuggestedResponseDto;
import com.clenzy.dto.ConversationAnalysisDto;
import com.clenzy.model.Conversation;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.model.SupervisionAutonomy;
import com.clenzy.model.SupervisionModuleSettings;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.repository.SupervisionModuleSettingsRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.PlatformSettingsService;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.ai.RunCreditGuard;
import com.clenzy.service.messaging.ConversationAiAssistService;
import com.clenzy.service.messaging.ConversationService;
import com.clenzy.tenant.TenantScopedExecutor;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Concierge C1 (brouillon) + C2 (auto-envoi gardé). Zéro envoi sauf whitelist FAQ
 * sûre avec double gate ; escalade sur sentiment négatif ; métrage crédits.
 */
@ExtendWith(MockitoExtension.class)
class ConciergeAgentServiceTest {

    private static final Long ORG = 1L;
    private static final Long CONV = 55L;
    private static final Long PROP = 7L;

    @Mock private ConversationAiAssistService aiAssist;
    @Mock private ConversationRepository conversationRepository;
    @Mock private ConversationService conversationService;
    @Mock private SupervisionModuleSettingsRepository moduleSettingsRepository;
    @Mock private ConciergeIntentClassifier classifier;
    @Mock private SupervisionActivityService activityService;
    @Mock private NotificationService notificationService;
    @Mock private RunCreditGuard runCreditGuard;
    @Mock private TenantScopedExecutor tenantScopedExecutor;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private com.clenzy.repository.UserRepository userRepository;
    @Mock private PlatformSettingsService platformSettings;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private ConciergeAgentService service;   // draft on, autosend OFF (C1)
    private Conversation conversation;

    @BeforeEach
    void setUp() {
        service = build(true, false);
        Property property = new Property();
        property.setId(PROP);
        conversation = new Conversation();
        conversation.setId(CONV);
        conversation.setOrganizationId(ORG);
        conversation.setProperty(property);
        conversation.setLastMessagePreview("Quel est le code wifi ?");
    }

    private ConciergeAgentService build(boolean draft, boolean autosend) {
        // Masters plateforme désormais lus en base (PlatformSettingsService) : lenient
        // car certains tests n'exercent pas l'auto-envoi ni le palier premium.
        lenient().when(platformSettings.isConciergeDraftEnabled()).thenReturn(draft);
        lenient().when(platformSettings.isConciergeAutosendEnabled()).thenReturn(autosend);
        lenient().when(platformSettings.getConciergeAutosendMinForfait()).thenReturn("premium");
        return new ConciergeAgentService(aiAssist, conversationRepository, conversationService,
                moduleSettingsRepository, classifier, activityService, notificationService,
                runCreditGuard, tenantScopedExecutor, redisTemplate, objectMapper, userRepository,
                platformSettings);
    }

    private void stubOrgForfait(String forfait) {
        com.clenzy.model.User payer = new com.clenzy.model.User();
        payer.setForfait(forfait);
        when(userRepository.findFirstByOrganizationIdAndStripeSubscriptionIdIsNotNull(ORG))
                .thenReturn(Optional.of(payer));
    }

    private void stubConvAndCredits() {
        when(conversationRepository.findByIdAndOrganizationId(CONV, ORG))
                .thenReturn(Optional.of(conversation));
        when(runCreditGuard.beginRun(ORG)).thenReturn(true);
    }

    // ── C1 : brouillon (autosend off) ───────────────────────────────────────

    @Test
    void processInbound_draftsAndFeeds_noEscalationWhenPositive() {
        stubConvAndCredits();
        when(aiAssist.analyzeLastInbound(ORG, CONV))
                .thenReturn(new ConversationAnalysisDto("POSITIVE", 0.82, false));
        when(aiAssist.suggestReply(ORG, CONV))
                .thenReturn(new AiSuggestedResponseDto("Bonjour, voici la réponse.", "friendly", "fr", List.of()));
        when(classifier.classify(anyString(), any())).thenReturn(new ConciergeDecision(false, "not_whitelisted"));

        service.processInbound(ORG, CONV);

        ArgumentCaptor<Conversation> captor = ArgumentCaptor.forClass(Conversation.class);
        verify(conversationRepository).save(captor.capture());
        assertThat(captor.getValue().getAiDraftReply()).isEqualTo("Bonjour, voici la réponse.");
        verify(activityService).recordModuleAct(eq(ORG), eq(PROP), eq("com"),
                eq("concierge_drafted"), anyString());
        verify(conversationService, never()).sendAutonomousMessage(any(), anyString());
        verify(runCreditGuard).endRun();
        verifyNoInteractions(notificationService);
    }

    @Test
    void processInbound_negativeSentiment_escalatesAndDrafts() {
        conversation.setAssignedToKeycloakId("host-kc");
        stubConvAndCredits();
        when(aiAssist.analyzeLastInbound(ORG, CONV))
                .thenReturn(new ConversationAnalysisDto("NEGATIVE", 0.15, false));
        when(aiAssist.suggestReply(ORG, CONV))
                .thenReturn(new AiSuggestedResponseDto("Je suis désolé…", "empathetic", "fr", List.of()));
        when(classifier.classify(anyString(), any())).thenReturn(new ConciergeDecision(false, "risk_or_negative"));

        service.processInbound(ORG, CONV);

        verify(notificationService).notify(eq("host-kc"), eq(NotificationKey.CONCIERGE_ESCALATION),
                anyString(), anyString(), anyString());
        verify(conversationService, never()).sendAutonomousMessage(any(), anyString());
    }

    @Test
    void processInbound_creditsExhausted_skipsLlm() {
        when(conversationRepository.findByIdAndOrganizationId(CONV, ORG))
                .thenReturn(Optional.of(conversation));
        when(runCreditGuard.beginRun(ORG)).thenReturn(false);

        service.processInbound(ORG, CONV);

        verify(aiAssist, never()).suggestReply(anyLong(), anyLong());
        verify(conversationRepository, never()).save(any());
        verify(runCreditGuard, never()).endRun();
    }

    @Test
    void onInboundMessage_whenDraftDisabled_doesNothing() {
        ConciergeAgentService disabled = build(false, false);

        disabled.onInboundMessage(new InboundGuestMessageEvent(ORG, CONV));

        verifyNoInteractions(tenantScopedExecutor, runCreditGuard, aiAssist);
    }

    // ── C2 : auto-envoi gardé ────────────────────────────────────────────────

    @Test
    void processInbound_autoSends_whenEnabledAutonomyAndSafe() {
        ConciergeAgentService auto = build(true, true);
        stubConvAndCredits();
        when(aiAssist.analyzeLastInbound(ORG, CONV))
                .thenReturn(new ConversationAnalysisDto("POSITIVE", 0.9, false));
        when(aiAssist.suggestReply(ORG, CONV))
                .thenReturn(new AiSuggestedResponseDto("Le code wifi est 1234.", "friendly", "fr", List.of()));
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, "com"))
                .thenReturn(Optional.of(new SupervisionModuleSettings(ORG, "com", true, SupervisionAutonomy.NOTIFY)));
        when(classifier.classify(anyString(), any())).thenReturn(new ConciergeDecision(true, "faq"));
        stubOrgForfait("premium"); // palier premium atteint → auto-envoi autorisé
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);

        auto.processInbound(ORG, CONV);

        verify(conversationService).sendAutonomousMessage(conversation, "Le code wifi est 1234.");
        verify(activityService).recordModuleAct(eq(ORG), eq(PROP), eq("com"),
                eq("concierge_replied"), anyString());
        verify(redisTemplate).delete(anyString());
        ArgumentCaptor<Conversation> captor = ArgumentCaptor.forClass(Conversation.class);
        verify(conversationRepository).save(captor.capture());
        assertThat(captor.getValue().getAiDraftReply()).isNull(); // brouillon consommé
    }

    @Test
    void processInbound_capsToDraft_whenForfaitBelowPremium() {
        // C4 : NOTIFY/FULL + intention sûre, mais forfait < premium → jamais d'auto-envoi.
        ConciergeAgentService auto = build(true, true);
        stubConvAndCredits();
        when(aiAssist.analyzeLastInbound(ORG, CONV))
                .thenReturn(new ConversationAnalysisDto("POSITIVE", 0.9, false));
        when(aiAssist.suggestReply(ORG, CONV))
                .thenReturn(new AiSuggestedResponseDto("Le code wifi est 1234.", "friendly", "fr", List.of()));
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, "com"))
                .thenReturn(Optional.of(new SupervisionModuleSettings(ORG, "com", true, SupervisionAutonomy.FULL)));
        when(classifier.classify(anyString(), any())).thenReturn(new ConciergeDecision(true, "faq"));
        stubOrgForfait("essentiel"); // < premium → auto-envoi refusé

        auto.processInbound(ORG, CONV);

        verify(conversationService, never()).sendAutonomousMessage(any(), anyString());
        verify(activityService).recordModuleAct(eq(ORG), eq(PROP), eq("com"),
                eq("concierge_drafted"), anyString());
    }

    @Test
    void processInbound_drafts_whenAutosendOnButNotSafe() {
        ConciergeAgentService auto = build(true, true);
        stubConvAndCredits();
        when(aiAssist.analyzeLastInbound(ORG, CONV))
                .thenReturn(new ConversationAnalysisDto("POSITIVE", 0.7, false));
        when(aiAssist.suggestReply(ORG, CONV))
                .thenReturn(new AiSuggestedResponseDto("À propos de votre remboursement…", "neutral", "fr", List.of()));
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, "com"))
                .thenReturn(Optional.of(new SupervisionModuleSettings(ORG, "com", true, SupervisionAutonomy.NOTIFY)));
        when(classifier.classify(anyString(), any())).thenReturn(new ConciergeDecision(false, "risk_or_negative"));

        auto.processInbound(ORG, CONV);

        verify(conversationService, never()).sendAutonomousMessage(any(), anyString());
        verify(activityService).recordModuleAct(eq(ORG), eq(PROP), eq("com"),
                eq("concierge_drafted"), anyString());
    }

    @Test
    void processInbound_drafts_whenAutonomyIsSuggest_evenIfSafe() {
        ConciergeAgentService auto = build(true, true);
        stubConvAndCredits();
        when(aiAssist.analyzeLastInbound(ORG, CONV))
                .thenReturn(new ConversationAnalysisDto("POSITIVE", 0.7, false));
        when(aiAssist.suggestReply(ORG, CONV))
                .thenReturn(new AiSuggestedResponseDto("Le code wifi est 1234.", "friendly", "fr", List.of()));
        when(classifier.classify(anyString(), any())).thenReturn(new ConciergeDecision(true, "faq"));
        when(moduleSettingsRepository.findByOrganizationIdAndModuleKey(ORG, "com"))
                .thenReturn(Optional.empty()); // absent → défaut SUGGEST → jamais d'auto-envoi

        auto.processInbound(ORG, CONV);

        verify(conversationService, never()).sendAutonomousMessage(any(), anyString());
        verify(activityService).recordModuleAct(eq(ORG), eq(PROP), eq("com"),
                eq("concierge_drafted"), anyString());
    }

    // ── C3 : coordination cross-domaine ─────────────────────────────────────

    @Test
    void processInbound_crossDomain_escalatesCoordinationAndDrafts_neverSends() {
        stubConvAndCredits(); // service C1 (autosend off)
        when(aiAssist.analyzeLastInbound(ORG, CONV))
                .thenReturn(new ConversationAnalysisDto("POSITIVE", 0.7, false));
        when(aiAssist.suggestReply(ORG, CONV))
                .thenReturn(new AiSuggestedResponseDto("Je vérifie la disponibilité…", "friendly", "fr", List.of()));
        when(classifier.classify(anyString(), any()))
                .thenReturn(new ConciergeDecision(false, "cross_domain"));

        service.processInbound(ORG, CONV);

        // Escalade de COORDINATION (pas d'assigné → admins/managers), brouillon prêt, aucun envoi.
        verify(notificationService).notifyAdminsAndManagersByOrgId(eq(ORG),
                eq(NotificationKey.CONCIERGE_ESCALATION), anyString(), anyString(), anyString());
        verify(conversationService, never()).sendAutonomousMessage(any(), anyString());
        verify(activityService).recordModuleAct(eq(ORG), eq(PROP), eq("com"),
                eq("concierge_drafted"), anyString());
    }
}
