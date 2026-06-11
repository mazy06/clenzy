package com.clenzy.service.signature;

import com.clenzy.dto.ContractSignaturePublicDto;
import com.clenzy.model.ContractSignatureRequest;
import com.clenzy.model.DocumentGeneration;
import com.clenzy.model.DocumentGenerationStatus;
import com.clenzy.model.DocumentType;
import com.clenzy.model.ManagementContract;
import com.clenzy.model.ManagementContract.ContractStatus;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.ReferenceType;
import com.clenzy.model.User;
import com.clenzy.repository.ContractSignatureRequestRepository;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.repository.ManagementContractRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.DocumentGeneratorService;
import com.clenzy.service.DocumentStorageService;
import com.clenzy.service.EmailService;
import com.clenzy.service.NotificationService;
import com.clenzy.util.PiiMasker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Orchestrateur de la signature électronique du contrat de gestion (SES).
 *
 * <p>Création du lien : la demande est créée par le provider actif du registre
 * (workflow interne CLENZY_CUSTOM par défaut ; un QTSP câblé fournirait son URL
 * de signature) puis le lien est envoyé par email au propriétaire.</p>
 *
 * <p>Signature (endpoint public, dérivé du token) : enregistre le dossier de preuve
 * (IP, user-agent, horodatage, SHA-256 du PDF présenté, nom saisi, consentement),
 * appose la page certificat sur le PDF (iText), puis active le contrat — la preuve
 * est TOUJOURS enregistrée d'abord : un conflit d'activation ne la remet pas en cause.</p>
 */
@Service
@Transactional(readOnly = true)
public class ContractSignatureService {

    private static final Logger log = LoggerFactory.getLogger(ContractSignatureService.class);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /** Bornes des colonnes de preuve (signer_ip VARCHAR(64), signer_user_agent VARCHAR(512)). */
    private static final int SIGNER_IP_MAX_LENGTH = 64;
    private static final int SIGNER_USER_AGENT_MAX_LENGTH = 512;

    /**
     * Texte de consentement (source de vérité). Affiché sur la page publique et
     * archivé dans le dossier de preuve au moment de la signature.
     */
    public static final String CONSENT_TEXT =
            "En cochant cette case et en cliquant sur « Signer le contrat », je reconnais avoir pris "
            + "connaissance du mandat de gestion et de ses conditions, et je consens à le signer "
            + "électroniquement. Cette signature électronique simple (règlement (UE) n°910/2014, eIDAS) "
            + "m'engage au même titre qu'une signature manuscrite.";

    private final ContractSignatureRequestRepository signatureRequestRepository;
    private final ManagementContractRepository contractRepository;
    private final DocumentGenerationRepository generationRepository;
    private final DocumentGeneratorService documentGeneratorService;
    private final DocumentStorageService documentStorageService;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final SignatureProviderRegistry providerRegistry;
    private final SignatureCertificateStamper certificateStamper;
    private final NotificationService notificationService;

    public ContractSignatureService(ContractSignatureRequestRepository signatureRequestRepository,
                                     ManagementContractRepository contractRepository,
                                     DocumentGenerationRepository generationRepository,
                                     @Lazy DocumentGeneratorService documentGeneratorService,
                                     DocumentStorageService documentStorageService,
                                     PropertyRepository propertyRepository,
                                     UserRepository userRepository,
                                     EmailService emailService,
                                     SignatureProviderRegistry providerRegistry,
                                     SignatureCertificateStamper certificateStamper,
                                     NotificationService notificationService) {
        this.signatureRequestRepository = signatureRequestRepository;
        this.contractRepository = contractRepository;
        this.generationRepository = generationRepository;
        this.documentGeneratorService = documentGeneratorService;
        this.documentStorageService = documentStorageService;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.providerRegistry = providerRegistry;
        this.certificateStamper = certificateStamper;
        this.notificationService = notificationService;
    }

    // ─── Création / renvoi du lien de signature ──────────────────────────────

    /**
     * Crée (ou réutilise) la demande de signature du contrat et envoie le lien au
     * propriétaire. Sans email, aucun lien n'est envoyé (l'activation manuelle reste
     * possible côté PMS). Best-effort : les erreurs sont remontées à l'appelant qui
     * décide (création de contrat = try/catch, resend = propagation).
     */
    @Transactional
    public Optional<String> requestSignature(ManagementContract contract, String ownerEmail) {
        if (ownerEmail == null || ownerEmail.isBlank()) {
            log.warn("Contrat {} : propriétaire sans email, pas de lien de signature envoyé",
                    contract.getContractNumber());
            return Optional.empty();
        }

        DocumentGeneration generation = resolveLatestMandate(contract.getId()).orElse(null);
        if (generation == null) {
            var generated = documentGeneratorService.generateFromEvent(
                    DocumentType.MANDAT_GESTION, contract.getId(),
                    ReferenceType.MANAGEMENT_CONTRACT, null, contract.getOrganizationId());
            if (generated != null && generated.id() != null) {
                generation = generationRepository.findById(generated.id()).orElse(null);
            }
        }
        if (generation == null) {
            log.warn("Contrat {} : aucun mandat générable (template MANDAT_GESTION absent ?), "
                    + "pas de lien de signature envoyé", contract.getContractNumber());
            return Optional.empty();
        }

        String ownerName = resolveOwnerName(contract.getOwnerId());
        SignatureRequest providerRequest = new SignatureRequest(
                generation.getId(),
                "Mandat de gestion " + contract.getContractNumber(),
                List.of(new Signer(ownerEmail, ownerName, "owner", 1)),
                null,
                contract.getOrganizationId());

        SignatureResult result = resolveProvider().createSignatureRequest(providerRequest);
        if (!result.success()) {
            throw new IllegalStateException("Création de la demande de signature échouée : " + result.errorMessage());
        }

        LocalDateTime expiresAt = signatureRequestRepository
                .findFirstByContractIdAndStatus(contract.getId(), ContractSignatureRequest.Status.PENDING)
                .map(ContractSignatureRequest::getExpiresAt)
                .orElse(null);

        emailService.sendContractSignatureEmail(
                ownerEmail,
                ownerName,
                resolvePropertyName(contract.getPropertyId()),
                contract.getContractNumber(),
                formatRate(contract),
                contract.getStartDate() != null ? contract.getStartDate().format(DATE_FMT) : "",
                result.signingUrl(),
                expiresAt);

        // RGPD : jamais d'email en clair dans les logs (centralisés Loki/ELK).
        log.info("Lien de signature envoyé à {} pour le contrat {}",
                PiiMasker.maskEmail(ownerEmail), contract.getContractNumber());
        return Optional.of(result.signingUrl());
    }

    /** Renvoie le lien de signature (réutilise la demande PENDING valide, sinon en recrée une). */
    @Transactional
    public void resend(Long contractId, Long orgId) {
        ManagementContract contract = contractRepository.findByIdAndOrgId(contractId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Contract not found: " + contractId));
        if (contract.getStatus() != ContractStatus.DRAFT) {
            throw new IllegalStateException("Le lien de signature ne concerne que les contrats en brouillon");
        }
        String ownerEmail = userRepository.findById(contract.getOwnerId())
                .map(User::getEmail)
                .filter(e -> e != null && !e.isBlank())
                .orElseThrow(() -> new IllegalStateException("Le propriétaire n'a pas d'adresse email"));
        requestSignature(contract, ownerEmail);
    }

    /**
     * Annule la demande PENDING d'un contrat (modification d'un DRAFT : les termes
     * changent, le lien envoyé ne doit plus permettre de signer l'ancien PDF).
     */
    @Transactional
    public void cancelPending(Long contractId) {
        signatureRequestRepository
                .findFirstByContractIdAndStatus(contractId, ContractSignatureRequest.Status.PENDING)
                .ifPresent(request -> {
                    request.setStatus(ContractSignatureRequest.Status.CANCELLED);
                    signatureRequestRepository.save(request);
                    log.info("Demande de signature annulée pour le contrat {} (termes modifiés)", contractId);
                });
    }

    /** Statut de signature par contrat (enrichissement batch des DTOs). */
    public Map<Long, String> signatureStatusByContractIds(Collection<Long> contractIds) {
        if (contractIds.isEmpty()) return Map.of();
        Map<Long, String> statuses = new HashMap<>();
        for (ContractSignatureRequest request : signatureRequestRepository.findByContractIdIn(contractIds)) {
            String status = request.isExpired() ? "EXPIRED" : request.getStatus().name();
            // SIGNED prime sur tout ; sinon la demande la plus récente (id croissant) gagne.
            String current = statuses.get(request.getContractId());
            if (!"SIGNED".equals(current)) {
                statuses.put(request.getContractId(), status);
            }
        }
        return statuses;
    }

    // ─── Consultation publique (dérivée du token) ────────────────────────────

    public ContractSignaturePublicDto getPublicView(UUID token) {
        ContractSignatureRequest request = requireByToken(token);
        ManagementContract contract = contractRepository.findById(request.getContractId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        return new ContractSignaturePublicDto(
                publicStatus(request, contract),
                contract.getContractNumber(),
                contract.getContractType() != null ? contract.getContractType().name() : null,
                resolvePropertyName(contract.getPropertyId()),
                resolveOwnerName(contract.getOwnerId()),
                contract.getCommissionRate() != null ? contract.getCommissionRate().doubleValue() : null,
                contract.getStartDate() != null ? contract.getStartDate().format(DATE_FMT) : null,
                contract.getEndDate() != null ? contract.getEndDate().format(DATE_FMT) : null,
                contract.getPaymentModel() != null ? contract.getPaymentModel().name() : null,
                resolveDocumentBytes(request).isPresent(),
                request.getSignedAt() != null ? request.getSignedAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH:mm")) : null,
                request.getSignedByName(),
                request.getExpiresAt() != null ? request.getExpiresAt().format(DATE_FMT) : null,
                CONSENT_TEXT
        );
    }

    /** PDF du mandat : version tamponnée après signature, sinon l'original épinglé. */
    public DocumentPayload getDocument(UUID token) {
        ContractSignatureRequest request = requireByToken(token);
        if (request.getStatus() == ContractSignatureRequest.Status.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.GONE, "Lien de signature annulé");
        }
        if (request.isExpired()) {
            throw new ResponseStatusException(HttpStatus.GONE, "Lien de signature expiré");
        }
        byte[] bytes = resolveDocumentBytes(request)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document indisponible"));
        String suffix = request.getStatus() == ContractSignatureRequest.Status.SIGNED ? "_signe" : "";
        return new DocumentPayload(bytes, "Mandat_gestion" + suffix + ".pdf");
    }

    public record DocumentPayload(byte[] bytes, String fileName) {}

    /**
     * Mandat d'un contrat pour l'écran PMS (authentifié, org-scopé) : la version
     * SIGNÉE (PDF + page certificat) si elle existe, sinon la dernière génération.
     * 404 si aucun document n'existe encore (l'appelant peut alors générer à la volée).
     */
    public DocumentPayload getMandateForContract(Long contractId, Long orgId) {
        ManagementContract contract = contractRepository.findByIdAndOrgId(contractId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Contract not found: " + contractId));

        Optional<ContractSignatureRequest> signed = signatureRequestRepository
                .findFirstByContractIdAndStatus(contractId, ContractSignatureRequest.Status.SIGNED)
                .filter(r -> r.getSignedDocumentPath() != null && !r.getSignedDocumentPath().isBlank());
        if (signed.isPresent()) {
            return new DocumentPayload(
                    documentStorageService.loadAsBytes(signed.get().getSignedDocumentPath()),
                    "Mandat_signe_" + contract.getContractNumber() + ".pdf");
        }

        byte[] bytes = resolveLatestMandate(contractId)
                .map(DocumentGeneration::getFilePath)
                .filter(path -> path != null && !path.isBlank())
                .map(documentStorageService::loadAsBytes)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Aucun mandat généré"));
        return new DocumentPayload(bytes, "Mandat_" + contract.getContractNumber() + ".pdf");
    }

    // ─── Signature ────────────────────────────────────────────────────────────

    /**
     * Signe le contrat : preuve d'abord (jamais perdue), activation ensuite.
     * Transition PENDING → SIGNED atomique (anti double-clic / concurrence).
     */
    @Transactional
    public ContractSignaturePublicDto sign(UUID token, String signerName, boolean consentAccepted,
                                            String signerIp, String signerUserAgent) {
        if (!consentAccepted) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le consentement est requis");
        }
        if (signerName == null || signerName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom du signataire est requis");
        }

        ContractSignatureRequest request = requireByToken(token);
        if (request.getStatus() == ContractSignatureRequest.Status.SIGNED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Contrat déjà signé");
        }
        if (request.getStatus() == ContractSignatureRequest.Status.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.GONE, "Lien de signature annulé");
        }
        if (request.isExpired()) {
            throw new ResponseStatusException(HttpStatus.GONE, "Lien de signature expiré");
        }

        ManagementContract contract = contractRepository.findById(request.getContractId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (contract.getStatus() != ContractStatus.DRAFT) {
            // Activé manuellement ou résilié entre-temps : le lien ne vaut plus.
            request.setStatus(ContractSignatureRequest.Status.CANCELLED);
            signatureRequestRepository.save(request);
            throw new ResponseStatusException(HttpStatus.GONE, "Le contrat n'est plus signable");
        }

        // Garde atomique : exactement une requête concurrente obtient la transition.
        if (signatureRequestRepository.markSigned(request.getId()) != 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Contrat déjà signé");
        }

        // ── 1. Dossier de preuve (toujours enregistré, quoi qu'il arrive ensuite) ──
        // Éléments calculés CÔTÉ SERVEUR : horodatage (jamais fourni par le client) et
        // SHA-256 du PDF réellement présenté au signataire (résolu depuis le stockage).
        // L'IP est résolue derrière trusted-proxy par le contrôleur (TrustedClientIpResolver) ;
        // le user-agent reste déclaratif (en-tête client) et est borné à sa colonne.
        byte[] originalPdf = resolveDocumentBytes(request).orElse(null);
        LocalDateTime signedAt = LocalDateTime.now();
        request.setStatus(ContractSignatureRequest.Status.SIGNED);
        request.setSignedAt(signedAt);
        request.setSignedByName(signerName.trim());
        request.setSignerIp(truncate(signerIp, SIGNER_IP_MAX_LENGTH));
        request.setSignerUserAgent(truncate(signerUserAgent, SIGNER_USER_AGENT_MAX_LENGTH));
        request.setDocumentSha256(originalPdf != null ? sha256Hex(originalPdf) : null);
        request.setConsentText(CONSENT_TEXT);
        signatureRequestRepository.save(request);

        contract.setSignedAt(Instant.now());

        // ── 2. Activation (mêmes gardes que activateContract — dupliquées ici pour
        //       éviter un cycle ManagementContractService ↔ ContractSignatureService) ──
        boolean activated = false;
        Optional<ManagementContract> conflicting = contractRepository
                .findActiveByPropertyId(contract.getPropertyId(), request.getOrganizationId())
                .filter(other -> !other.getId().equals(contract.getId()));
        if (conflicting.isEmpty()) {
            contract.setStatus(ContractStatus.ACTIVE);
            activated = true;
        }
        contractRepository.save(contract);

        // ── 3. PDF tamponné (best-effort : la preuve en base fait foi) ──
        if (originalPdf != null) {
            try {
                // Le certificat reprend les valeurs PERSISTÉES du dossier de preuve
                // (mêmes bornes) : le PDF et la base racontent la même histoire.
                byte[] stamped = certificateStamper.appendCertificate(originalPdf,
                        new SignatureCertificateStamper.CertificateData(
                                contract.getContractNumber(), request.getSignedByName(),
                                request.getSignerEmail(), signedAt, request.getSignerIp(),
                                request.getSignerUserAgent(),
                                request.getDocumentSha256(), request.getToken().toString(), CONSENT_TEXT));
                String path = documentStorageService.store("MANDAT_GESTION_SIGNE",
                        "Mandat_signe_" + contract.getContractNumber() + ".pdf", stamped);
                request.setSignedDocumentPath(path);
                signatureRequestRepository.save(request);
            } catch (Exception e) {
                log.warn("Tamponnage du mandat signé {} échoué : {}", contract.getContractNumber(), e.getMessage());
            }
        }

        // ── 4. Notification interne (best-effort) ──
        try {
            String propertyName = resolvePropertyName(contract.getPropertyId());
            notificationService.notifyAdminsAndManagersByOrgId(
                    request.getOrganizationId(),
                    NotificationKey.CONTRACT_SIGNED,
                    "Mandat signé — " + propertyName,
                    activated
                            ? signerName + " a signé le mandat " + contract.getContractNumber() + ". Le contrat est actif."
                            : signerName + " a signé le mandat " + contract.getContractNumber()
                                    + " — activation manuelle requise : un autre contrat est déjà actif sur ce logement.",
                    "/contracts");
        } catch (Exception e) {
            log.warn("Notification CONTRACT_SIGNED échouée : {}", e.getMessage());
        }

        // RGPD : initiales seulement — le nom complet est dans le dossier de preuve (demande {}).
        log.info("Contrat {} signé (demande {}, signataire {}, activé: {})",
                contract.getContractNumber(), request.getId(), PiiMasker.maskName(signerName), activated);
        return getPublicView(token);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private ContractSignatureRequest requireByToken(UUID token) {
        return signatureRequestRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private String publicStatus(ContractSignatureRequest request, ManagementContract contract) {
        if (request.getStatus() == ContractSignatureRequest.Status.SIGNED) return "SIGNED";
        if (request.getStatus() == ContractSignatureRequest.Status.CANCELLED) return "CANCELLED";
        if (request.isExpired()) return "EXPIRED";
        // PENDING mais contrat plus signable (activation manuelle, résiliation…)
        if (contract.getStatus() != ContractStatus.DRAFT) return "CANCELLED";
        return "PENDING";
    }

    /**
     * Bytes du PDF présenté au signataire : version tamponnée si signée, sinon la
     * génération épinglée, sinon la dernière génération COMPLETED/SENT du contrat.
     * Pas de génération à la volée côté public (DoS/spam de rows FAILED) : le
     * renvoi authentifié du lien régénère si besoin.
     */
    private Optional<byte[]> resolveDocumentBytes(ContractSignatureRequest request) {
        try {
            if (request.getStatus() == ContractSignatureRequest.Status.SIGNED
                    && request.getSignedDocumentPath() != null) {
                return Optional.of(documentStorageService.loadAsBytes(request.getSignedDocumentPath()));
            }
            Optional<DocumentGeneration> generation = Optional.ofNullable(request.getDocumentGenerationId())
                    .flatMap(generationRepository::findById)
                    .filter(this::isServable)
                    .or(() -> resolveLatestMandate(request.getContractId()));
            return generation
                    .map(DocumentGeneration::getFilePath)
                    .filter(path -> path != null && !path.isBlank())
                    .map(documentStorageService::loadAsBytes);
        } catch (Exception e) {
            log.warn("Chargement du mandat pour la demande {} échoué : {}", request.getId(), e.getMessage());
            return Optional.empty();
        }
    }

    private Optional<DocumentGeneration> resolveLatestMandate(Long contractId) {
        return generationRepository
                .findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(ReferenceType.MANAGEMENT_CONTRACT, contractId)
                .stream()
                .filter(g -> g.getDocumentType() == DocumentType.MANDAT_GESTION)
                .filter(this::isServable)
                .findFirst();
    }

    /** Un mandat envoyé par email passe en SENT : COMPLETED seul ne suffit pas. */
    private boolean isServable(DocumentGeneration generation) {
        return generation.getStatus() == DocumentGenerationStatus.COMPLETED
                || generation.getStatus() == DocumentGenerationStatus.SENT;
    }

    private SignatureProvider resolveProvider() {
        try {
            return providerRegistry.getActiveProvider();
        } catch (IllegalStateException e) {
            // Provider configuré indisponible (QTSP pas encore câblé…) : repli interne.
            log.warn("Provider de signature actif indisponible ({}), repli sur CLENZY_CUSTOM", e.getMessage());
            return providerRegistry.getProvider(SignatureProviderType.CLENZY_CUSTOM)
                    .orElseThrow(() -> new IllegalStateException("Provider interne CLENZY_CUSTOM non enregistré"));
        }
    }

    private String resolvePropertyName(Long propertyId) {
        if (propertyId == null) return "";
        return propertyRepository.findById(propertyId)
                .map(p -> p.getName() != null ? p.getName() : "")
                .orElse("");
    }

    private String resolveOwnerName(Long ownerId) {
        if (ownerId == null) return "";
        return userRepository.findById(ownerId)
                .map(User::getFullName)
                .orElse("");
    }

    private String formatRate(ManagementContract contract) {
        if (contract.getCommissionRate() == null) return "—";
        return Math.round(contract.getCommissionRate().doubleValue() * 100) + " %";
    }

    private static String sha256Hex(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception e) {
            return null; // SHA-256 toujours présent sur une JVM standard
        }
    }

    /**
     * Borne une valeur d'en-tête client à la taille de sa colonne de preuve : un
     * en-tête surdimensionné ne doit pas faire échouer la persistance du dossier
     * de preuve (et rollback la transition SIGNED) après {@code markSigned}.
     */
    private static String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
