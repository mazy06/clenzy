package com.clenzy.service.agent.briefing;

import com.clenzy.model.AssistantBriefingPref;
import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.AgentOrchestrator;
import com.clenzy.service.agent.AgentSseEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BriefingComposerTest {

    private AgentOrchestrator orchestrator;
    private AssistantConversationRepository convRepo;
    private AssistantMessageRepository msgRepo;
    private BriefingComposer composer;

    @BeforeEach
    void setUp() {
        orchestrator = mock(AgentOrchestrator.class);
        convRepo = mock(AssistantConversationRepository.class);
        msgRepo = mock(AssistantMessageRepository.class);
        // targetResolver null = chemin legacy : le modele reste impose, ce que
        // verifient les tests de prompt ci-dessous.
        composer = new BriefingComposer(orchestrator, convRepo, msgRepo,
                null, null, "claude-haiku-4-5-20251001");
    }

    private static AssistantBriefingPref pref(AssistantBriefingPref.Frequency f) {
        AssistantBriefingPref p = new AssistantBriefingPref(1L, "user-x");
        p.setFrequencyEnum(f);
        p.setTimezone("Europe/Paris");
        p.setTimeLocal(LocalTime.of(8, 0));
        return p;
    }

    @Test
    void compose_callsOrchestratorWithDailyPrompt() {
        when(orchestrator.handleMessage(isNull(), anyString(), any(AgentContext.class), any()))
                .thenReturn(42L);
        AssistantConversation conv = new AssistantConversation(1L, "user-x");
        conv.setId(42L);
        when(convRepo.findById(42L)).thenReturn(Optional.of(conv));
        when(msgRepo.findByConversation(42L)).thenReturn(List.of(
                AssistantMessage.assistant(42L, 1L, "Voici ton briefing matinal", null)
        ));

        BriefingComposer.BriefingResult result = composer.compose(
                pref(AssistantBriefingPref.Frequency.DAILY_MORNING));

        assertNotNull(result);
        assertEquals(42L, result.conversationId());
        assertEquals(AssistantBriefingPref.Frequency.DAILY_MORNING, result.frequency());
        assertTrue(result.body().contains("briefing matinal"));

        // Verify prompt selection
        ArgumentCaptor<String> promptCap = ArgumentCaptor.forClass(String.class);
        verify(orchestrator).handleMessage(isNull(), promptCap.capture(), any(), any());
        assertTrue(promptCap.getValue().toLowerCase().contains("briefing matinal"));
    }

    @Test
    void compose_weeklySunday_usesWeeklyPrompt() {
        when(orchestrator.handleMessage(isNull(), anyString(), any(), any())).thenReturn(7L);
        AssistantConversation conv = new AssistantConversation(1L, "user-x");
        conv.setId(7L);
        when(convRepo.findById(7L)).thenReturn(Optional.of(conv));
        when(msgRepo.findByConversation(7L)).thenReturn(List.of());

        composer.compose(pref(AssistantBriefingPref.Frequency.WEEKLY_SUNDAY));

        ArgumentCaptor<String> promptCap = ArgumentCaptor.forClass(String.class);
        verify(orchestrator).handleMessage(isNull(), promptCap.capture(), any(), any());
        assertTrue(promptCap.getValue().toLowerCase().contains("weekly review"));
    }

    @Test
    void compose_onlyAlerts_usesAlertPrompt() {
        when(orchestrator.handleMessage(isNull(), anyString(), any(), any())).thenReturn(8L);
        when(convRepo.findById(8L)).thenReturn(Optional.empty());
        when(msgRepo.findByConversation(8L)).thenReturn(List.of());

        composer.compose(pref(AssistantBriefingPref.Frequency.ONLY_ALERTS));

        ArgumentCaptor<String> promptCap = ArgumentCaptor.forClass(String.class);
        verify(orchestrator).handleMessage(isNull(), promptCap.capture(), any(), any());
        assertTrue(promptCap.getValue().toLowerCase().contains("alerte"));
    }

    @Test
    void compose_setsTitleWithDate() {
        when(orchestrator.handleMessage(isNull(), anyString(), any(), any())).thenReturn(10L);
        AssistantConversation conv = new AssistantConversation(1L, "user-x");
        conv.setId(10L);
        when(convRepo.findById(10L)).thenReturn(Optional.of(conv));
        when(msgRepo.findByConversation(10L)).thenReturn(List.of());

        composer.compose(pref(AssistantBriefingPref.Frequency.DAILY_MORNING));

        ArgumentCaptor<AssistantConversation> convCap =
                ArgumentCaptor.forClass(AssistantConversation.class);
        verify(convRepo).save(convCap.capture());
        String title = convCap.getValue().getTitle();
        assertNotNull(title);
        assertTrue(title.startsWith("Briefing du "));
    }

    @Test
    void compose_orchestratorThrows_returnsNull() {
        when(orchestrator.handleMessage(isNull(), anyString(), any(), any()))
                .thenThrow(new RuntimeException("LLM down"));

        BriefingComposer.BriefingResult result = composer.compose(
                pref(AssistantBriefingPref.Frequency.DAILY_MORNING));
        assertNull(result);
    }

    @Test
    void compose_corpsVide_returnsNull_pourQueLeRetryReprenne() {
        // Cas reel du 30/08 : credits IA epuisses en prod, provider en 404 en
        // dev. L'orchestrateur rend bien un id de conversation, mais aucun
        // message assistant n'a ete produit. Rendre un resultat creux menait a
        // SKIPPED, statut que le retry ignore ; null mene a FAILED, repris.
        when(orchestrator.handleMessage(isNull(), anyString(), any(AgentContext.class), any()))
                .thenReturn(42L);
        AssistantConversation conv = new AssistantConversation(1L, "user-x");
        conv.setId(42L);
        when(convRepo.findById(42L)).thenReturn(Optional.of(conv));
        when(msgRepo.findByConversation(42L)).thenReturn(List.of());

        BriefingComposer.BriefingResult result = composer.compose(
                pref(AssistantBriefingPref.Frequency.WEEKLY_SUNDAY));

        assertNull(result);
    }

    @Test
    void compose_corpsBlanc_returnsNull() {
        // Meme exigence sur un message present mais vide de contenu : c'est le
        // texte qui fait le briefing, pas l'existence d'une ligne en base.
        when(orchestrator.handleMessage(isNull(), anyString(), any(AgentContext.class), any()))
                .thenReturn(42L);
        AssistantConversation conv = new AssistantConversation(1L, "user-x");
        conv.setId(42L);
        when(convRepo.findById(42L)).thenReturn(Optional.of(conv));
        when(msgRepo.findByConversation(42L)).thenReturn(List.of(
                AssistantMessage.assistant(42L, 1L, "   ", null)
        ));

        assertNull(composer.compose(pref(AssistantBriefingPref.Frequency.DAILY_MORNING)));
    }

    // ─── Modele impose : seulement chez Anthropic ───────────────────────────

    private BriefingComposer composerWithProvider(String provider) {
        com.clenzy.service.AiTargetResolver resolver =
                mock(com.clenzy.service.AiTargetResolver.class);
        when(resolver.primaryProvider(any(), eq(com.clenzy.model.AiFeature.ASSISTANT_CHAT)))
                .thenReturn(provider);
        return new BriefingComposer(orchestrator, convRepo, msgRepo, null, resolver,
                "claude-haiku-4-5-20251001");
    }

    private void stubOrchestratorWithAnswer() {
        when(orchestrator.handleMessage(isNull(), anyString(), any(AgentContext.class), any()))
                .thenReturn(42L);
        AssistantConversation conv = new AssistantConversation(1L, "user-x");
        conv.setId(42L);
        when(convRepo.findById(42L)).thenReturn(Optional.of(conv));
        when(msgRepo.findByConversation(42L)).thenReturn(List.of(
                AssistantMessage.assistant(42L, 1L, "La semaine ecoulee", null)
        ));
    }

    @Test
    void compose_providerOpenai_nImposePasLeModeleAnthropique() {
        // Le resolveur applique l'override au provider retenu : un identifiant
        // Anthropic envoye a un endpoint OpenAI repond 404, et l'organisation
        // n'aurait alors JAMAIS de briefing.
        stubOrchestratorWithAnswer();

        composerWithProvider("openai").compose(pref(AssistantBriefingPref.Frequency.WEEKLY_SUNDAY));

        ArgumentCaptor<AgentContext> ctx = ArgumentCaptor.forClass(AgentContext.class);
        verify(orchestrator).handleMessage(isNull(), anyString(), ctx.capture(), any());
        assertNull(ctx.getValue().modelOverride());
    }

    @Test
    void compose_providerAnthropic_gardeLeModeleEconomique() {
        stubOrchestratorWithAnswer();

        composerWithProvider("anthropic").compose(pref(AssistantBriefingPref.Frequency.WEEKLY_SUNDAY));

        ArgumentCaptor<AgentContext> ctx = ArgumentCaptor.forClass(AgentContext.class);
        verify(orchestrator).handleMessage(isNull(), anyString(), ctx.capture(), any());
        assertEquals("claude-haiku-4-5-20251001", ctx.getValue().modelOverride());
    }

    @Test
    void compose_nullPref_throws() {
        assertThrows(IllegalArgumentException.class, () -> composer.compose(null));
    }

    @Test
    void compose_concatenatesAssistantMessages_ignoresOtherRoles() {
        when(orchestrator.handleMessage(isNull(), anyString(), any(), any())).thenReturn(11L);
        when(convRepo.findById(11L)).thenReturn(Optional.empty());
        when(msgRepo.findByConversation(11L)).thenReturn(List.of(
                AssistantMessage.user(11L, 1L, "ignored user prompt"),
                AssistantMessage.assistant(11L, 1L, "Section 1", null),
                AssistantMessage.tool(11L, 1L, "toolu_1", "tool result ignored"),
                AssistantMessage.assistant(11L, 1L, "Section 2", null)
        ));

        BriefingComposer.BriefingResult result = composer.compose(
                pref(AssistantBriefingPref.Frequency.DAILY_MORNING));

        assertNotNull(result);
        assertTrue(result.body().contains("Section 1"));
        assertTrue(result.body().contains("Section 2"));
        assertFalse(result.body().contains("ignored user prompt"));
        assertFalse(result.body().contains("tool result ignored"));
    }

    @Test
    void compose_passesUserKeycloakIdToOrchestrator() {
        when(orchestrator.handleMessage(isNull(), anyString(), any(AgentContext.class), any()))
                .thenReturn(1L);
        when(convRepo.findById(any())).thenReturn(Optional.empty());
        when(msgRepo.findByConversation(any())).thenReturn(List.of());

        composer.compose(pref(AssistantBriefingPref.Frequency.DAILY_MORNING));

        ArgumentCaptor<AgentContext> ctxCap = ArgumentCaptor.forClass(AgentContext.class);
        verify(orchestrator).handleMessage(isNull(), anyString(), ctxCap.capture(),
                any(Consumer.class));
        assertEquals("user-x", ctxCap.getValue().keycloakId());
        assertEquals(1L, ctxCap.getValue().organizationId());
        assertNull(ctxCap.getValue().jwt());
    }

    @Test
    void compose_passesBriefingModelOverride() {
        when(orchestrator.handleMessage(isNull(), anyString(), any(AgentContext.class), any()))
                .thenReturn(1L);
        when(convRepo.findById(any())).thenReturn(Optional.empty());
        when(msgRepo.findByConversation(any())).thenReturn(List.of());

        composer.compose(pref(AssistantBriefingPref.Frequency.DAILY_MORNING));

        ArgumentCaptor<AgentContext> ctxCap = ArgumentCaptor.forClass(AgentContext.class);
        verify(orchestrator).handleMessage(isNull(), anyString(), ctxCap.capture(),
                any(Consumer.class));
        // Le composer doit forcer Haiku via le modelOverride pour reduire le cout
        assertEquals("claude-haiku-4-5-20251001", ctxCap.getValue().modelOverride());
    }

    @SuppressWarnings("unused")
    private static AgentSseEvent unused() { return null; } // keep import
}
