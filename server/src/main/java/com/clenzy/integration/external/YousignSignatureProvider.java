package com.clenzy.integration.external;

import com.clenzy.integration.external.model.ExternalServiceConnection;
import com.clenzy.integration.external.service.ExternalServiceConnectionService;
import com.clenzy.model.DocumentGeneration;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.service.DocumentStorageService;
import com.clenzy.service.signature.SignatureProvider;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.service.signature.SignatureRequest;
import com.clenzy.service.signature.SignatureResult;
import com.clenzy.service.signature.SignatureStatus;
import com.clenzy.service.signature.Signer;
import com.clenzy.tenant.TenantContext;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Yousign — QTSP français certifié ANSSI (SES + AES + QES). API REST v3,
 * authentification Bearer par clé API stockée <b>par organisation</b> via
 * {@link ExternalServiceConnectionService} (carte « Yousign » de l'onglet
 * Intégrations ; le {@code serverUrl} de la connexion permet de pointer la
 * sandbox {@code https://api-sandbox.yousign.app/v3}).
 *
 * <h2>Implémenté mais NON branché</h2>
 * Le provider est opérationnel côté code : {@link #isAvailable()} ne devient
 * vrai que lorsqu'une connexion Yousign ACTIVE existe pour l'organisation
 * courante, et il ne devient le provider de signature effectif que via
 * {@code SIGNATURE_PROVIDER=yousign} (défaut : workflow interne CLENZY_CUSTOM).
 *
 * <h2>Flux de création (API v3)</h2>
 * <ol>
 *   <li>POST /signature_requests (delivery_mode=none — l'email part de Clenzy)</li>
 *   <li>POST /signature_requests/{id}/documents (multipart, nature=signable_document)</li>
 *   <li>POST /signature_requests/{id}/signers (niveau electronic_signature + champ signature en dernière page)</li>
 *   <li>POST /signature_requests/{id}/activate → {@code signers[0].signature_link}</li>
 * </ol>
 */
@Service
public class YousignSignatureProvider implements SignatureProvider {

    private static final Logger log = LoggerFactory.getLogger(YousignSignatureProvider.class);

    private final ExternalServiceConnectionService connectionService;
    private final TenantContext tenantContext;
    private final DocumentGenerationRepository generationRepository;
    private final DocumentStorageService documentStorageService;
    private final RestTemplate restTemplate;
    private final String defaultApiBaseUrl;

    public YousignSignatureProvider(ExternalServiceConnectionService connectionService,
                                     TenantContext tenantContext,
                                     DocumentGenerationRepository generationRepository,
                                     DocumentStorageService documentStorageService,
                                     RestTemplate restTemplate,
                                     @Value("${clenzy.signature.yousign.api-base-url:https://api.yousign.app/v3}")
                                     String defaultApiBaseUrl) {
        this.connectionService = connectionService;
        this.tenantContext = tenantContext;
        this.generationRepository = generationRepository;
        this.documentStorageService = documentStorageService;
        this.restTemplate = restTemplate;
        this.defaultApiBaseUrl = defaultApiBaseUrl;
    }

    @Override
    public SignatureProviderType getType() {
        return SignatureProviderType.YOUSIGN;
    }

    @Override
    @SuppressWarnings("unchecked")
    public SignatureResult createSignatureRequest(SignatureRequest request) {
        if (request.signers() == null || request.signers().isEmpty()) {
            return SignatureResult.failure("Aucun signataire fourni");
        }
        Optional<ExternalServiceConnection> connection = resolveConnection(request.orgId());
        if (connection.isEmpty()) {
            return SignatureResult.failure(
                    "Aucune connexion Yousign active pour l'organisation " + request.orgId());
        }

        byte[] pdf = loadDocumentBytes(request.documentId());
        if (pdf == null) {
            return SignatureResult.failure("Document introuvable: " + request.documentId());
        }

        String baseUrl = apiBaseUrl(connection.get());
        String apiKey = connectionService.decryptApiKey(connection.get());
        Signer signer = request.signers().get(0);

        try {
            // 1. Demande de signature (draft). delivery_mode=none : c'est Clenzy qui
            //    envoie le lien par email (flux uniforme avec le provider interne).
            Map<String, Object> created = postJson(baseUrl + "/signature_requests", apiKey, Map.of(
                    "name", request.documentName() != null ? request.documentName() : "Document Clenzy",
                    "delivery_mode", "none",
                    "timezone", "Europe/Paris"));
            String requestId = (String) created.get("id");

            // 2. Upload du PDF
            Map<String, Object> document = postMultipartPdf(
                    baseUrl + "/signature_requests/" + requestId + "/documents", apiKey, pdf);
            String documentId = (String) document.get("id");

            // 3. Signataire + champ de signature en dernière page
            postJson(baseUrl + "/signature_requests/" + requestId + "/signers", apiKey, Map.of(
                    "info", signerInfo(signer),
                    "signature_level", "electronic_signature",
                    "signature_authentication_mode", "no_otp",
                    "fields", List.of(Map.of(
                            "document_id", documentId,
                            "type", "signature",
                            "page", lastPageNumber(pdf),
                            "x", 77,
                            "y", 660))));

            // 4. Activation → liens de signature
            Map<String, Object> activated = postJson(
                    baseUrl + "/signature_requests/" + requestId + "/activate", apiKey, Map.of());
            String signingUrl = extractSignatureLink(activated);
            if (signingUrl == null) {
                return SignatureResult.failure("Yousign n'a pas retourné de lien de signature");
            }

            log.info("Demande Yousign créée — requestId={}, org={}", requestId, request.orgId());
            return SignatureResult.success(requestId, signingUrl);
        } catch (Exception e) {
            log.error("Création de la demande Yousign échouée : {}", e.getMessage());
            return SignatureResult.failure("Yousign: " + e.getMessage());
        }
    }

    @Override
    public SignatureStatus getStatus(String signatureRequestId) {
        ExternalServiceConnection connection = requireCurrentOrgConnection();
        Map<String, Object> response = getJson(
                apiBaseUrl(connection) + "/signature_requests/" + signatureRequestId,
                connectionService.decryptApiKey(connection));
        return mapStatus((String) response.get("status"));
    }

    @Override
    public byte[] getSignedDocument(String signatureRequestId) {
        ExternalServiceConnection connection = requireCurrentOrgConnection();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(connectionService.decryptApiKey(connection));
        return restTemplate.exchange(
                apiBaseUrl(connection) + "/signature_requests/" + signatureRequestId + "/documents/download",
                org.springframework.http.HttpMethod.GET,
                new HttpEntity<>(headers),
                byte[].class).getBody();
    }

    /** Disponible si une connexion Yousign ACTIVE existe pour l'organisation courante. */
    @Override
    public boolean isAvailable() {
        Long orgId = tenantContext.getOrganizationId();
        return orgId != null && connectionService.isConnected(orgId, SignatureProviderType.YOUSIGN);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /** Statuts v3 : draft, ongoing, done, expired, canceled, declined, rejected. */
    static SignatureStatus mapStatus(String yousignStatus) {
        if (yousignStatus == null) return SignatureStatus.PENDING;
        return switch (yousignStatus) {
            case "done" -> SignatureStatus.SIGNED;
            case "ongoing", "approval" -> SignatureStatus.SENT;
            case "expired" -> SignatureStatus.EXPIRED;
            case "canceled" -> SignatureStatus.CANCELLED;
            case "declined", "rejected" -> SignatureStatus.DECLINED;
            default -> SignatureStatus.PENDING;
        };
    }

    private Optional<ExternalServiceConnection> resolveConnection(Long orgId) {
        if (orgId == null) return Optional.empty();
        return connectionService.getConnection(orgId, SignatureProviderType.YOUSIGN)
                .filter(c -> c.getStatus() == ExternalServiceConnection.Status.ACTIVE);
    }

    private ExternalServiceConnection requireCurrentOrgConnection() {
        return resolveConnection(tenantContext.getOrganizationId())
                .orElseThrow(() -> new IllegalStateException(
                        "Aucune connexion Yousign active pour l'organisation courante"));
    }

    /** Le serverUrl de la connexion (sandbox/prod) prime sur le défaut config. */
    private String apiBaseUrl(ExternalServiceConnection connection) {
        String serverUrl = connection.getServerUrl();
        String base = serverUrl != null && !serverUrl.isBlank() ? serverUrl : defaultApiBaseUrl;
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private Map<String, String> signerInfo(Signer signer) {
        String name = signer.name() != null && !signer.name().isBlank() ? signer.name().trim() : "Propriétaire";
        int space = name.indexOf(' ');
        String firstName = space > 0 ? name.substring(0, space) : name;
        String lastName = space > 0 ? name.substring(space + 1) : name;
        return Map.of(
                "first_name", firstName,
                "last_name", lastName,
                "email", signer.email(),
                "locale", "fr");
    }

    private byte[] loadDocumentBytes(Long generationId) {
        return generationRepository.findById(generationId)
                .map(DocumentGeneration::getFilePath)
                .filter(path -> path != null && !path.isBlank())
                .map(documentStorageService::loadAsBytes)
                .orElse(null);
    }

    private int lastPageNumber(byte[] pdf) {
        try (PdfDocument doc = new PdfDocument(new PdfReader(new ByteArrayInputStream(pdf)))) {
            return doc.getNumberOfPages();
        } catch (Exception e) {
            return 1;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> postJson(String url, String apiKey, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.postForObject(url, new HttpEntity<>(body, headers), Map.class);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getJson(String url, String apiKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        return restTemplate.exchange(url, org.springframework.http.HttpMethod.GET,
                new HttpEntity<>(headers), Map.class).getBody();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> postMultipartPdf(String url, String apiKey, byte[] pdf) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new ByteArrayResource(pdf) {
            @Override
            public String getFilename() {
                return "document.pdf";
            }
        });
        body.add("nature", "signable_document");
        return restTemplate.postForObject(url, new HttpEntity<>(body, headers), Map.class);
    }

    @SuppressWarnings("unchecked")
    private String extractSignatureLink(Map<String, Object> activated) {
        Object signers = activated.get("signers");
        if (signers instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> first) {
            Object link = ((Map<String, Object>) first).get("signature_link");
            return link != null ? link.toString() : null;
        }
        return null;
    }
}
