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
 * Client HTTP pour l'API PayTabs (HPP — Hosted Payment Page).
 *
 * <h2>Responsabilites</h2>
 * <ul>
 *   <li>Construire le payload JSON conforme a la spec PayTabs</li>
 *   <li>Effectuer les appels REST avec le Server Key dans le header
 *       {@code Authorization}</li>
 *   <li>Parser la reponse en {@link Map} pour decouplage du provider</li>
 * </ul>
 *
 * <h2>Region</h2>
 * <p>PayTabs propose des endpoints distincts par region marchande
 * (SA = {@code secure.paytabs.sa}, AE = {@code secure.paytabs.com},
 * EG = {@code secure-egypt.paytabs.com}, etc.). L'URL est resolue depuis le
 * code region passe au constructor de chaque appel.</p>
 *
 * <h2>Sandbox</h2>
 * <p>PayTabs n'a pas d'URL sandbox separee : le mode sandbox est determine
 * par un Profile ID de test cree depuis le dashboard merchant.sandbox.paytabs.com.
 * L'URL d'appel reste la meme.</p>
 *
 * <h2>Pourquoi un client separe</h2>
 * <p>Permet de tester unitairement les appels HTTP (mock {@code RestClient})
 * sans monter tout le contexte Spring du {@link PayTabsPaymentProvider}.</p>
 */
@Component
public class PayTabsClient {

    private static final Logger log = LoggerFactory.getLogger(PayTabsClient.class);

    /** URLs regionales PayTabs (production + sandbox utilisent les memes hosts). */
    private static final Map<String, String> REGION_HOSTS = Map.of(
        "SA", "https://secure.paytabs.sa",
        "AE", "https://secure.paytabs.com",
        "EG", "https://secure-egypt.paytabs.com",
        "JO", "https://secure-jordan.paytabs.com",
        "OM", "https://secure-oman.paytabs.com",
        "GLOBAL", "https://secure.paytabs.com"
    );

    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    public PayTabsClient(RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.restClientBuilder = restClientBuilder;
        this.objectMapper = objectMapper;
    }

    /**
     * Cree une session de paiement HPP (Hosted Payment Page).
     *
     * @return {@link PayTabsPaymentResponse} avec {@code tranRef} et {@code redirectUrl}
     * @throws PayTabsApiException en cas d'erreur HTTP ou de payload invalide
     */
    public PayTabsPaymentResponse createPayment(PayTabsCreatePaymentParams params) {
        String url = resolveHost(params.region()) + "/payment/request";

        // Ordre des champs : on suit la doc PayTabs pour faciliter le debug
        // (les requetes paraissent dans l'ordre attendu dans les logs).
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("profile_id", params.profileId());
        body.put("tran_type", "sale");
        body.put("tran_class", "ecom");
        body.put("cart_id", params.cartId());
        body.put("cart_currency", params.currency());
        body.put("cart_amount", params.amount());
        body.put("cart_description", params.description());
        body.put("callback", params.callbackUrl());
        body.put("return", params.returnUrl());
        body.put("hide_shipping", true);

        Map<String, String> customer = new LinkedHashMap<>();
        if (params.customerName() != null) customer.put("name", params.customerName());
        if (params.customerEmail() != null) customer.put("email", params.customerEmail());
        if (!customer.isEmpty()) {
            body.put("customer_details", customer);
        }

        try {
            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .header("Authorization", params.serverKey())
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new PayTabsApiException(
                        "PayTabs HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);

            if (response == null) {
                throw new PayTabsApiException("PayTabs returned empty response");
            }

            String tranRef = textOrNull(response, "tran_ref");
            String redirectUrl = textOrNull(response, "redirect_url");

            if (tranRef == null || redirectUrl == null) {
                // PayTabs renvoie parfois un code d'erreur applicatif dans le body avec HTTP 200
                String code = textOrNull(response, "code");
                String message = textOrNull(response, "message");
                throw new PayTabsApiException(
                    "PayTabs createPayment failed — code=" + code + " message=" + message);
            }

            return new PayTabsPaymentResponse(tranRef, redirectUrl);
        } catch (PayTabsApiException e) {
            throw e;
        } catch (Exception e) {
            throw new PayTabsApiException("PayTabs API call failed: " + e.getMessage(), e);
        }
    }

    /**
     * Demande de remboursement (total ou partiel) sur une transaction existante.
     *
     * @return {@link PayTabsRefundResponse} avec le {@code tranRef} du refund
     */
    public PayTabsRefundResponse refundPayment(PayTabsRefundParams params) {
        String url = resolveHost(params.region()) + "/payment/request";

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("profile_id", params.profileId());
        body.put("tran_type", "refund");
        body.put("tran_class", "ecom");
        body.put("cart_id", params.cartId());
        body.put("cart_currency", params.currency());
        body.put("cart_amount", params.amount());
        body.put("cart_description", params.reason() != null ? params.reason() : "Refund");
        body.put("tran_ref", params.originalTranRef());

        try {
            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .header("Authorization", params.serverKey())
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new PayTabsApiException(
                        "PayTabs refund HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);

            if (response == null) {
                throw new PayTabsApiException("PayTabs returned empty refund response");
            }
            String refundTranRef = textOrNull(response, "tran_ref");
            String status = response.has("payment_result")
                ? textOrNull(response.get("payment_result"), "response_status")
                : null;

            if (refundTranRef == null) {
                throw new PayTabsApiException("PayTabs refund failed — no tran_ref returned");
            }
            return new PayTabsRefundResponse(refundTranRef, "A".equals(status));
        } catch (PayTabsApiException e) {
            throw e;
        } catch (Exception e) {
            throw new PayTabsApiException("PayTabs refund call failed: " + e.getMessage(), e);
        }
    }

    /** Resout l'URL d'API selon la region. Default {@code GLOBAL}. */
    private String resolveHost(String region) {
        if (region == null || region.isBlank()) return REGION_HOSTS.get("GLOBAL");
        return REGION_HOSTS.getOrDefault(region.toUpperCase(), REGION_HOSTS.get("GLOBAL"));
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v != null && !v.isNull() ? v.asText() : null;
    }

    private static String readBody(java.io.InputStream in) {
        try {
            return new String(in.readAllBytes());
        } catch (Exception e) {
            return "<unable to read body>";
        }
    }

    // ─── DTOs ─────────────────────────────────────────────────────────────

    public record PayTabsCreatePaymentParams(
        String serverKey,
        Long profileId,
        String region,
        String cartId,
        String currency,
        BigDecimal amount,
        String description,
        String callbackUrl,
        String returnUrl,
        String customerName,
        String customerEmail
    ) {}

    public record PayTabsPaymentResponse(String tranRef, String redirectUrl) {}

    public record PayTabsRefundParams(
        String serverKey,
        Long profileId,
        String region,
        String cartId,
        String currency,
        BigDecimal amount,
        String reason,
        String originalTranRef
    ) {}

    public record PayTabsRefundResponse(String tranRef, boolean approved) {}

    /** Wrapper exception pour erreurs PayTabs (HTTP, parsing, applicatif). */
    public static class PayTabsApiException extends RuntimeException {
        public PayTabsApiException(String message) { super(message); }
        public PayTabsApiException(String message, Throwable cause) { super(message, cause); }
    }
}
