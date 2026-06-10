package com.clenzy.service.signature;

import com.clenzy.model.ContractSignatureRequest;
import com.clenzy.model.DocumentGeneration;
import com.clenzy.repository.ContractSignatureRequestRepository;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.service.DocumentStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Workflow de signature interne Clenzy (CLENZY_CUSTOM) — niveau SES (eIDAS art. 25).
 *
 * <p>Pas de tiers : la demande est une row {@code contract_signature_requests} avec
 * un token UUID ; l'URL de signature pointe vers la page publique {@code /sign/{token}}
 * de l'app. La preuve (IP, user-agent, horodatage, SHA-256 du PDF, nom saisi) est
 * enregistrée à la signature par {@code ContractSignatureService}.</p>
 *
 * <p>{@code SignatureRequest.documentId} = id de la {@link DocumentGeneration} du
 * mandat ; le contrat est dérivé de sa référence (MANAGEMENT_CONTRACT).</p>
 */
@Service
public class ClenzyInternalSignatureProvider implements SignatureProvider {

    private static final Logger log = LoggerFactory.getLogger(ClenzyInternalSignatureProvider.class);

    private final ContractSignatureRequestRepository signatureRequestRepository;
    private final DocumentGenerationRepository generationRepository;
    private final DocumentStorageService documentStorageService;
    private final String signingBaseUrl;
    private final int tokenValidityDays;

    public ClenzyInternalSignatureProvider(
            ContractSignatureRequestRepository signatureRequestRepository,
            DocumentGenerationRepository generationRepository,
            DocumentStorageService documentStorageService,
            @Value("${clenzy.signature.signing-base-url:https://app.clenzy.fr/sign}") String signingBaseUrl,
            @Value("${clenzy.signature.token-validity-days:30}") int tokenValidityDays) {
        this.signatureRequestRepository = signatureRequestRepository;
        this.generationRepository = generationRepository;
        this.documentStorageService = documentStorageService;
        this.signingBaseUrl = signingBaseUrl;
        this.tokenValidityDays = tokenValidityDays;
    }

    @Override
    public SignatureProviderType getType() {
        return SignatureProviderType.CLENZY_CUSTOM;
    }

    @Override
    public SignatureResult createSignatureRequest(SignatureRequest request) {
        if (request.signers() == null || request.signers().isEmpty()) {
            return SignatureResult.failure("Aucun signataire fourni");
        }
        DocumentGeneration generation = generationRepository.findById(request.documentId()).orElse(null);
        if (generation == null || generation.getReferenceId() == null) {
            return SignatureResult.failure("Génération de document introuvable: " + request.documentId());
        }

        Long contractId = generation.getReferenceId();
        Signer signer = request.signers().get(0);

        // Réutilise la demande PENDING encore valide (renvoi du même lien) ; sinon
        // annule l'expirée et recrée (index unique partiel : 1 PENDING par contrat).
        ContractSignatureRequest existing = signatureRequestRepository
                .findFirstByContractIdAndStatus(contractId, ContractSignatureRequest.Status.PENDING)
                .orElse(null);
        if (existing != null) {
            if (existing.isCurrentlyValid()) {
                return SignatureResult.success(existing.getToken().toString(), signingUrl(existing.getToken()));
            }
            existing.setStatus(ContractSignatureRequest.Status.CANCELLED);
            signatureRequestRepository.save(existing);
        }

        ContractSignatureRequest created = new ContractSignatureRequest();
        created.setOrganizationId(request.orgId() != null ? request.orgId() : generation.getOrganizationId());
        created.setContractId(contractId);
        created.setDocumentGenerationId(generation.getId());
        created.setToken(UUID.randomUUID());
        created.setSignerEmail(signer.email());
        created.setStatus(ContractSignatureRequest.Status.PENDING);
        created.setExpiresAt(LocalDateTime.now().plusDays(tokenValidityDays));
        created = signatureRequestRepository.save(created);

        log.info("Demande de signature interne creee — contrat {}, token {}", contractId, created.getToken());
        return SignatureResult.success(created.getToken().toString(), signingUrl(created.getToken()));
    }

    @Override
    public SignatureStatus getStatus(String signatureRequestId) {
        return signatureRequestRepository.findByToken(UUID.fromString(signatureRequestId))
                .map(r -> switch (r.getStatus()) {
                    case SIGNED -> SignatureStatus.SIGNED;
                    case CANCELLED -> SignatureStatus.CANCELLED;
                    case PENDING -> r.isExpired() ? SignatureStatus.EXPIRED : SignatureStatus.PENDING;
                })
                .orElse(SignatureStatus.CANCELLED);
    }

    @Override
    public byte[] getSignedDocument(String signatureRequestId) {
        ContractSignatureRequest request = signatureRequestRepository
                .findByToken(UUID.fromString(signatureRequestId))
                .orElseThrow(() -> new IllegalArgumentException("Demande de signature introuvable"));
        String path = request.getSignedDocumentPath();
        if (path == null || path.isBlank()) {
            throw new IllegalStateException("Document signé non disponible (statut: " + request.getStatus() + ")");
        }
        return documentStorageService.loadAsBytes(path);
    }

    @Override
    public boolean isAvailable() {
        return true;
    }

    private String signingUrl(UUID token) {
        return signingBaseUrl.endsWith("/")
                ? signingBaseUrl + token
                : signingBaseUrl + "/" + token;
    }
}
