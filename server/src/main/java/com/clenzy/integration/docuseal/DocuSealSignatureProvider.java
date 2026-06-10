package com.clenzy.integration.docuseal;

import com.clenzy.model.DocumentGeneration;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.service.DocumentStorageService;
import com.clenzy.service.signature.SignatureProvider;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.service.signature.SignatureRequest;
import com.clenzy.service.signature.SignatureResult;
import com.clenzy.service.signature.SignatureStatus;
import com.clenzy.service.signature.Signer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * DocuSeal — alternative open source (AGPL) auto-hébergée à DocuSign : signature
 * SES avec scellement cryptographique PAdES du PDF (« signature valide » dans
 * Adobe). API REST authentifiée par le header {@code X-Auth-Token}.
 *
 * <h2>Implémenté mais NON branché</h2>
 * Le provider est opérationnel côté code mais reste indisponible tant que
 * l'instance n'est pas déployée dans clenzy-infra et configurée
 * ({@code DOCUSEAL_BASE_URL} + {@code DOCUSEAL_API_KEY}). Il ne devient le
 * provider effectif que via {@code SIGNATURE_PROVIDER=docuseal} (défaut :
 * workflow interne CLENZY_CUSTOM).
 *
 * <h2>Flux de création</h2>
 * <ol>
 *   <li>POST /api/templates/pdf (PDF en base64) → template</li>
 *   <li>POST /api/submissions (template_id + signataire, send_email=false —
 *       l'email part de Clenzy) → slug du signataire</li>
 *   <li>URL de signature : {@code {base}/s/{slug}}</li>
 * </ol>
 */
@Service
public class DocuSealSignatureProvider implements SignatureProvider {

    private static final Logger log = LoggerFactory.getLogger(DocuSealSignatureProvider.class);

    private final DocuSealConfig config;
    private final DocumentGenerationRepository generationRepository;
    private final DocumentStorageService documentStorageService;
    private final RestTemplate restTemplate;

    public DocuSealSignatureProvider(DocuSealConfig config,
                                      DocumentGenerationRepository generationRepository,
                                      DocumentStorageService documentStorageService,
                                      RestTemplate restTemplate) {
        this.config = config;
        this.generationRepository = generationRepository;
        this.documentStorageService = documentStorageService;
        this.restTemplate = restTemplate;
    }

    @Override
    public SignatureProviderType getType() {
        return SignatureProviderType.DOCUSEAL;
    }

    @Override
    public SignatureResult createSignatureRequest(SignatureRequest request) {
        if (!config.isConfigured()) {
            return SignatureResult.failure("DocuSeal non configuré (DOCUSEAL_BASE_URL / DOCUSEAL_API_KEY)");
        }
        if (request.signers() == null || request.signers().isEmpty()) {
            return SignatureResult.failure("Aucun signataire fourni");
        }
        byte[] pdf = loadDocumentBytes(request.documentId());
        if (pdf == null) {
            return SignatureResult.failure("Document introuvable: " + request.documentId());
        }

        String base = config.normalizedBaseUrl();
        Signer signer = request.signers().get(0);
        String documentName = request.documentName() != null ? request.documentName() : "Document Clenzy";

        try {
            // 1. Template depuis le PDF
            Map<String, Object> template = postJson(base + "/api/templates/pdf", Map.of(
                    "name", documentName,
                    "documents", List.of(Map.of(
                            "name", documentName,
                            "file", Base64.getEncoder().encodeToString(pdf)))));
            Object templateId = template.get("id");

            // 2. Soumission. send_email=false : c'est Clenzy qui envoie le lien.
            List<Map<String, Object>> submitters = postJsonList(base + "/api/submissions", Map.of(
                    "template_id", templateId,
                    "send_email", false,
                    "submitters", List.of(Map.of(
                            "role", "First Party",
                            "name", signer.name() != null ? signer.name() : "",
                            "email", signer.email()))));
            if (submitters == null || submitters.isEmpty()) {
                return SignatureResult.failure("DocuSeal n'a pas retourné de signataire");
            }

            Map<String, Object> submitter = submitters.get(0);
            String submissionId = String.valueOf(submitter.get("submission_id"));
            String slug = String.valueOf(submitter.get("slug"));

            log.info("Soumission DocuSeal créée — submissionId={}, org={}", submissionId, request.orgId());
            return SignatureResult.success(submissionId, base + "/s/" + slug);
        } catch (Exception e) {
            log.error("Création de la soumission DocuSeal échouée : {}", e.getMessage());
            return SignatureResult.failure("DocuSeal: " + e.getMessage());
        }
    }

    @Override
    public SignatureStatus getStatus(String signatureRequestId) {
        Map<String, Object> submission = getJson(
                config.normalizedBaseUrl() + "/api/submissions/" + signatureRequestId);
        return mapStatus(submission != null ? String.valueOf(submission.get("status")) : null);
    }

    @Override
    @SuppressWarnings("unchecked")
    public byte[] getSignedDocument(String signatureRequestId) {
        Map<String, Object> submission = getJson(
                config.normalizedBaseUrl() + "/api/submissions/" + signatureRequestId);
        Object documents = submission != null ? submission.get("documents") : null;
        if (documents instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> first) {
            Object url = ((Map<String, Object>) first).get("url");
            if (url != null) {
                return restTemplate.exchange(url.toString(), HttpMethod.GET,
                        new HttpEntity<>(authHeaders()), byte[].class).getBody();
            }
        }
        throw new IllegalStateException("Document signé non disponible pour la soumission " + signatureRequestId);
    }

    /** Disponible dès que l'instance self-hosted est configurée (config globale plateforme). */
    @Override
    public boolean isAvailable() {
        return config.isConfigured();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /** Statuts DocuSeal : pending, completed, expired, archived/canceled, declined. */
    static SignatureStatus mapStatus(String docusealStatus) {
        if (docusealStatus == null) return SignatureStatus.PENDING;
        return switch (docusealStatus) {
            case "completed" -> SignatureStatus.SIGNED;
            case "expired" -> SignatureStatus.EXPIRED;
            case "archived", "canceled" -> SignatureStatus.CANCELLED;
            case "declined" -> SignatureStatus.DECLINED;
            default -> SignatureStatus.PENDING;
        };
    }

    private byte[] loadDocumentBytes(Long generationId) {
        return generationRepository.findById(generationId)
                .map(DocumentGeneration::getFilePath)
                .filter(path -> path != null && !path.isBlank())
                .map(documentStorageService::loadAsBytes)
                .orElse(null);
    }

    private HttpHeaders authHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Auth-Token", config.getApiKey());
        return headers;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> postJson(String url, Map<String, Object> body) {
        HttpHeaders headers = authHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.postForObject(url, new HttpEntity<>(body, headers), Map.class);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> postJsonList(String url, Map<String, Object> body) {
        HttpHeaders headers = authHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.postForObject(url, new HttpEntity<>(body, headers), List.class);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getJson(String url) {
        return restTemplate.exchange(url, HttpMethod.GET,
                new HttpEntity<>(authHeaders()), Map.class).getBody();
    }
}
