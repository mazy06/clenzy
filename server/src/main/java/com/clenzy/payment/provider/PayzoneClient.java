package com.clenzy.payment.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Client HTTP pour Payzone Maroc (gateway de paiement marchand).
 *
 * <h2>Specs API</h2>
 * <p>Payzone Maroc propose une API REST JSON moderne (alternative au format
 * legacy CMI). Endpoints :</p>
 * <ul>
 *   <li>Prod : {@code https://api.payzone.ma/v1/payments}</li>
 *   <li>Sandbox : {@code https://sandbox-api.payzone.ma/v1/payments}</li>
 * </ul>
 *
 * <h2>Authentification</h2>
 * <p>Bearer token = API Key marchand. Body JSON. Devise principale MAD,
 * codes ISO alpha (MAD, EUR, USD).</p>
 *
 * <h2>Note importante — specs à confirmer lors du KYB</h2>
 * <p>Cette implémentation suit le pattern moderne standard (REST + HMAC).
 * Les specs exactes (champs requis, format de la signature webhook) sont à
 * confirmer lors de l'onboarding marchand Payzone. Le code est conçu pour
 * être facilement ajustable une fois les specs officielles obtenues.</p>
 */
@Component
public class PayzoneClient {

    private static final Logger log = LoggerFactory.getLogger(PayzoneClient.class);

    private static final String PROD_URL    = "https://api.payzone.ma/v1";
    private static final String SANDBOX_URL = "https://sandbox-api.payzone.ma/v1";

    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    public PayzoneClient(RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.restClientBuilder = restClientBuilder;
        this.objectMapper = objectMapper;
    }

    /**
     * Crée une session de paiement Payzone.
     *
     * @return {@link PayzonePaymentResponse} avec ID de transaction et URL de redirection
     */
    public PayzonePaymentResponse createPayment(PayzoneCreatePaymentParams params) {
        String url = resolveBaseUrl(params.sandbox()) + "/payments";

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("merchant_reference", params.merchantReference());
        body.put("amount", params.amount());
        body.put("currency", params.currency());
        body.put("description", params.description());
        body.put("success_url", params.successUrl());
        body.put("failure_url", params.failureUrl());
        body.put("webhook_url", params.webhookUrl());
        body.put("language", "fr");

        Map<String, String> customer = new LinkedHashMap<>();
        if (params.customerEmail() != null) customer.put("email", params.customerEmail());
        if (params.customerName() != null) customer.put("name", params.customerName());
        if (!customer.isEmpty()) body.put("customer", customer);

        try {
            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .header("Authorization", "Bearer " + params.apiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new PayzoneApiException(
                        "Payzone HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);

            if (response == null) {
                throw new PayzoneApiException("Payzone returned empty response");
            }
            String txId = textOrNull(response, "id");
            String redirectUrl = textOrNull(response, "checkout_url");
            if (txId == null || redirectUrl == null) {
                throw new PayzoneApiException(
                    "Payzone createPayment : id ou checkout_url absent (response=" + response + ")");
            }
            return new PayzonePaymentResponse(txId, redirectUrl);
        } catch (PayzoneApiException e) {
            throw e;
        } catch (Exception e) {
            throw new PayzoneApiException("Payzone API call failed: " + e.getMessage(), e);
        }
    }

    /**
     * Effectue un remboursement (total ou partiel) sur une transaction Payzone existante.
     *
     * @return {@link PayzoneRefundResponse} avec le statut de l'opération
     */
    public PayzoneRefundResponse refundPayment(PayzoneRefundParams params) {
        String url = resolveBaseUrl(params.sandbox()) + "/payments/" + params.transactionId() + "/refund";

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", params.amount());
        if (params.reason() != null) body.put("reason", params.reason());

        try {
            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .header("Authorization", "Bearer " + params.apiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new PayzoneApiException(
                        "Payzone refund HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);
            if (response == null) {
                throw new PayzoneApiException("Payzone returned empty refund response");
            }
            String refundId = textOrNull(response, "id");
            String status = textOrNull(response, "status");
            if (refundId == null) {
                throw new PayzoneApiException("Payzone refund : id absent (response=" + response + ")");
            }
            boolean success = status == null
                || "succeeded".equalsIgnoreCase(status)
                || "completed".equalsIgnoreCase(status)
                || "approved".equalsIgnoreCase(status);
            return new PayzoneRefundResponse(refundId, success, status);
        } catch (PayzoneApiException e) {
            throw e;
        } catch (Exception e) {
            throw new PayzoneApiException("Payzone refund call failed: " + e.getMessage(), e);
        }
    }

    /** URL de base selon l'environnement. */
    private static String resolveBaseUrl(boolean sandbox) {
        return sandbox ? SANDBOX_URL : PROD_URL;
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v != null && !v.isNull() ? v.asText() : null;
    }

    private static String readBody(java.io.InputStream in) {
        try { return new String(in.readAllBytes()); }
        catch (Exception e) { return "<unable to read body>"; }
    }

    // ─── DTOs ─────────────────────────────────────────────────────────────

    public record PayzoneCreatePaymentParams(
        String apiKey,
        boolean sandbox,
        String merchantReference,
        String currency,
        BigDecimal amount,
        String description,
        String successUrl,
        String failureUrl,
        String webhookUrl,
        String customerEmail,
        String customerName
    ) {}

    public record PayzonePaymentResponse(String transactionId, String redirectUrl) {}

    public record PayzoneRefundParams(
        String apiKey,
        boolean sandbox,
        String transactionId,
        BigDecimal amount,
        String reason
    ) {}

    public record PayzoneRefundResponse(String refundId, boolean approved, String status) {}

    public static class PayzoneApiException extends RuntimeException {
        public PayzoneApiException(String message) { super(message); }
        public PayzoneApiException(String message, Throwable cause) { super(message, cause); }
    }
}
