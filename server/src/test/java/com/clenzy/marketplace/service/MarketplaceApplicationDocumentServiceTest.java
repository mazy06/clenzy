package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.ProviderStatus;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.model.ProviderDocument;
import com.clenzy.repository.ProviderDocumentRepository;
import com.clenzy.service.PhotoStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Depot de pieces par un candidat SANS COMPTE.
 *
 * <p>Un jeton remplace ici la session : ces tests portent donc surtout sur ce
 * qu'il n'ouvre PAS — un dossier clos, un jeton perime, la piece d'un autre.</p>
 */
@ExtendWith(MockitoExtension.class)
class MarketplaceApplicationDocumentServiceTest {

    @Mock private MarketplaceProviderRepository providerRepository;
    @Mock private ProviderDocumentRepository documentRepository;
    @Mock private PhotoStorageService storageService;
    @Mock private MarketplaceNotificationOutbox notificationService;
    @Mock private MarketplaceApplicationEraser eraser;

    private MarketplaceApplicationDocumentService service;

    private static final Instant NOW = Instant.parse("2026-09-13T09:00:00Z");
    private static final String TOKEN = "jeton-de-test";

    @BeforeEach
    void setUp() {
        service = new MarketplaceApplicationDocumentService(
            providerRepository, documentRepository, storageService, notificationService,
            eraser, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void whenTokenIsUnknown_thenDepositIsRefused() {
        when(providerRepository.findByUploadTokenHash(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.describe(TOKEN))
            .isInstanceOf(MarketplaceApplicationDocumentService.InvalidUploadTokenException.class);
    }

    @Test
    void whenTokenIsBlank_thenNothingIsEvenLookedUp() {
        assertThatThrownBy(() -> service.describe("   "))
            .isInstanceOf(MarketplaceApplicationDocumentService.InvalidUploadTokenException.class);

        verifyNoInteractions(providerRepository);
    }

    @Test
    void whenTokenHasExpired_thenDepositIsRefused() {
        givenCandidate(provider -> provider.setUploadTokenExpiresAt(
            LocalDateTime.ofInstant(NOW, ZoneOffset.UTC).minusDays(1)));

        assertThatThrownBy(() -> service.upload(TOKEN, ProviderDocument.DocumentType.IDENTITY, pdf(), null))
            .isInstanceOf(MarketplaceApplicationDocumentService.InvalidUploadTokenException.class);

        verifyNoInteractions(storageService);
    }

    @Test
    void whenApplicationIsNoLongerUnderReview_thenTheTokenStopsWorking() {
        // Une fiche acceptee a un compte : les depots suivants passent par le
        // chemin authentifie, et ce jeton ne doit plus rien ouvrir.
        givenCandidate(provider -> provider.setStatus(ProviderStatus.ACTIVE));

        assertThatThrownBy(() -> service.describe(TOKEN))
            .isInstanceOf(MarketplaceApplicationDocumentService.InvalidUploadTokenException.class);
    }

    @Test
    void whenTokenIsValid_thenDocumentBelongsToTheApplicationAndToNoOrganization() throws Exception {
        givenCandidate(provider -> {});
        when(documentRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(storageService.storePlatformAsset(any(), any(), any(), any()))
            .thenReturn("platform/marketplace-applications/abc");

        service.upload(TOKEN, ProviderDocument.DocumentType.URSSAF_VIGILANCE, pdf(), null);

        var captor = ArgumentCaptor.forClass(ProviderDocument.class);
        verify(documentRepository).save(captor.capture());
        ProviderDocument saved = captor.getValue();

        assertThat(saved.getMarketplaceProviderId()).isEqualTo(7L);
        // Ni utilisateur ni organisation : le dossier n'appartient a personne
        // dans le produit, et le filtre Hibernate exclut donc la piece de toute
        // lecture cote gestionnaire.
        assertThat(saved.getUserId()).isNull();
        assertThat(saved.getOrganizationId()).isNull();
        assertThat(saved.getStatus()).isEqualTo(ProviderDocument.Status.PENDING);
        // La cle ne doit PAS ressembler a une cle org-scopee : c'est ce qui fait
        // refuser ce binaire par le chemin ou la cle vient du client.
        assertThat(saved.getStorageKey()).startsWith("platform/").doesNotStartWith("org/");
    }

    @Test
    void whenFileIsTooLarge_thenNothingIsStored() {
        givenCandidate(provider -> {});
        var huge = new MockMultipartFile(
            "file", "gros.pdf", "application/pdf", new byte[11 * 1024 * 1024]);

        assertThatThrownBy(() -> service.upload(TOKEN, ProviderDocument.DocumentType.IDENTITY, huge, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("volumineux");

        verifyNoInteractions(storageService);
        verify(documentRepository, never()).save(any());
    }

    @Test
    void whenFormatIsNotOnTheWhitelist_thenItIsRefused() {
        givenCandidate(provider -> {});
        var archive = new MockMultipartFile(
            "file", "pieces.zip", "application/zip", "PK".getBytes());

        assertThatThrownBy(() -> service.upload(TOKEN, ProviderDocument.DocumentType.OTHER, archive, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Format");

        verifyNoInteractions(storageService);
    }

    @Test
    void whenTheDossierIsFull_thenFurtherDepositsAreRefused() {
        givenCandidate(provider -> {});
        when(documentRepository.countByMarketplaceProviderId(7L))
            .thenReturn((long) MarketplaceApplicationDocumentService.MAX_DOCUMENTS);

        assertThatThrownBy(() -> service.upload(TOKEN, ProviderDocument.DocumentType.OTHER, pdf(), null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Trop de pièces");

        verifyNoInteractions(storageService);
    }

    @Test
    void whenDocumentBelongsToAnotherApplication_thenItIsNotDeleted() {
        givenCandidate(provider -> {});
        var foreign = new ProviderDocument();
        foreign.setId(99L);
        foreign.setMarketplaceProviderId(8L);
        foreign.setStorageKey("marketplace/8/secret.pdf");
        when(documentRepository.findById(99L)).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> service.delete(TOKEN, 99L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("introuvable");

        verify(storageService, never()).delete(any());
        verify(documentRepository, never()).delete(any());
    }

    @Test
    void whenDocumentIsAlreadyApproved_thenItCannotBeWithdrawn() {
        givenCandidate(provider -> {});
        var approved = new ProviderDocument();
        approved.setId(12L);
        approved.setMarketplaceProviderId(7L);
        approved.setStatus(ProviderDocument.Status.APPROVED);
        when(documentRepository.findById(12L)).thenReturn(Optional.of(approved));

        assertThatThrownBy(() -> service.delete(TOKEN, 12L))
            .isInstanceOf(IllegalStateException.class);

        verify(storageService, never()).delete(any());
    }

    @Test
    void theCandidateCanWithdrawTheirOwnApplication() {
        // Article 17 exerce directement : le jeton prouve deja la maitrise du
        // dossier, il n'y a personne a attendre.
        givenCandidate(provider -> {});

        service.withdraw(TOKEN);

        verify(eraser).erase(List.of(7L));
    }

    @Test
    void whenTheApplicationWasAlreadyDecided_thenTheTokenCannotWithdrawIt() {
        // Une fiche acceptee porte un compte : l'effacement passe par lui, pas
        // par un jeton de depot qui trainerait encore dans un navigateur.
        givenCandidate(provider -> provider.setStatus(ProviderStatus.ACTIVE));

        assertThatThrownBy(() -> service.withdraw(TOKEN))
            .isInstanceOf(MarketplaceApplicationDocumentService.InvalidUploadTokenException.class);

        verifyNoInteractions(eraser);
    }

    // ─── Verdict cote plateforme ─────────────────────────────────────────────

    @Test
    void whenVerdictIsPending_thenItIsRefused() {
        // « En attente » n'est pas un verdict : l'accepter permettrait de
        // remettre une piece deja tranchee dans la pile sans le dire.
        assertThatThrownBy(() ->
            service.review(7L, 12L, ProviderDocument.Status.PENDING, null, 3L))
            .isInstanceOf(IllegalArgumentException.class);

        verify(documentRepository, never()).save(any());
    }

    @Test
    void whenDocumentBelongsToAnAccount_thenItCannotBeReviewedByThisPath() {
        givenConfirmedReviewCandidate();
        // Une piece rattachee a un COMPTE n'a pas de marketplaceProviderId :
        // sans ce controle, son identifiant suffirait a la trancher ici.
        var accountDocument = new ProviderDocument();
        accountDocument.setId(12L);
        accountDocument.setUserId(55L);
        when(documentRepository.findById(12L)).thenReturn(Optional.of(accountDocument));

        assertThatThrownBy(() ->
            service.review(7L, 12L, ProviderDocument.Status.APPROVED, null, 3L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("introuvable");

        verify(documentRepository, never()).save(any());
    }

    @Test
    void whenRejectionNoteContainsMarkup_thenItIsEscapedBeforeStorage() {
        givenConfirmedReviewCandidate();
        // Le motif est rendu au candidat, courriel compris : il ne repart pas
        // tel quel.
        var document = new ProviderDocument();
        document.setId(12L);
        document.setMarketplaceProviderId(7L);
        when(documentRepository.findById(12L)).thenReturn(Optional.of(document));
        when(documentRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        var reviewed = service.review(7L, 12L, ProviderDocument.Status.REJECTED,
            "Scan illisible <script>alert(1)</script>", 3L);

        assertThat(reviewed.getReviewNote()).doesNotContain("<script>");
        assertThat(reviewed.getReviewedBy()).isEqualTo(3L);
        assertThat(reviewed.getReviewedAt())
            .isEqualTo(LocalDateTime.ofInstant(NOW, ZoneOffset.UTC));
    }

    @Test
    void whenRejectionNoteIsBlank_thenNoEmptyStringIsStored() {
        givenConfirmedReviewCandidate();
        var document = new ProviderDocument();
        document.setId(12L);
        document.setMarketplaceProviderId(7L);
        when(documentRepository.findById(12L)).thenReturn(Optional.of(document));
        when(documentRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        var reviewed = service.review(7L, 12L, ProviderDocument.Status.APPROVED, "   ", 3L);

        assertThat(reviewed.getReviewNote()).isNull();
    }

    @Test
    void theStoredTokenIsAnImprintAndNotTheTokenItself() {
        // Une lecture de la base ne doit pas donner de quoi ouvrir un dossier.
        String hash = MarketplaceUploadTokens.hash(TOKEN);

        assertThat(hash).hasSize(64).isNotEqualTo(TOKEN).matches("[0-9a-f]{64}");
        assertThat(MarketplaceUploadTokens.generate())
            .isNotEqualTo(MarketplaceUploadTokens.generate());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value = ProviderDocument.Status.class, names = {"APPROVED", "REJECTED"})
    void unconfirmedEmailPreventsDocumentDecisions(ProviderDocument.Status status) {
        when(providerRepository.findForErasure(7L)).thenReturn(Optional.of(new MarketplaceProvider()));
        assertThatThrownBy(() -> service.review(7L, 12L, status, "Motif", 3L))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("confirmée");
        verifyNoInteractions(documentRepository);
    }

    @Test
    void rejectingDocumentRequiresAnExplanation() {
        givenConfirmedReviewCandidate();
        var document = new ProviderDocument();
        document.setMarketplaceProviderId(7L);
        when(documentRepository.findById(12L)).thenReturn(Optional.of(document));
        assertThatThrownBy(() -> service.review(7L, 12L, ProviderDocument.Status.REJECTED, "  ", 3L))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("motif");
        verify(documentRepository, never()).save(any());
    }

    private void givenConfirmedReviewCandidate() {
        var provider = new MarketplaceProvider();
        provider.setEmailConfirmedAt(LocalDateTime.ofInstant(NOW, ZoneOffset.UTC));
        when(providerRepository.findForErasure(7L)).thenReturn(Optional.of(provider));
    }

    private static MockMultipartFile pdf() {
        return new MockMultipartFile("file", "kbis.pdf", "application/pdf", "%PDF-1.4".getBytes());
    }

    /** Candidature en examen, jeton valable, que chaque test derive sur un point. */
    private void givenCandidate(java.util.function.Consumer<MarketplaceProvider> tweak) {
        var provider = new MarketplaceProvider();
        provider.setId(7L);
        provider.setDisplayName("Atelier Ourika");
        provider.setStatus(ProviderStatus.PENDING_REVIEW);
        provider.setUploadTokenExpiresAt(LocalDateTime.ofInstant(NOW, ZoneOffset.UTC).plusDays(20));
        tweak.accept(provider);

        when(providerRepository.findByUploadTokenHash(MarketplaceUploadTokens.hash(TOKEN)))
            .thenReturn(Optional.of(provider));
    }
}
