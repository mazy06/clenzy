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
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Client HTTP pour PayPal (REST API v2 — Orders).
 *
 * <h2>Spécificité PayPal : OAuth2 Client Credentials</h2>
 * <p>PayPal exige un appel préalable à
 * {@code POST /v1/oauth2/token} avec Basic Auth (client_id + client_secret)
 * pour obtenir un {@code access_token} (Bearer) à utiliser sur les calls
 * suivants. Le token est valable ~9h. On cache le token par organisation
 * pour éviter un round-trip à chaque transaction.</p>
 *
 * <h2>Endpoints</h2>
 * <ul>
 *   <li>Sandbox : {@code https://api-m.sandbox.paypal.com}</li>
 *   <li>Production : {@code https://api-m.paypal.com}</li>
 * </ul>
 *
 * <h2>Flow Orders v2</h2>
 * <ol>
 *   <li>POST /v2/checkout/orders → crée un order, renvoie un lien {@code approve}</li>
 *   <li>Guest redirigé vers PayPal pour approuver</li>
 *   <li>PayPal redirige vers {@code return_url} avec {@code token=ORDER_ID}</li>
 *   <li>POST /v2/checkout/orders/{id}/capture → capture le paiement</li>
 *   <li>Webhook PAYPAL.PAYMENT.CAPTURE.COMPLETED reçu en parallèle</li>
 * </ol>
 */
@Component
public class PayPalClient {

    private static final Logger log = LoggerFactory.getLogger(PayPalClient.class);

    private static final String PROD_URL    = "https://api-m.paypal.com";
    private static final String SANDBOX_URL = "https://api-m.sandbox.paypal.com";

    /** Cache d'access tokens par (orgId, env). Expire ~9h après l'émission. */
    private final Map<String, TokenCacheEntry> tokenCache = new ConcurrentHashMap<>();

    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    public PayPalClient(RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.restClientBuilder = restClientBuilder;
        this.objectMapper = objectMapper;
    }

    /**
     * Crée un Order PayPal et retourne l'URL d'approbation.
     */
    public PayPalOrderResponse createOrder(PayPalCreateOrderParams params) {
        String accessToken = getAccessToken(params.cacheKey(), params.sandbox(),
            params.clientId(), params.clientSecret());

        String url = resolveBaseUrl(params.sandbox()) + "/v2/checkout/orders";

        Map<String, Object> amount = new LinkedHashMap<>();
        amount.put("currency_code", params.currency());
        amount.put("value", params.amount().toPlainString());

        Map<String, Object> purchaseUnit = new LinkedHashMap<>();
        purchaseUnit.put("reference_id", params.referenceId());
        purchaseUnit.put("description", params.description());
        purchaseUnit.put("amount", amount);

        Map<String, Object> applicationContext = new LinkedHashMap<>();
        applicationContext.put("return_url", params.returnUrl());
        applicationContext.put("cancel_url", params.cancelUrl());
        applicationContext.put("brand_name", "Clenzy");
        applicationContext.put("user_action", "PAY_NOW");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("intent", "CAPTURE");
        body.put("purchase_units", List.of(purchaseUnit));
        body.put("application_context", applicationContext);

        try {
            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .header("Authorization", "Bearer " + accessToken)
                .header("PayPal-Request-Id", params.referenceId()) // idempotence
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new PayPalApiException(
                        "PayPal HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);

            if (response == null) {
                throw new PayPalApiException("PayPal returned empty response");
            }
            String orderId = textOrNull(response, "id");
            String approveUrl = extractApproveLink(response);
            if (orderId == null || approveUrl == null) {
                throw new PayPalApiException(
                    "PayPal createOrder : id ou approve link absent (response=" + response + ")");
            }
            return new PayPalOrderResponse(orderId, approveUrl);
        } catch (PayPalApiException e) {
            throw e;
        } catch (Exception e) {
            throw new PayPalApiException("PayPal API call failed: " + e.getMessage(), e);
        }
    }

    /**
     * Capture un Order PayPal (appelé en webhook ou après return du guest).
     */
    public PayPalCaptureResponse captureOrder(String orderId, PayPalCredentials creds) {
        String accessToken = getAccessToken(creds.cacheKey(), creds.sandbox(),
            creds.clientId(), creds.clientSecret());

        String url = resolveBaseUrl(creds.sandbox()) + "/v2/checkout/orders/" + orderId + "/capture";

        try {
            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body("{}")
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new PayPalApiException(
                        "PayPal capture HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);

            if (response == null) {
                throw new PayPalApiException("PayPal capture : empty response");
            }
            String status = textOrNull(response, "status");
            // Extraire le capture_id depuis purchase_units[0].payments.captures[0].id
            // — c'est l'identifiant à utiliser pour les refunds futurs.
            String captureId = extractCaptureId(response);
            return new PayPalCaptureResponse(orderId, captureId, "COMPLETED".equals(status), status);
        } catch (PayPalApiException e) {
            throw e;
        } catch (Exception e) {
            throw new PayPalApiException("PayPal capture call failed: " + e.getMessage(), e);
        }
    }

    /**
     * Effectue un refund sur une capture PayPal existante.
     *
     * @param captureId identifiant de la capture (extrait de la réponse de
     *                  capture, distinct de l'order_id)
     * @return {@link PayPalRefundResponse} avec le statut COMPLETED ou PENDING
     */
    public PayPalRefundResponse refundCapture(String captureId, PayPalRefundParams params) {
        String accessToken = getAccessToken(params.cacheKey(), params.sandbox(),
            params.clientId(), params.clientSecret());

        String url = resolveBaseUrl(params.sandbox()) + "/v2/payments/captures/" + captureId + "/refund";

        Map<String, Object> amountBody = new LinkedHashMap<>();
        amountBody.put("currency_code", params.currency());
        amountBody.put("value", params.amount().toPlainString());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", amountBody);
        if (params.reason() != null) body.put("note_to_payer", params.reason());

        try {
            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .header("Authorization", "Bearer " + accessToken)
                .header("PayPal-Request-Id", "refund-" + captureId) // idempotence
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new PayPalApiException(
                        "PayPal refund HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);
            if (response == null) {
                throw new PayPalApiException("PayPal refund : empty response");
            }
            String refundId = textOrNull(response, "id");
            String status = textOrNull(response, "status");
            boolean completed = "COMPLETED".equals(status) || "PENDING".equals(status);
            return new PayPalRefundResponse(refundId, completed, status);
        } catch (PayPalApiException e) {
            throw e;
        } catch (Exception e) {
            throw new PayPalApiException("PayPal refund call failed: " + e.getMessage(), e);
        }
    }

    /**
     * Vérifie la signature d'un webhook PayPal via l'API officielle
     * {@code POST /v1/notifications/verify-webhook-signature}.
     *
     * <p>PayPal n'expose pas de secret HMAC partagé — la verification stricte
     * passe forcément par cet appel API qui valide la signature via le
     * certificat associé au webhook_id du marchand.</p>
     *
     * @return {@code true} si PayPal renvoie {@code verification_status=SUCCESS}
     */
    public boolean verifyWebhookSignature(PayPalWebhookHeaders headers, String webhookId,
                                           String rawPayload, PayPalCredentials creds) {
        try {
            String accessToken = getAccessToken(creds.cacheKey(), creds.sandbox(),
                creds.clientId(), creds.clientSecret());
            String url = resolveBaseUrl(creds.sandbox()) + "/v1/notifications/verify-webhook-signature";

            // Reconstruire le payload JSON brut comme objet JsonNode
            JsonNode webhookEvent = objectMapper.readTree(rawPayload);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("auth_algo", headers.authAlgo());
            body.put("cert_url", headers.certUrl());
            body.put("transmission_id", headers.transmissionId());
            body.put("transmission_sig", headers.transmissionSig());
            body.put("transmission_time", headers.transmissionTime());
            body.put("webhook_id", webhookId);
            body.put("webhook_event", webhookEvent);

            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new PayPalApiException(
                        "PayPal verify-webhook HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);

            if (response == null) return false;
            String status = textOrNull(response, "verification_status");
            boolean valid = "SUCCESS".equals(status);
            if (!valid) {
                log.warn("PayPal webhook verification refusee : status={}", status);
            }
            return valid;
        } catch (Exception e) {
            log.error("PayPal verifyWebhookSignature failed", e);
            return false;
        }
    }

    /** Extrait le capture_id depuis le payload de capture PayPal v2. */
    private static String extractCaptureId(JsonNode response) {
        JsonNode purchaseUnits = response.get("purchase_units");
        if (purchaseUnits == null || !purchaseUnits.isArray() || purchaseUnits.size() == 0) {
            return null;
        }
        JsonNode payments = purchaseUnits.get(0).get("payments");
        if (payments == null) return null;
        JsonNode captures = payments.get("captures");
        if (captures == null || !captures.isArray() || captures.size() == 0) return null;
        return textOrNull(captures.get(0), "id");
    }

    /**
     * Obtient un access token via OAuth2 Client Credentials. Cache 30 minutes
     * avant expiration pour éviter les renouvellements concurrents.
     */
    private synchronized String getAccessToken(String cacheKey, boolean sandbox,
                                                String clientId, String clientSecret) {
        TokenCacheEntry cached = tokenCache.get(cacheKey);
        if (cached != null && cached.expiresAt.isAfter(Instant.now().plusSeconds(60))) {
            return cached.accessToken;
        }

        String url = resolveBaseUrl(sandbox) + "/v1/oauth2/token";
        String basic = Base64.getEncoder().encodeToString(
            (clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));

        try {
            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .header("Authorization", "Basic " + basic)
                .header("Accept-Language", "en_US")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .accept(MediaType.APPLICATION_JSON)
                .body("grant_type=client_credentials")
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new PayPalApiException(
                        "PayPal OAuth2 token HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);

            if (response == null) {
                throw new PayPalApiException("PayPal OAuth2 : empty response");
            }
            String token = textOrNull(response, "access_token");
            long expiresIn = response.has("expires_in") ? response.get("expires_in").asLong() : 28800L;
            if (token == null) {
                throw new PayPalApiException("PayPal OAuth2 : access_token absent");
            }
            TokenCacheEntry entry = new TokenCacheEntry(token, Instant.now().plusSeconds(expiresIn));
            tokenCache.put(cacheKey, entry);
            log.debug("PayPal access token refreshed for {} (expires in {}s)", cacheKey, expiresIn);
            return token;
        } catch (PayPalApiException e) {
            throw e;
        } catch (Exception e) {
            throw new PayPalApiException("PayPal OAuth2 failed: " + e.getMessage(), e);
        }
    }

    private static String resolveBaseUrl(boolean sandbox) {
        return sandbox ? SANDBOX_URL : PROD_URL;
    }

    private static String extractApproveLink(JsonNode response) {
        JsonNode links = response.get("links");
        if (links == null || !links.isArray()) return null;
        for (JsonNode link : links) {
            String rel = textOrNull(link, "rel");
            if ("approve".equals(rel) || "payer-action".equals(rel)) {
                return textOrNull(link, "href");
            }
        }
        return null;
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

    public record PayPalCreateOrderParams(
        String cacheKey, // ex: "org-42:sandbox"
        boolean sandbox,
        String clientId,
        String clientSecret,
        String referenceId,
        String currency,
        BigDecimal amount,
        String description,
        String returnUrl,
        String cancelUrl
    ) {}

    public record PayPalOrderResponse(String orderId, String approveUrl) {}

    public record PayPalCaptureResponse(String orderId, String captureId, boolean completed, String status) {}

    public record PayPalRefundParams(
        String cacheKey,
        boolean sandbox,
        String clientId,
        String clientSecret,
        String currency,
        BigDecimal amount,
        String reason
    ) {}

    public record PayPalRefundResponse(String refundId, boolean completed, String status) {}

    /**
     * Headers PayPal nécessaires à la vérification de signature webhook
     * (présents sur tout webhook PayPal).
     */
    public record PayPalWebhookHeaders(
        String authAlgo,        // PAYPAL-AUTH-ALGO
        String certUrl,         // PAYPAL-CERT-URL
        String transmissionId,  // PAYPAL-TRANSMISSION-ID
        String transmissionSig, // PAYPAL-TRANSMISSION-SIG
        String transmissionTime // PAYPAL-TRANSMISSION-TIME
    ) {}

    public record PayPalCredentials(
        String cacheKey,
        boolean sandbox,
        String clientId,
        String clientSecret
    ) {}

    /** Entrée du cache d'access tokens. */
    private record TokenCacheEntry(String accessToken, Instant expiresAt) {}

    public static class PayPalApiException extends RuntimeException {
        public PayPalApiException(String message) { super(message); }
        public PayPalApiException(String message, Throwable cause) { super(message, cause); }
    }
}
