package com.clenzy.service;

import com.clenzy.model.ProviderDocument;
import com.clenzy.model.User;
import com.clenzy.repository.ProviderDocumentRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * Justificatifs professionnels des intervenants — depot, consultation, retrait.
 *
 * <p>Le binaire part dans {@link PhotoStorageService} ; la table ne porte que
 * les metadonnees. Le service est le seul point d'entree : un controller ne
 * touche jamais le repository (regle ArchUnit gelee).</p>
 */
@Service
public class ProviderDocumentService {

    /** 10 Mo : un scan de Kbis ou une photo d'attestation tient largement dedans. */
    public static final long MAX_FILE_SIZE = 10L * 1024 * 1024;

    /**
     * Formats acceptes. Liste BLANCHE et non liste noire : tout ce qui n'est pas
     * explicitement un document ou une image est refuse, y compris les archives
     * et les fichiers executables.
     */
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp");

    private final ProviderDocumentRepository repository;
    private final UserRepository userRepository;
    private final PhotoStorageService storageService;
    private final TenantContext tenantContext;

    public ProviderDocumentService(ProviderDocumentRepository repository,
                                   UserRepository userRepository,
                                   PhotoStorageService storageService,
                                   TenantContext tenantContext) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.storageService = storageService;
        this.tenantContext = tenantContext;
    }

    /** Justificatifs de l'utilisateur connecte. */
    @Transactional(readOnly = true)
    public List<ProviderDocument> listMine(String keycloakId) {
        return repository.findByUserIdOrderByCreatedAtDesc(requireUser(keycloakId).getId());
    }

    /**
     * Depot d'une piece.
     *
     * <p>Les depots successifs d'un meme type sont CONSERVES : une attestation
     * renouvelee ne remplace pas la precedente, elle s'y ajoute. L'historique
     * fait partie de la preuve — savoir qu'une vigilance couvrait bien la
     * periode d'une mission passee suppose de l'avoir gardee.</p>
     */
    @Transactional
    public ProviderDocument upload(String keycloakId, ProviderDocument.DocumentType type,
                                   MultipartFile file, LocalDate expiresAt) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier vide");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("Fichier trop volumineux (10 Mo maximum)");
        }
        final String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("Format non accepte : PDF, JPEG, PNG, HEIC ou WEBP");
        }

        User user = requireUser(keycloakId);
        String storageKey = storageService.store(file.getBytes(), contentType, file.getOriginalFilename());

        ProviderDocument document = new ProviderDocument();
        document.setUserId(user.getId());
        document.setOrganizationId(tenantContext.getOrganizationId());
        document.setDocumentType(type);
        document.setStorageKey(storageKey);
        document.setFileName(sanitizeFileName(file.getOriginalFilename()));
        document.setContentType(contentType);
        document.setFileSize(file.getSize());
        document.setExpiresAt(expiresAt);
        return repository.save(document);
    }

    /** Binaire d'une piece — reserve a son proprietaire. */
    @Transactional(readOnly = true)
    public DownloadPayload download(String keycloakId, Long documentId) {
        ProviderDocument document = requireOwned(keycloakId, documentId);
        return new DownloadPayload(
                storageService.retrieve(document.getStorageKey()),
                document.getContentType(),
                document.getFileName());
    }

    /**
     * Retrait d'une piece par son deposant.
     *
     * <p>Une piece DEJA VALIDEE ne se supprime pas : elle atteste d'une
     * conformite a un instant donne, et l'effacer reecrirait l'historique. Le
     * renouvellement passe par un nouveau depot.</p>
     */
    @Transactional
    public void delete(String keycloakId, Long documentId) {
        ProviderDocument document = requireOwned(keycloakId, documentId);
        if (document.getStatus() == ProviderDocument.Status.APPROVED) {
            throw new IllegalStateException(
                    "Une piece validee ne peut pas etre supprimee — deposez une nouvelle version.");
        }
        storageService.delete(document.getStorageKey());
        repository.delete(document);
    }

    /**
     * Le dossier est-il complet : une piece VALIDE et non perimee pour chacun
     * des trois justificatifs obligatoires. C'est ce que lit l'onboarding.
     */
    @Transactional(readOnly = true)
    public boolean hasCompleteFile(Long userId) {
        List<ProviderDocument> documents = repository.findByUserIdOrderByCreatedAtDesc(userId);
        return REQUIRED_TYPES.stream().allMatch(type -> documents.stream()
                .anyMatch(doc -> doc.getDocumentType() == type && doc.isCurrentlyValid()));
    }

    /** Pieces sans lesquelles un intervenant ne peut pas travailler legalement. */
    public static final List<ProviderDocument.DocumentType> REQUIRED_TYPES = List.of(
            ProviderDocument.DocumentType.COMPANY_REGISTRATION,
            ProviderDocument.DocumentType.URSSAF_VIGILANCE,
            ProviderDocument.DocumentType.LIABILITY_INSURANCE);

    public record DownloadPayload(byte[] data, String contentType, String fileName) {}

    /**
     * Charge la piece ET verifie qu'elle appartient bien au demandeur.
     * {@code findById} contourne le filtre Hibernate : sans ce controle, un
     * identifiant devine donnerait acces au justificatif d'un tiers.
     */
    private ProviderDocument requireOwned(String keycloakId, Long documentId) {
        ProviderDocument document = repository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Justificatif introuvable"));
        User user = requireUser(keycloakId);
        if (!user.getId().equals(document.getUserId())) {
            throw new AccessDeniedException("Ce justificatif ne vous appartient pas");
        }
        return document;
    }

    private User requireUser(String keycloakId) {
        return userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur non trouve"));
    }

    /** Nom de fichier reduit a son libelle : pas de chemin, pas de traversee. */
    private String sanitizeFileName(String original) {
        if (original == null || original.isBlank()) return "justificatif";
        String name = original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1);
        return name.length() > 255 ? name.substring(0, 255) : name;
    }
}
