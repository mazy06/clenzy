package com.clenzy.payment.provider;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Client HTTP pour YouCan Pay (PSP marocain self-serve).
 *
 * <h2>Faits d'API « grounded » (doc publique + SDK PHP officiel youcan-shop/youcan-payment-php-sdk)</h2>
 * <ul>
 *   <li>Bases (HTTPAdapter du SDK) : prod {@code https://youcanpay.com/api},
 *       sandbox {@code https://youcanpay.com/sandbox/api}.</li>
 *   <li>{@code POST /tokenize} (TokenEndpoint du SDK) : {@code pri_key},
 *       {@code order_id}, {@code amount} (entier en unités mineures — centimes MAD),
 *       {@code currency} (ISO-4217), {@code success_url}, {@code error_url},
 *       {@code customer_ip} → réponse {@code {"token": {"id": "..."}}}
 *       (la doc web montre aussi une variante {@code {"token": "..."}} — les deux
 *       formes sont acceptées ici).</li>
 *   <li>Redirection guest (Token#getPaymentURL du SDK) :
 *       {@code https://youcanpay.com/[sandbox/]payment-form/&lt;tokenId&gt;}.</li>
 * </ul>
 *
 * <p>Tout non-2xx est <b>propagé</b> en {@link YouCanPayApiException} — jamais avalé.</p>
 */
@Component
public class YouCanPayClient {

    private static final String PROD_URL    = "https://youcanpay.com/api";
    private static final String SANDBOX_URL = "https://youcanpay.com/sandbox/api";
    private static final String PROD_FORM_URL    = "https://youcanpay.com/payment-form/";
    private static final String SANDBOX_FORM_URL = "https://youcanpay.com/sandbox/payment-form/";

    private final RestClient.Builder restClientBuilder;

    public YouCanPayClient(RestClient.Builder restClientBuilder) {
        this.restClientBuilder = restClientBuilder;
    }

    /**
     * Tokenize un paiement et retourne le token + l'URL de la page de paiement hébergée.
     *
     * @param params paramètres (clé privée, référence marchand, montant en unités mineures…)
     */
    public YouCanPayTokenResponse tokenize(YouCanPayTokenizeParams params) {
        String url = resolveBaseUrl(params.sandbox()) + "/tokenize";

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("pri_key", params.privateKey());
        body.put("order_id", params.orderId());
        body.put("amount", String.valueOf(params.amountMinorUnits()));
        body.put("currency", params.currency());
        body.put("success_url", params.successUrl());
        body.put("error_url", params.errorUrl());
        if (params.customerIp() != null && !params.customerIp().isBlank()) {
            body.put("customer_ip", params.customerIp());
        }

        try {
            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new YouCanPayApiException(
                        "YouCan Pay HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);

            if (response == null) {
                throw new YouCanPayApiException("YouCan Pay returned empty response");
            }
            // Réponse SDK officiel : { "token": { "id": "..." } } ; la doc web montre
            // aussi { "token": "cp..." } — on accepte les deux formes.
            JsonNode token = response.get("token");
            String tokenId = null;
            if (token != null && token.isObject()) {
                tokenId = textOrNull(token, "id");
            } else if (token != null && token.isTextual() && !token.asText().isBlank()) {
                tokenId = token.asText();
            }
            if (tokenId == null) {
                throw new YouCanPayApiException(
                    "YouCan Pay tokenize : token absent de la réponse (response=" + response + ")");
            }
            String formBase = params.sandbox() ? SANDBOX_FORM_URL : PROD_FORM_URL;
            return new YouCanPayTokenResponse(tokenId, formBase + tokenId);
        } catch (YouCanPayApiException e) {
            throw e;
        } catch (Exception e) {
            throw new YouCanPayApiException("YouCan Pay API call failed: " + e.getMessage(), e);
        }
    }

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

    public record YouCanPayTokenizeParams(
        String privateKey,
        boolean sandbox,
        String orderId,
        String currency,
        long amountMinorUnits,
        String successUrl,
        String errorUrl,
        String customerIp
    ) {}

    public record YouCanPayTokenResponse(String tokenId, String paymentFormUrl) {}

    public static class YouCanPayApiException extends RuntimeException {
        public YouCanPayApiException(String message) { super(message); }
        public YouCanPayApiException(String message, Throwable cause) { super(message, cause); }
    }
}
