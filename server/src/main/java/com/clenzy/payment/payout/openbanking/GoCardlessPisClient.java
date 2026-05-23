package com.clenzy.payment.payout.openbanking;

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
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Client HTTP pour GoCardless Bank Account Data + Payment Initiation Service (PIS).
 *
 * <h2>Flow Open Banking complet</h2>
 * <ol>
 *   <li><strong>Consent</strong> : Clenzy (admin) initie une requête de consentement
 *       sur sa banque via {@code POST /api/v2/requisitions/}. Renvoie une URL
 *       de redirection vers la banque où l'admin signe avec SCA (2FA).</li>
 *   <li>L'admin revient sur Clenzy → on échange le code contre un
 *       {@code requisition_id} valide ~90 jours.</li>
 *   <li><strong>Initiate Payment</strong> : pour chaque payout, on fait
 *       {@code POST /api/v2/payments/} avec creditor (IBAN owner), debtor
 *       (compte Clenzy), montant, devise. Renvoie un {@code payment_id}.</li>
 *   <li>La banque exécute le virement en J ou J+1 selon le schéma SEPA.</li>
 *   <li>Webhook {@code payments.state_changed} pour passer PAID/FAILED.</li>
 * </ol>
 *
 * <h2>Authentification</h2>
 * <p>Bearer access_token obtenu via {@code POST /api/v2/token/new/} avec
 * secret_id + secret_key (config Clenzy globale). Token valable 24h, refresh
 * via {@code /api/v2/token/refresh/}.</p>
 *
 * <h2>Sandbox</h2>
 * <p>GoCardless a un sandbox propre : {@code https://bankaccountdata.gocardless.com}
 * accepte un compte de test ({@code SANDBOXFINANCE_SFIN0000}). Auth identique
 * à la prod. Permet de tester le flow complet sans toucher à du vrai argent.</p>
 */
@Component
public class GoCardlessPisClient {

    private static final Logger log = LoggerFactory.getLogger(GoCardlessPisClient.class);
    private static final String BASE_URL = "https://bankaccountdata.gocardless.com";

    @Value("${gocardless.secret-id:}")
    private String secretId;

    @Value("${gocardless.secret-key:}")
    private String secretKey;

    /** Compte bancaire Clenzy depuis lequel les virements partent (UUID GoCardless). */
    @Value("${gocardless.debtor-account-id:}")
    private String debtorAccountId;

    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    /** Cache simple du token (24h TTL côté GoCardless). */
    private volatile String cachedToken;
    private volatile Instant cachedTokenExpiry;

    public GoCardlessPisClient(RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.restClientBuilder = restClientBuilder;
        this.objectMapper = objectMapper;
    }

    public boolean isEnabled() {
        return secretId != null && !secretId.isBlank()
            && secretKey != null && !secretKey.isBlank()
            && debtorAccountId != null && !debtorAccountId.isBlank();
    }

    /**
     * Initie un payment SEPA Credit Transfer depuis le compte Clenzy vers
     * un IBAN propriétaire.
     *
     * @param consentId requisition_id valide (obtenu après SCA admin)
     * @return l'ID du payment GoCardless (à stocker dans paymentReference)
     */
    public String initiatePayment(String consentId, BigDecimal amount, String currency,
                                   String creditorIban, String creditorName, String reference) {
        String url = BASE_URL + "/api/v2/payments/";
        String token = getAccessToken();

        Map<String, Object> creditor = new LinkedHashMap<>();
        creditor.put("name", creditorName);
        creditor.put("iban", creditorIban);

        Map<String, Object> instructedAmount = new LinkedHashMap<>();
        instructedAmount.put("currency", currency);
        instructedAmount.put("amount", amount.toPlainString());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("requisition", consentId);
        body.put("debtor_account", debtorAccountId);
        body.put("creditor", creditor);
        body.put("instructed_amount", instructedAmount);
        body.put("end_to_end_identification", reference);
        body.put("remittance_information_unstructured", reference);

        try {
            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new OpenBankingApiException(
                        "GoCardless initiatePayment HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);

            if (response == null) {
                throw new OpenBankingApiException("GoCardless initiatePayment : empty response");
            }
            String paymentId = textOrNull(response, "id");
            if (paymentId == null) {
                throw new OpenBankingApiException("GoCardless initiatePayment : id absent");
            }
            return paymentId;
        } catch (OpenBankingApiException e) {
            throw e;
        } catch (Exception e) {
            throw new OpenBankingApiException("GoCardless initiatePayment failed: " + e.getMessage(), e);
        }
    }

    /**
     * Crée une requisition (= demande de consentement SCA) pour autoriser
     * Clenzy à initier des paiements depuis son compte.
     *
     * @param redirectUrl URL où GoCardless renvoie l'admin après SCA
     * @param institutionId ID de la banque Clenzy (ex: "BNP_PARIBAS_BNPAFRPP")
     * @return URL à ouvrir dans le navigateur de l'admin pour signer le SCA
     */
    public RequisitionResult createRequisition(String redirectUrl, String institutionId, String reference) {
        String url = BASE_URL + "/api/v2/requisitions/";
        String token = getAccessToken();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("redirect", redirectUrl);
        body.put("institution_id", institutionId);
        body.put("reference", reference);
        body.put("agreement", null); // utilise l'agreement par défaut (90 jours)
        body.put("user_language", "FR");

        try {
            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new OpenBankingApiException(
                        "GoCardless createRequisition HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);

            if (response == null) {
                throw new OpenBankingApiException("GoCardless createRequisition : empty response");
            }
            String id = textOrNull(response, "id");
            String link = textOrNull(response, "link");
            if (id == null || link == null) {
                throw new OpenBankingApiException("GoCardless createRequisition : id/link absent");
            }
            return new RequisitionResult(id, link);
        } catch (OpenBankingApiException e) {
            throw e;
        } catch (Exception e) {
            throw new OpenBankingApiException("GoCardless createRequisition failed: " + e.getMessage(), e);
        }
    }

    /**
     * Vérifie que le consent (requisition) est toujours valide.
     */
    public boolean isConsentValid(String consentId) {
        String url = BASE_URL + "/api/v2/requisitions/" + consentId + "/";
        String token = getAccessToken();
        try {
            JsonNode response = restClientBuilder.build()
                .get()
                .uri(url)
                .header("Authorization", "Bearer " + token)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(JsonNode.class);
            if (response == null) return false;
            String status = textOrNull(response, "status");
            return "LN".equals(status); // "LN" = Linked = consent valide
        } catch (Exception e) {
            log.warn("GoCardless isConsentValid failed for {}: {}", consentId, e.getMessage());
            return false;
        }
    }

    /**
     * Liste les banques disponibles chez GoCardless pour un pays donné.
     *
     * <p>Endpoint {@code GET /api/v2/institutions/?country=FR}. Renvoie la
     * liste des banques (id + name + logo + transaction_total_days) que
     * l'utilisateur peut sélectionner pour le SCA.</p>
     *
     * <p>Cache simple in-memory par pays (TTL 1h) pour éviter d'appeler
     * GoCardless à chaque ouverture du dialog côté frontend.</p>
     */
    public List<InstitutionInfo> listInstitutions(String countryCode) {
        String key = countryCode != null ? countryCode.toUpperCase() : "FR";
        InstitutionCacheEntry cached = institutionsCache.get(key);
        if (cached != null && cached.expiresAt.isAfter(Instant.now())) {
            return cached.institutions;
        }

        String url = BASE_URL + "/api/v2/institutions/?country=" + key;
        String token = getAccessToken();

        try {
            JsonNode response = restClientBuilder.build()
                .get()
                .uri(url)
                .header("Authorization", "Bearer " + token)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new OpenBankingApiException(
                        "GoCardless listInstitutions HTTP " + res.getStatusCode() + " : " + readBody(res.getBody()));
                })
                .body(JsonNode.class);

            if (response == null || !response.isArray()) {
                throw new OpenBankingApiException("GoCardless listInstitutions : reponse vide ou invalide");
            }

            List<InstitutionInfo> institutions = new java.util.ArrayList<>();
            for (JsonNode node : response) {
                String id = textOrNull(node, "id");
                String name = textOrNull(node, "name");
                String logo = textOrNull(node, "logo");
                if (id != null && name != null) {
                    institutions.add(new InstitutionInfo(id, name, logo));
                }
            }
            // Tri alphabétique par name pour stabilité de l'affichage
            institutions.sort(java.util.Comparator.comparing(InstitutionInfo::name, String.CASE_INSENSITIVE_ORDER));

            institutionsCache.put(key, new InstitutionCacheEntry(institutions, Instant.now().plusSeconds(3600)));
            log.info("GoCardless institutions chargees : {} banques pour pays={}", institutions.size(), key);
            return institutions;
        } catch (OpenBankingApiException e) {
            throw e;
        } catch (Exception e) {
            throw new OpenBankingApiException("GoCardless listInstitutions failed: " + e.getMessage(), e);
        }
    }

    /** Cache d'institutions par pays. TTL 1h. */
    private final Map<String, InstitutionCacheEntry> institutionsCache = new ConcurrentHashMap<>();

    private record InstitutionCacheEntry(List<InstitutionInfo> institutions, Instant expiresAt) {}

    /** Information minimale d'une banque GoCardless. */
    public record InstitutionInfo(String id, String name, String logo) {}

    /** Obtient (ou rafraîchit) un access token GoCardless. */
    private synchronized String getAccessToken() {
        if (cachedToken != null && cachedTokenExpiry != null
            && cachedTokenExpiry.isAfter(Instant.now().plusSeconds(60))) {
            return cachedToken;
        }

        String url = BASE_URL + "/api/v2/token/new/";
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("secret_id", secretId);
        body.put("secret_key", secretKey);

        try {
            JsonNode response = restClientBuilder.build()
                .post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class);

            if (response == null) {
                throw new OpenBankingApiException("GoCardless token : empty response");
            }
            String access = textOrNull(response, "access");
            int accessExpires = response.has("access_expires") ? response.get("access_expires").asInt() : 86400;
            if (access == null) {
                throw new OpenBankingApiException("GoCardless token : access token absent");
            }
            this.cachedToken = access;
            this.cachedTokenExpiry = Instant.now().plusSeconds(accessExpires);
            return access;
        } catch (OpenBankingApiException e) {
            throw e;
        } catch (Exception e) {
            throw new OpenBankingApiException("GoCardless token failed: " + e.getMessage(), e);
        }
    }

    private static String textOrNull(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode v = node.get(field);
        return v != null && !v.isNull() ? v.asText() : null;
    }

    private static String readBody(java.io.InputStream in) {
        try { return new String(in.readAllBytes()); }
        catch (Exception e) { return "<unable to read body>"; }
    }

    public record RequisitionResult(String requisitionId, String redirectLink) {}

    public static class OpenBankingApiException extends RuntimeException {
        public OpenBankingApiException(String message) { super(message); }
        public OpenBankingApiException(String message, Throwable cause) { super(message, cause); }
    }
}
