package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.ProviderStatus;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.model.ProviderDocument;
import com.clenzy.repository.ProviderDocumentRepository;
import com.clenzy.service.PhotoStorageService;
import com.clenzy.service.ProviderDocumentService;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Depot des justificatifs par un candidat qui n'a pas encore de compte.
 *
 * <p>Surface NON authentifiee, gardee par un jeton a usage prolonge et non par
 * une session. Trois consequences tenues ici :</p>
 * <ul>
 *   <li>le jeton est compare par EMPREINTE — la base ne detient jamais sa forme
 *       utilisable ;</li>
 *   <li>la fenetre se referme des que la candidature quitte l'examen : une
 *       fiche acceptee a un compte, et c'est par lui que passent les depots
 *       suivants ;</li>
 *   <li>le nombre de pieces est borne — sans compte a suspendre, un jeton fuite
 *       serait sinon un espace de stockage gratuit.</li>
 * </ul>
 *
 * <p>Les pieces vivent dans la MEME table que celles des intervenants ayant un
 * compte : meme nature, meme cycle de vie, et l'acceptation d'un dossier devient
 * un changement de proprietaire plutot qu'une recopie entre deux tables qui
 * divergeraient.</p>
 */
@Service
public class MarketplaceApplicationDocumentService {

    private static final Logger log =
        LoggerFactory.getLogger(MarketplaceApplicationDocumentService.class);

    /**
     * Plafond de pieces par candidature.
     *
     * <p>Quatre types sont attendus, chacun pouvant etre redepose apres un
     * refus : douze laisse de la marge a un dossier honnete et coupe court a
     * l'usage d'un jeton comme espace de stockage.</p>
     */
    static final int MAX_DOCUMENTS = 12;

    /** Espace de noms des binaires, cf. {@code PlatformAssetKeys}. */
    private static final String STORAGE_NAMESPACE = "marketplace-applications";

    private final MarketplaceProviderRepository providerRepository;
    private final ProviderDocumentRepository documentRepository;
    private final PhotoStorageService storageService;
    private final MarketplaceNotificationOutbox notifications;
    private final MarketplaceApplicationEraser eraser;
    private final Clock clock;

    public MarketplaceApplicationDocumentService(MarketplaceProviderRepository providerRepository,
                                                 ProviderDocumentRepository documentRepository,
                                                 PhotoStorageService storageService,
                                                 MarketplaceNotificationOutbox notifications,
                                                 MarketplaceApplicationEraser eraser,
                                                 Clock clock) {
        this.providerRepository = providerRepository;
        this.documentRepository = documentRepository;
        this.storageService = storageService;
        this.notifications = notifications;
        this.eraser = eraser;
        this.clock = clock;
    }

    /**
     * Jeton invalide, expire, ou dossier qui n'est plus a l'examen.
     *
     * <p>Un seul type pour les trois cas, et un message unique : distinguer
     * « inconnu » de « expire » dirait a qui essaie des jetons lesquels ont
     * existe.</p>
     */
    public static class InvalidUploadTokenException extends RuntimeException {
        public InvalidUploadTokenException() {
            super("Lien de dépôt invalide ou expiré.");
        }
    }

    /** Etat du dossier, tel que le candidat peut le consulter. */
    public record ApplicationView(String displayName,
                                  ProviderStatus status,
                                  LocalDateTime submittedAt,
                                  List<ProviderDocument> documents) {}

    @Transactional(readOnly = true)
    public ApplicationView describe(String token) {
        MarketplaceProvider provider = requireCandidate(token);
        return new ApplicationView(
            provider.getDisplayName(),
            provider.getStatus(),
            provider.getSubmittedAt(),
            documentRepository.findByMarketplaceProviderIdOrderByCreatedAtDesc(provider.getId()));
    }

    /**
     * Depot d'une piece.
     *
     * <p>Les depots successifs d'un meme type sont conserves, comme du cote
     * authentifie : une attestation renouvelee s'ajoute, elle ne remplace pas.</p>
     */
    @Transactional
    public ProviderDocument upload(String token,
                                   ProviderDocument.DocumentType type,
                                   MultipartFile file,
                                   LocalDate expiresAt) throws IOException {
        MarketplaceProvider provider = requireCandidate(token);

        if (type == null) {
            throw new IllegalArgumentException("Type de justificatif manquant");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier vide");
        }
        if (file.getSize() > ProviderDocumentService.MAX_FILE_SIZE) {
            throw new IllegalArgumentException("Fichier trop volumineux (10 Mo maximum)");
        }
        final String contentType = file.getContentType();
        if (contentType == null
            || !ProviderDocumentService.ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("Format non accepté : PDF, JPEG, PNG, HEIC ou WEBP");
        }
        if (documentRepository.countByMarketplaceProviderId(provider.getId()) >= MAX_DOCUMENTS) {
            throw new IllegalArgumentException(
                "Trop de pièces déposées pour ce dossier. Contactez l'équipe Baitly.");
        }

        // Stockage PLATEFORME : ce binaire n'appartient a aucune organisation,
        // et `store` en exigerait une. Le ranger sous une organisation
        // arbitraire aurait ete un mensonge inscrit dans la cle.
        String storageKey = storageService.storePlatformAsset(
            STORAGE_NAMESPACE, file.getBytes(), contentType, file.getOriginalFilename());

        ProviderDocument document = new ProviderDocument();
        document.setMarketplaceProviderId(provider.getId());
        // Ni utilisateur ni organisation : le dossier n'appartient encore a
        // personne dans le produit. `organization_id` reste vide, et le filtre
        // Hibernate exclut donc ces pieces de toute lecture cote gestionnaire.
        document.setDocumentType(type);
        document.setStorageKey(storageKey);
        document.setFileName(StringUtils.sanitizeFileName(file.getOriginalFilename()));
        document.setContentType(contentType);
        document.setFileSize(file.getSize());
        document.setExpiresAt(expiresAt);

        ProviderDocument saved = documentRepository.save(document);
        log.info("Piece deposee sur candidature id={} type={}", provider.getId(), type);

        // Un dossier complete redevient instruisable : sans ce signal, il
        // attendrait qu'on pense a rouvrir la fiche.
        notifications.enqueue(provider.getId(), "DOCUMENT_STAFF", type.name(), null, null);

        return saved;
    }

    /**
     * Retrait d'une piece deposee par erreur.
     *
     * <p>Une piece DEJA VALIDEE ne se retire pas — meme regle que du cote
     * authentifie : elle atteste d'un examen a un instant donne.</p>
     */
    @Transactional
    public void delete(String token, Long documentId) {
        MarketplaceProvider provider = requireCandidate(token);

        ProviderDocument document = documentRepository.findById(documentId)
            .orElseThrow(() -> new IllegalArgumentException("Justificatif introuvable"));
        // `findById` ne passe par aucun filtre : sans ce controle, un
        // identifiant devine suffirait a effacer la piece d'un autre candidat.
        if (!provider.getId().equals(document.getMarketplaceProviderId())) {
            throw new IllegalArgumentException("Justificatif introuvable");
        }
        if (document.getStatus() == ProviderDocument.Status.APPROVED) {
            throw new IllegalStateException(
                "Une pièce validée ne peut pas être supprimée — déposez une nouvelle version.");
        }
        storageService.delete(document.getStorageKey());
        documentRepository.delete(document);
    }

    /**
     * Le candidat retire sa candidature.
     *
     * <p>Article 17 du RGPD, exerce directement : le jeton prouve deja la
     * maitrise du dossier, il n'y a donc personne a attendre. Le refuser
     * obligerait a ecrire un courriel et a esperer une reponse, pour un droit
     * qui n'a pas a se negocier.</p>
     *
     * <p>Un dossier DEJA TRANCHE n'est pas concerne : accepte, il a un compte, et
     * c'est par lui que l'effacement passe. {@code requireCandidate} s'en
     * charge — il n'ouvre que sur une candidature a l'examen.</p>
     */
    @Transactional
    public void withdraw(String token) {
        MarketplaceProvider provider = requireCandidate(token);
        eraser.erase(List.of(provider.getId()));
        log.info("Candidature {} retiree par son auteur", provider.getId());
    }

    // ─── Lecture cote plateforme ─────────────────────────────────────────────

    /**
     * Pieces d'une candidature, pour l'equipe qui l'instruit.
     *
     * <p>Pas de jeton ici : l'appelant est deja {@code SUPER_ADMIN} ou
     * {@code SUPER_MANAGER}, garde par le controller d'administration.</p>
     */
    @Transactional(readOnly = true)
    public List<ProviderDocument> listForApplication(Long providerId) {
        var provider=providerRepository.findById(providerId).orElseThrow();
        var result=new java.util.ArrayList<>(documentRepository.findByMarketplaceProviderIdOrderByCreatedAtDesc(providerId));
        if(provider.getUserId()!=null) result.addAll(documentRepository.findByUserIdOrderByCreatedAtDesc(provider.getUserId()));
        return result;
    }

    /** Binaire d'une piece de candidature. */
    @Transactional(readOnly = true)
    public DocumentPayload downloadForApplication(Long providerId, Long documentId) {
        ProviderDocument document = documentRepository.findById(documentId)
            .orElseThrow(() -> new IllegalArgumentException("Justificatif introuvable"));
        // `findById` ne passe par aucun filtre : sans ce controle, l'identifiant
        // d'une piece rattachee a un COMPTE suffirait a la lire par ce chemin.
        var owner=providerRepository.findById(providerId).orElseThrow();
        if (!providerId.equals(document.getMarketplaceProviderId())
                && (owner.getUserId()==null || !owner.getUserId().equals(document.getUserId()))) {
            throw new IllegalArgumentException("Justificatif introuvable");
        }
        return new DocumentPayload(
            storageService.retrieve(document.getStorageKey()),
            document.getContentType(),
            document.getFileName());
    }

    public record DocumentPayload(byte[] data, String contentType, String fileName) {}

    /**
     * Verdict sur une piece.
     *
     * <p>Le motif accompagne un refus : sans lui le candidat redepose la meme
     * chose. Il est rendu tel quel au deposant, d'ou l'echappement — il finira
     * dans un courriel.</p>
     */
    @Transactional
    public ProviderDocument review(Long providerId, Long documentId,
                                   ProviderDocument.Status status, String note, Long reviewerId) {
        if (status == null || status == ProviderDocument.Status.PENDING) {
            throw new IllegalArgumentException("Verdict attendu : APPROVED ou REJECTED");
        }
        MarketplaceProvider provider = providerRepository.findForErasure(providerId)
            .orElseThrow(() -> new IllegalArgumentException("Candidature introuvable"));
        MarketplaceReviewPolicy.requireConfirmedEmail(provider);
        ProviderDocument document = documentRepository.findById(documentId)
            .orElseThrow(() -> new IllegalArgumentException("Justificatif introuvable"));
        if (!providerId.equals(document.getMarketplaceProviderId())
                && (provider.getUserId()==null || !provider.getUserId().equals(document.getUserId()))) {
            throw new IllegalArgumentException("Justificatif introuvable");
        }
        String cleaned = trimToNull(note);
        if (status == ProviderDocument.Status.REJECTED && cleaned == null) {
            throw new IllegalArgumentException("Un refus de justificatif doit porter un motif.");
        }
        document.setStatus(status);
        document.setReviewNote(cleaned == null ? null : StringUtils.escapeHtml(cleaned));
        document.setReviewedBy(reviewerId);
        document.setReviewedAt(LocalDateTime.now(clock));
        return documentRepository.save(document);
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /**
     * Resout le jeton, ou refuse.
     *
     * <p>Le dossier doit etre EN EXAMEN : une fois accepte, le prestataire a un
     * compte et depose par le chemin authentifie ; une fois refuse, il n'y a
     * plus rien a instruire.</p>
     */
    private MarketplaceProvider requireCandidate(String token) {
        if (token == null || token.isBlank()) {
            throw new InvalidUploadTokenException();
        }
        MarketplaceProvider provider = providerRepository
            .findByUploadTokenHash(MarketplaceUploadTokens.hash(token))
            .orElseThrow(InvalidUploadTokenException::new);

        LocalDateTime expiry = provider.getUploadTokenExpiresAt();
        if (expiry == null || expiry.isBefore(LocalDateTime.now(clock))) {
            throw new InvalidUploadTokenException();
        }
        if (provider.getStatus() != ProviderStatus.PENDING_REVIEW) {
            throw new InvalidUploadTokenException();
        }
        return provider;
    }
}
