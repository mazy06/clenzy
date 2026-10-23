package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.pennylane.config.PennylaneConfig;
import com.clenzy.service.signature.SignatureRequest;
import com.clenzy.service.signature.SignatureResult;
import com.clenzy.service.signature.SignatureStatus;
import com.clenzy.service.signature.Signer;
import com.clenzy.service.signature.BaitlySignatureSafety;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service d'appel a l'API Pennylane pour la signature electronique.
 * Circuit breaker protege contre les cascades d'erreurs.
 */
@Service
@ConditionalOnProperty(name = "clenzy.pennylane.client-id")
public class PennylaneApiService {

    private static final Logger log = LoggerFactory.getLogger(PennylaneApiService.class);

    private final PennylaneConfig config;
    private final RestTemplate restTemplate;

    public PennylaneApiService(PennylaneConfig config) {
        this.config = config;
        this.restTemplate = new RestTemplate();
    }

    /**
     * Cree une demande de signature aupres de Pennylane.
     *
     * @param request details de la demande de signature
     * @return resultat contenant l'identifiant et l'URL de signature
     */
    @CircuitBreaker(name = "pennylane-api", fallbackMethod = "createSignatureRequestFallback")
    public SignatureResult createSignatureRequest(SignatureRequest request) {
        log.info("Pennylane : création de demande de signature");

        Map<String, Object> body = new HashMap<>();
        body.put("document_id", request.documentId());
        body.put("document_name", request.documentName());
        body.put("callback_url", request.callbackUrl());

        List<Map<String, Object>> signersList = request.signers().stream()
            .map(this::mapSigner)
            .toList();
        body.put("signers", signersList);

        ResponseEntity<Map> response = restTemplate.exchange(
            config.getApiUrl() + "/api/v1/signature_requests",
            HttpMethod.POST,
            new HttpEntity<>(body, buildHeaders()),
            Map.class
        );

        @SuppressWarnings("unchecked")
        Map<String, Object> responseBody = response.getBody();
        if (responseBody == null) throw BaitlySignatureSafety.invalidResponse();
        String requestId = BaitlySignatureSafety.remoteId(responseBody.get("id"));
        String signingUrl = BaitlySignatureSafety.signingUrl(responseBody.get("signing_url"));

        log.info("Pennylane : demande de signature créée");
        return SignatureResult.success(requestId, signingUrl);
    }

    /**
     * Recupere le statut d'une demande de signature Pennylane.
     *
     * @param signatureRequestId identifiant de la demande
     * @return statut courant
     */
    @CircuitBreaker(name = "pennylane-api", fallbackMethod = "getSignatureStatusFallback")
    public SignatureStatus getSignatureStatus(String signatureRequestId) {
        signatureRequestId = BaitlySignatureSafety.remoteId(signatureRequestId);
        log.debug("Pennylane : lecture du statut de signature");

        ResponseEntity<Map> response = restTemplate.exchange(
            config.getApiUrl() + "/api/v1/signature_requests/" + signatureRequestId,
            HttpMethod.GET,
            new HttpEntity<>(buildHeaders()),
            Map.class
        );

        if (response.getBody() == null || !(response.getBody().get("status") instanceof String)) throw BaitlySignatureSafety.unknownStatus();
        String status = (String) response.getBody().get("status");
        return mapStatus(status);
    }

    /**
     * Telecharge le document signe depuis Pennylane.
     *
     * @param signatureRequestId identifiant de la demande
     * @return contenu binaire du document signe
     */
    @CircuitBreaker(name = "pennylane-api", fallbackMethod = "downloadDocumentFallback")
    public byte[] downloadDocument(String signatureRequestId) {
        signatureRequestId = BaitlySignatureSafety.remoteId(signatureRequestId);
        log.info("Pennylane : téléchargement de document signé");

        ResponseEntity<byte[]> response = restTemplate.exchange(
            config.getApiUrl() + "/api/v1/signature_requests/" + signatureRequestId + "/document",
            HttpMethod.GET,
            new HttpEntity<>(buildHeaders()),
            byte[].class
        );

        if (response.getBody() == null || response.getBody().length == 0) throw BaitlySignatureSafety.invalidResponse();
        return response.getBody();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private Map<String, Object> mapSigner(Signer signer) {
        Map<String, Object> map = new HashMap<>();
        map.put("email", signer.email());
        map.put("name", signer.name());
        map.put("role", signer.role());
        map.put("order", signer.order());
        return map;
    }

    private SignatureStatus mapStatus(String pennylaneStatus) {
        if (pennylaneStatus == null) {
            throw BaitlySignatureSafety.unknownStatus();
        }
        return switch (pennylaneStatus.toLowerCase(java.util.Locale.ROOT)) {
            case "pending" -> SignatureStatus.PENDING;
            case "sent" -> SignatureStatus.SENT;
            case "viewed" -> SignatureStatus.VIEWED;
            case "signed", "completed" -> SignatureStatus.SIGNED;
            case "declined", "refused" -> SignatureStatus.DECLINED;
            case "expired" -> SignatureStatus.EXPIRED;
            case "cancelled" -> SignatureStatus.CANCELLED;
            default -> {
                throw BaitlySignatureSafety.unknownStatus();
            }
        };
    }

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(config.getClientSecret());
        return headers;
    }

    // ─── Fallback methods ─────────────────────────────────────────────────────

    @SuppressWarnings("unused")
    private SignatureResult createSignatureRequestFallback(SignatureRequest request, Throwable t) {
        log.error("Pennylane : création de signature non confirmée");
        return SignatureResult.failure(BaitlySignatureSafety.CREATION_UNCONFIRMED);
    }

    @SuppressWarnings("unused")
    private SignatureStatus getSignatureStatusFallback(String signatureRequestId, Throwable t) {
        log.error("Pennylane : statut de signature indisponible");
        throw BaitlySignatureSafety.unavailable();
    }

    @SuppressWarnings("unused")
    private byte[] downloadDocumentFallback(String signatureRequestId, Throwable t) {
        log.error("Pennylane : document signé indisponible");
        throw BaitlySignatureSafety.unavailable();
    }
}
