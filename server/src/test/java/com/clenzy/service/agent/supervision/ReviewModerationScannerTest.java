package com.clenzy.service.agent.supervision;

import com.clenzy.model.GuestReview;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.repository.PropertyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Scan « rep » des avis sans réponse.
 *
 * <p>Deux invariants s'y jouent. L'ÉLIGIBILITÉ d'abord : tout avis sans réponse
 * mérite une proposition, quelle que soit la note — la carte « À traiter » les
 * liste tous, l'agent doit couvrir le même périmètre. Le TON ensuite : modérer un
 * mécontentement n'est pas remercier un client satisfait, et annoncer un « impact
 * réputationnel » sur un avis élogieux ferait mentir la carte.</p>
 */
@ExtendWith(MockitoExtension.class)
class ReviewModerationScannerTest {

    @Mock private GuestReviewRepository reviewRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private SupervisionSuggestionService suggestionService;
    @Mock private AutoApplyGate autoApplyGate;
    @Mock private SupervisionAutoApplyService autoApplyService;

    private ReviewModerationScanner scanner;

    private static final Long ORG = 1L;
    private static final Long PROPERTY = 7L;

    @BeforeEach
    void setUp() {
        scanner = new ReviewModerationScanner(reviewRepository, propertyRepository,
                suggestionService, autoApplyGate, autoApplyService);
        // Chemin HITL : le scan enregistre une carte, sans auto-application — c'est
        // le chemin que ce test observe.
        lenient().when(autoApplyGate.decide(anyLong(), anyString(), anyString(), any()))
                .thenReturn(AutoApplyGate.AutoDecision.CARD);
        lenient().when(propertyRepository.findById(PROPERTY)).thenReturn(Optional.empty());
    }

    private GuestReview review(Long id, Integer rating, String text) {
        GuestReview r = new GuestReview();
        r.setId(id);
        r.setOrganizationId(ORG);
        r.setPropertyId(PROPERTY);
        r.setRating(rating);
        r.setGuestName("Sophie M.");
        r.setReviewText(text);
        r.setReviewDate(LocalDate.of(2026, 7, 8));
        return r;
    }

    private void givenUntreated(GuestReview... reviews) {
        when(reviewRepository.findUntreatedByPropertyId(PROPERTY, ORG)).thenReturn(List.of(reviews));
    }

    /** Capture (titre, motif) de la carte enregistrée. */
    private String[] capturedCard() {
        ArgumentCaptor<String> title = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> motif = ArgumentCaptor.forClass(String.class);
        verify(suggestionService).recordActionable(eq(ORG), eq(PROPERTY), eq("rep"),
                title.capture(), motif.capture(), eq(SupervisionActionType.REVIEW_DRAFT_REPLY),
                anyString(), isNull(), eq("warning"));
        return new String[] { title.getValue(), motif.getValue() };
    }

    @Test
    void whenReviewIsPositiveAndUnanswered_thenACardIsStillEmitted() {
        givenUntreated(review(42L, 5, "Séjour exceptionnel, tout était parfait."));

        scanner.scanProperty(ORG, PROPERTY);

        String[] card = capturedCard();
        // L'élargissement : avant, une note de 5 n'était jamais scannée.
        assertThat(card[0]).isEqualTo("Avis sans réponse — avis #42");
        assertThat(card[1])
                .contains("Avis 5/5 de Sophie M.")
                .contains("occasion manquée")
                .doesNotContain("impact réputationnel");
    }

    @Test
    void whenReviewIsNegative_thenTheCardKeepsItsModerationWording() {
        givenUntreated(review(43L, 1, "Logement sale, rien ne correspondait."));

        scanner.scanProperty(ORG, PROPERTY);

        String[] card = capturedCard();
        assertThat(card[0]).isEqualTo("Avis négatif à modérer — avis #43");
        assertThat(card[1])
                .contains("impact réputationnel")
                .doesNotContain("occasion manquée");
    }

    /**
     * Un avis sans note ne prouve aucun mécontentement : le traiter en négatif
     * ferait annoncer un dommage qu'on n'a pas constaté.
     */
    @Test
    void whenRatingIsUnknown_thenTheReviewIsTreatedAsNeutral() {
        givenUntreated(review(44L, null, "Merci pour l'accueil."));

        scanner.scanProperty(ORG, PROPERTY);

        String[] card = capturedCard();
        assertThat(card[0]).isEqualTo("Avis sans réponse — avis #44");
        assertThat(card[1]).contains("Avis sans note de Sophie M.");
    }

    @Test
    void whenSeveralReviewsAreUntreated_thenEachGetsItsOwnCard() {
        givenUntreated(review(45L, 2, "Bruyant."), review(46L, 4, "Très bien."));

        scanner.scanProperty(ORG, PROPERTY);

        // Le titre porte l'identifiant de l'avis : c'est ce qui rend la dédup
        // fiable ET garantit une carte par avis distinct.
        ArgumentCaptor<String> titles = ArgumentCaptor.forClass(String.class);
        verify(suggestionService, times(2)).recordActionable(eq(ORG), eq(PROPERTY), eq("rep"),
                titles.capture(), anyString(), eq(SupervisionActionType.REVIEW_DRAFT_REPLY),
                anyString(), isNull(), eq("warning"));
        assertThat(titles.getAllValues())
                .containsExactly("Avis négatif à modérer — avis #45", "Avis sans réponse — avis #46");
    }

    @Test
    void whenNothingIsUntreated_thenNoCardAndNoGateCall() {
        givenUntreated();

        scanner.scanProperty(ORG, PROPERTY);

        verify(suggestionService, never()).recordActionable(anyLong(), anyLong(), anyString(),
                anyString(), anyString(), anyString(), anyString(), any(), anyString());
        verify(autoApplyGate, never()).decide(anyLong(), anyString(), anyString(), any());
    }

    /** Le paramètre d'action doit porter l'avis visé, sinon l'apply ne sait pas quoi rédiger. */
    @Test
    void whenCardIsEmitted_thenItCarriesTheReviewIdAsActionParam() {
        givenUntreated(review(47L, 3, "Correct."));

        scanner.scanProperty(ORG, PROPERTY);

        ArgumentCaptor<String> params = ArgumentCaptor.forClass(String.class);
        verify(suggestionService).recordActionable(anyLong(), anyLong(), anyString(),
                anyString(), anyString(), eq(SupervisionActionType.REVIEW_DRAFT_REPLY),
                params.capture(), isNull(), anyString());
        assertThat(params.getValue()).isEqualTo("{\"reviewId\":47}");
    }
}
