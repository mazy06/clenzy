package com.clenzy.service.agent.supervision;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.model.AiFeature;
import com.clenzy.model.GuestReview;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.service.AiTargetResolver;
import com.clenzy.service.KeySource;
import com.clenzy.service.ResolvedTarget;
import com.clenzy.service.agent.AgentTier;
import com.clenzy.service.agent.TierModelResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Brouillon de réponse d'avis (REP) : garde-fous d'organisation, persistance du
 * brouillon, et refus d'écrire quand le modèle ne rend rien.
 *
 * <p>La découpe en trois temps (lecture courte → appel LLM hors transaction →
 * écriture courte) passe par le proxy Spring : ici on le remplace par l'instance
 * elle-même, ce qui exerce le même enchaînement d'appels.</p>
 */
@ExtendWith(MockitoExtension.class)
class ReviewReplyDraftServiceTest {

    @Mock private GuestReviewRepository reviewRepository;
    @Mock private ChatLLMProvider chatProvider;
    @Mock private AiTargetResolver targetResolver;
    @Mock private TierModelResolver tierModelResolver;
    @Mock private ObjectProvider<ReviewReplyDraftService> self;

    private ReviewReplyDraftService service;

    private static final Long ORG = 1L;
    private static final Long REVIEW = 42L;
    private static final Instant NOW = Instant.parse("2026-07-27T10:00:00Z");

    @BeforeEach
    void setUp() {
        service = new ReviewReplyDraftService(
                reviewRepository, chatProvider, targetResolver, tierModelResolver,
                Clock.fixed(NOW, ZoneOffset.UTC), self);
        // Le proxy n'existe pas hors conteneur : les étapes transactionnelles
        // s'appellent donc sur l'instance sous test.
        lenient().when(self.getObject()).thenReturn(service);
        lenient().when(targetResolver.resolvePrimary(anyLong(), any(AiFeature.class), any()))
                .thenReturn(new ResolvedTarget("anthropic", "m", null, null, KeySource.PLATFORM_DB));
        lenient().when(tierModelResolver.resolveModel(any(AgentTier.class), any(), any()))
                .thenReturn("m");
    }

    private GuestReview review(Long orgId) {
        GuestReview r = new GuestReview();
        r.setId(REVIEW);
        r.setOrganizationId(orgId);
        r.setRating(4);
        r.setGuestName("Sophie M.");
        r.setReviewText("Séjour agréable, petit bémol sur le bruit.");
        return r;
    }

    /** Fait répondre le LLM avec {@code answer} (un seul évènement Done). */
    private void givenLlmAnswers(String answer) {
        doAnswer(invocation -> {
            Consumer<ChatEvent> consumer = invocation.getArgument(1);
            consumer.accept(new ChatEvent.Done(10, 20, "m", "stop", answer));
            return null;
        }).when(chatProvider).streamChat(any(ChatRequest.class), any());
    }

    @Test
    void whenLlmAnswers_thenDraftIsStoredWithItsTimestamp() {
        when(reviewRepository.findById(REVIEW)).thenReturn(Optional.of(review(ORG)));
        givenLlmAnswers("  Merci pour votre retour, Sophie.  ");

        service.generateDraft(ORG, REVIEW);

        ArgumentCaptor<GuestReview> saved = ArgumentCaptor.forClass(GuestReview.class);
        verify(reviewRepository).save(saved.capture());
        // Le brouillon est écrit détouré de ses espaces...
        assertThat(saved.getValue().getHostResponseDraft()).isEqualTo("Merci pour votre retour, Sophie.");
        assertThat(saved.getValue().getHostResponseDraftAt()).isEqualTo(NOW);
        // ...et rien n'est publié : répondre reste un geste humain.
        assertThat(saved.getValue().getHostResponse()).isNull();
    }

    @Test
    void whenReviewBelongsToAnotherOrg_thenNothingIsGeneratedNorSaved() {
        when(reviewRepository.findById(REVIEW)).thenReturn(Optional.of(review(999L)));

        assertThatThrownBy(() -> service.generateDraft(ORG, REVIEW))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("hors organisation");

        // Le garde-fou tombe AVANT l'appel au modèle : pas de fuite de contenu
        // d'une autre organisation vers le fournisseur d'IA.
        verify(chatProvider, never()).streamChat(any(ChatRequest.class), any());
        verify(reviewRepository, never()).save(any());
    }

    @Test
    void whenReviewIsUnknown_thenItFailsBeforeCallingTheModel() {
        when(reviewRepository.findById(REVIEW)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.generateDraft(ORG, REVIEW))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("introuvable");

        verify(chatProvider, never()).streamChat(any(ChatRequest.class), any());
        verify(reviewRepository, never()).save(any());
    }

    @Test
    void whenLlmReturnsNothing_thenNoEmptyDraftIsWritten() {
        when(reviewRepository.findById(REVIEW)).thenReturn(Optional.of(review(ORG)));
        givenLlmAnswers("   ");

        assertThatThrownBy(() -> service.generateDraft(ORG, REVIEW))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("LLM indisponible");

        verify(reviewRepository, never()).save(any());
    }

    /**
     * L'avis est relu APRÈS l'appel externe : c'est ce qui permet à l'écriture de
     * travailler sur l'état courant plutôt que sur une entité gardée en mémoire
     * pendant toute la durée de l'appel.
     */
    @Test
    void whenDraftIsGenerated_thenTheReviewIsReReadAfterTheExternalCall() {
        when(reviewRepository.findById(REVIEW)).thenReturn(Optional.of(review(ORG)));
        givenLlmAnswers("Merci !");

        service.generateDraft(ORG, REVIEW);

        // Une lecture pour le prompt, une seconde pour l'écriture.
        verify(reviewRepository, org.mockito.Mockito.times(2)).findById(REVIEW);
    }

    @Test
    void whenBuildingThePrompt_thenItCarriesTheRatingAndTheReviewText() {
        when(reviewRepository.findById(REVIEW)).thenReturn(Optional.of(review(ORG)));
        givenLlmAnswers("Merci !");

        service.generateDraft(ORG, REVIEW);

        ArgumentCaptor<ChatRequest> request = ArgumentCaptor.forClass(ChatRequest.class);
        verify(chatProvider).streamChat(request.capture(), any());
        String prompt = request.getValue().messages().get(0).content();
        assertThat(prompt).contains("4/5").contains("Sophie M.").contains("petit bémol sur le bruit");
    }
}
