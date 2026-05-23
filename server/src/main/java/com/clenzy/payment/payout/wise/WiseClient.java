package com.clenzy.payment.payout.wise;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Client HTTP pour Wise Business API (transfers + recipients).
 *
 * <h2>Endpoints</h2>
 * <ul>
 *   <li>Sandbox : {@code https://api.sandbox.transferwise.tech}</li>
 *   <li>Production : {@code https://api.wise.com}</li>
 * </ul>
 *
 * <h2>Authentification</h2>
 * <p>Bearer API token (personal token sur sandbox, full-access token sur prod).
 * Configuré globalement par Clenzy via {@code wise.api-token} et
 * {@code wise.profile-id} dans {@code application.yml} — pas par-tenant : un
 * seul compte Wise Business pour Clenzy distribue à tous les propriétaires.</p>
 *
 * <h2>Flow d'un transfer</h2>
 * <ol>
 *   <li>Créer un quote (POST /v3/profiles/{id}/quotes) → retourne quoteId + tarif</li>
 *   <li>Créer un recipient (POST /v1/accounts) si pas déjà existant pour cet IBAN</li>
 *   <li>Créer le transfer (POST /v1/transfers) avec quoteId + recipientId</li>
 *   <li>Funder le transfer (POST /v3/profiles/{id}/transfers/{id}/payments) depuis
 *       le solde Wise de Clenzy</li>
 *   <li>Webhook transfers/state_change : OUTGOING_PAYMENT_SENT → marquer PAID</li>
 * </ol>
 *
 * <h2>Idempotence</h2>
 * <p>Wise utilise un header {@code X-idempotence-uuid} sur la création de
 * transfer. On utilise notre payoutId comme base d'idempotence pour éviter
 * les doubles débits en cas de retry.</p>
 */
@Component
public class WiseClient {

    private static final Logger log = LoggerFactory.getLogger(WiseClient.class);

    @Value("${wise.api-token:}")
    private String apiToken;

    @Value("${wise.profile-id:}")
    private String profileId;

    @Value("${wise.sandbox:true}")
    private boolean sandbox;

    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    public WiseClient(RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.restClientBuilder = restClientBuilder;
        this.objectMapper = objectMapper;
    }

    /**
     * Vérifie si l'intégration Wise est activée (token + profile configurés).
     */
    public boolean isEnabled() {
        return apiToken != null && !apiToken.isBlank()
            && profileId != null && !profileId.isBlank();
    }

    /**
     * Crée un recipient Wise pour un IBAN + nom donné. Idempotent côté Wise :
     * créer 2 fois le même IBAN renvoie le même recipient.
     *
     * @return l'ID Wise du recipient (à stocker dans
     *         {@code OwnerPayoutConfig.wiseRecipientId})
     */
    public String createRecipient(String iban, String fullName, String currency, String legalType) {
        String url = baseUrl() + "/v1/accounts";

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("legalType", legalType != null ? legalType : "PRIVATE");
        details.put("IBAN", iban);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("currency", currency);
        body.put("type", "iban");
        body.put("profile", profileId);
        body.put("accountHolderName", fullName);
        body.put("details", details);

        try {
            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .header("Authorization", "Bearer " + apiToken)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new WiseApiException(
                        "Wise createRecipient HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);

            if (response == null) {
                throw new WiseApiException("Wise createRecipient : empty response");
            }
            String id = textOrNull(response, "id");
            if (id == null) {
                throw new WiseApiException("Wise createRecipient : id absent (response=" + response + ")");
            }
            return id;
        } catch (WiseApiException e) {
            throw e;
        } catch (Exception e) {
            throw new WiseApiException("Wise createRecipient failed: " + e.getMessage(), e);
        }
    }

    /**
     * Crée un quote (= devis de transfer Wise) pour un montant et une devise donnés.
     *
     * @return quoteId à utiliser dans {@link #createTransfer}
     */
    public WiseQuote createQuote(BigDecimal amount, String sourceCurrency, String targetCurrency, String targetRecipientId) {
        String url = baseUrl() + "/v3/profiles/" + profileId + "/quotes";

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("sourceCurrency", sourceCurrency);
        body.put("targetCurrency", targetCurrency);
        // sourceAmount = ce que Clenzy débite ; alternative = targetAmount = ce
        // que l'owner reçoit. On utilise sourceAmount pour figer le coût Clenzy.
        body.put("sourceAmount", amount);
        body.put("payOut", "BANK_TRANSFER");
        if (targetRecipientId != null) {
            body.put("targetAccount", Long.valueOf(targetRecipientId));
        }

        try {
            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .header("Authorization", "Bearer " + apiToken)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new WiseApiException(
                        "Wise createQuote HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);

            if (response == null) throw new WiseApiException("Wise createQuote : empty response");
            String quoteId = textOrNull(response, "id");
            if (quoteId == null) {
                throw new WiseApiException("Wise createQuote : id absent");
            }
            BigDecimal targetAmount = response.has("targetAmount")
                ? new BigDecimal(response.get("targetAmount").asText()) : null;
            BigDecimal feeAmount = response.has("fee")
                ? new BigDecimal(response.get("fee").asText()) : null;
            return new WiseQuote(quoteId, targetAmount, feeAmount);
        } catch (WiseApiException e) {
            throw e;
        } catch (Exception e) {
            throw new WiseApiException("Wise createQuote failed: " + e.getMessage(), e);
        }
    }

    /**
     * Crée un transfer à partir d'un quote + recipient.
     *
     * @param payoutId pour la traçabilité (customerTransactionId chez Wise)
     * @return l'ID du transfer Wise (long, à stocker pour le webhook lookup)
     */
    public String createTransfer(String quoteId, String recipientId, Long payoutId, String reference) {
        String url = baseUrl() + "/v1/transfers";

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("reference", reference != null ? reference : ("Clenzy payout #" + payoutId));
        details.put("transferPurpose", "verification.transfers.purpose.other");
        details.put("sourceOfFunds", "verification.source.of.funds.other");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("targetAccount", Long.valueOf(recipientId));
        body.put("quoteUuid", quoteId);
        // customerTransactionId doit être un UUID unique côté Wise.
        // On dérive du payoutId pour l'idempotence inter-retry.
        body.put("customerTransactionId", deterministicUuid("clenzy-payout-" + payoutId));
        body.put("details", details);

        try {
            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .header("Authorization", "Bearer " + apiToken)
                .header("X-idempotence-uuid", deterministicUuid("clenzy-payout-" + payoutId))
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new WiseApiException(
                        "Wise createTransfer HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);

            if (response == null) throw new WiseApiException("Wise createTransfer : empty response");
            JsonNode idNode = response.get("id");
            if (idNode == null) {
                throw new WiseApiException("Wise createTransfer : id absent");
            }
            return idNode.asText();
        } catch (WiseApiException e) {
            throw e;
        } catch (Exception e) {
            throw new WiseApiException("Wise createTransfer failed: " + e.getMessage(), e);
        }
    }

    /**
     * Funde le transfer depuis le solde Wise de Clenzy (étape obligatoire avant
     * exécution effective côté Wise).
     */
    public void fundTransfer(String transferId) {
        String url = baseUrl() + "/v3/profiles/" + profileId + "/transfers/" + transferId + "/payments";

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "BALANCE");

        try {
            restClientBuilder.build()
                .post()
                .uri(url)
                .header("Authorization", "Bearer " + apiToken)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new WiseApiException(
                        "Wise fundTransfer HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .toBodilessEntity();
        } catch (WiseApiException e) {
            throw e;
        } catch (Exception e) {
            throw new WiseApiException("Wise fundTransfer failed: " + e.getMessage(), e);
        }
    }

    /** URL de base selon l'environnement (sandbox ou prod). */
    private String baseUrl() {
        return sandbox ? "https://api.sandbox.transferwise.tech" : "https://api.wise.com";
    }

    /** UUID déterministe pour idempotence cross-retry. */
    private static String deterministicUuid(String key) {
        return UUID.nameUUIDFromBytes(key.getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v != null && !v.isNull() ? v.asText() : null;
    }

    private static String readBody(java.io.InputStream in) {
        try { return new String(in.readAllBytes()); }
        catch (Exception e) { return "<unable to read body>"; }
    }

    /** Résultat d'une demande de quote Wise. */
    public record WiseQuote(String quoteId, BigDecimal targetAmount, BigDecimal feeAmount) {}

    public static class WiseApiException extends RuntimeException {
        public WiseApiException(String message) { super(message); }
        public WiseApiException(String message, Throwable cause) { super(message, cause); }
    }
}
