package com.clenzy.service.messaging.whatsapp;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Service qui orchestre le flow OAuth Meta Embedded Signup :
 *
 * <ol>
 *   <li><b>exchangeCodeForToken</b> : code court-vie (popup Meta) -> access_token long-vie</li>
 *   <li><b>fetchWabaAndPhoneNumber</b> : appel /me/businesses + /{waba_id}/phone_numbers pour
 *       resolver le WhatsApp Business Account et le phone_number_id que l'host vient
 *       de provisionner</li>
 *   <li><b>provisionConfig</b> : UPSERT atomique dans whatsapp_configs (provider=META,
 *       apiToken chiffre, businessAccountId, phoneNumberId, enabled=true)</li>
 * </ol>
 *
 * <h3>Gestion d'erreurs</h3>
 * Toute exception (Meta API down, code expire, WABA introuvable) remonte en
 * {@link MetaSignupException} qui sera convertie en HTTP 503 par le controller.
 * Pas de rollback DB nécessaire car le provisionConfig est en derniere etape
 * et atomique (UPSERT JPA).
 *
 * <h3>Securite</h3>
 * Le {@code app-secret} ne quitte JAMAIS le backend — utilise uniquement pour
 * l'echange code/token, pas exposé au frontend. L'{@code app-id} et le
 * {@code config-id} sont publics (necessaires cote SDK FB JS).
 */
@Service
public class MetaSignupService {

    private static final Logger log = LoggerFactory.getLogger(MetaSignupService.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final WhatsAppConfigRepository configRepository;
    private final MetaTemplateProvisioner templateProvisioner;

    private final String appId;
    private final String appSecret;
    private final String configId;
    private final String graphApiBase;
    private final String oauthTokenUrl;
    private final String redirectUri;

    public MetaSignupService(
            ObjectMapper objectMapper,
            WhatsAppConfigRepository configRepository,
            MetaTemplateProvisioner templateProvisioner,
            @Value("${clenzy.whatsapp.meta.app-id:}") String appId,
            @Value("${clenzy.whatsapp.meta.app-secret:}") String appSecret,
            @Value("${clenzy.whatsapp.meta.embedded-signup-config-id:}") String configId,
            @Value("${clenzy.whatsapp.meta.graph-api-base:https://graph.facebook.com/v23.0}") String graphApiBase,
            @Value("${clenzy.whatsapp.meta.oauth-token-url:https://graph.facebook.com/v23.0/oauth/access_token}") String oauthTokenUrl,
            // En Embedded Signup, redirect_uri est typiquement vide (popup mode) — mais
            // Meta exige qu'il soit egal a celui defini dans App Dashboard si non vide.
            // Default = empty string pour le popup mode.
            @Value("${clenzy.whatsapp.meta.redirect-uri:}") String redirectUri) {
        this.restTemplate = new RestTemplate();
        this.objectMapper = objectMapper;
        this.configRepository = configRepository;
        this.templateProvisioner = templateProvisioner;
        this.appId = appId;
        this.appSecret = appSecret;
        this.configId = configId;
        this.graphApiBase = graphApiBase;
        this.oauthTokenUrl = oauthTokenUrl;
        this.redirectUri = redirectUri;
    }

    /**
     * Retourne la config publique necessaire au SDK FB JS cote frontend.
     * App-secret n'est PAS expose (server-only).
     */
    public Map<String, Object> getPublicAppConfig() {
        ensureConfigured();
        Map<String, Object> result = new HashMap<>();
        result.put("appId", appId);
        result.put("configId", configId);
        // Version derivee du graphApiBase pour que le frontend init FB.init avec
        // la meme version que celle utilisee server-side (coherence).
        result.put("graphApiVersion", extractGraphVersion(graphApiBase));
        return result;
    }

    /**
     * Echange le code court-vie (recu du popup Meta) contre un access_token
     * long-vie, puis resout le WABA + phone number associes, puis provisionne
     * whatsapp_configs pour l'org.
     *
     * @return resultat enrichi pour le frontend (phoneNumber, wabaId, etc.)
     * @throws MetaSignupException si une etape echoue
     */
    public SignupResult completeSignup(String code, Long organizationId) {
        ensureConfigured();
        if (code == null || code.isBlank()) {
            throw new MetaSignupException("Code OAuth manquant ou invalide");
        }

        // Etape 1 : code -> access_token
        String accessToken = exchangeCodeForToken(code);

        // Etape 2 : resoudre WABA + phone number
        WabaInfo waba = resolveWaba(accessToken);

        // Etape 3 : persist
        WhatsAppConfig saved = provisionConfig(organizationId, accessToken, waba);

        // Etape 4 : auto-submit des 5 templates Clenzy standards au WABA.
        // Best-effort : si une template echoue (nom deja pris, quota Meta atteint),
        // on logue mais on ne fait pas echouer le signup global — l'host peut
        // toujours les soumettre manuellement plus tard via Settings.
        int templatesSubmitted = 0;
        try {
            MetaTemplateProvisioner.ProvisionResult provisionResult = templateProvisioner.provisionAll(saved);
            templatesSubmitted = provisionResult.submitted();
            log.info("Templates Meta provisiones pour org {} : {} OK / {} KO",
                organizationId, provisionResult.submitted(), provisionResult.failed());
        } catch (Exception e) {
            log.warn("Echec global provisioning templates pour org {} : {}", organizationId, e.getMessage());
        }

        log.info("Meta Embedded Signup OK pour org {} : WABA {} / phone {} / {} templates submitted",
            organizationId, waba.wabaId, waba.displayPhoneNumber, templatesSubmitted);

        return new SignupResult(
            true,
            waba.displayPhoneNumber,
            waba.wabaId,
            waba.phoneNumberId,
            saved.getId(),
            templatesSubmitted);
    }

    // ─── Etapes internes ──────────────────────────────────────────────

    /**
     * POST {oauth_token_url}?client_id={appId}&client_secret={appSecret}&code={code}
     * &redirect_uri={redirectUri}
     *
     * @return access_token long-vie (60 jours par defaut, renouvelable)
     */
    private String exchangeCodeForToken(String code) {
        try {
            String url = UriComponentsBuilder.fromHttpUrl(oauthTokenUrl)
                .queryParam("client_id", appId)
                .queryParam("client_secret", appSecret)
                .queryParam("code", code)
                .queryParam("redirect_uri", redirectUri)
                .build()
                .toUriString();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.GET, new HttpEntity<>(headers), String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new MetaSignupException("Echec exchange code Meta: " + response.getStatusCode());
            }

            JsonNode body = objectMapper.readTree(response.getBody());
            String token = body.path("access_token").asText("");
            if (token.isBlank()) {
                throw new MetaSignupException("Reponse Meta sans access_token");
            }
            return token;
        } catch (MetaSignupException e) {
            throw e;
        } catch (Exception e) {
            log.error("Erreur exchange code Meta: {}", e.getMessage());
            throw new MetaSignupException("Impossible d'echanger le code Meta: " + e.getMessage(), e);
        }
    }

    /**
     * Resout le WABA et le phone number associes au token. Pour Embedded Signup,
     * l'host vient de creer/selectionner UN WABA et UN phone — on prend les
     * premiers (cas standard) mais on logue si plusieurs (cas a gerer en suivi).
     */
    private WabaInfo resolveWaba(String accessToken) {
        try {
            // 1. List businesses du user
            String businessesUrl = graphApiBase + "/me/businesses";
            ResponseEntity<String> bizResp = restTemplate.exchange(
                businessesUrl, HttpMethod.GET, withBearer(accessToken), String.class);
            JsonNode bizBody = objectMapper.readTree(bizResp.getBody());
            JsonNode businesses = bizBody.path("data");
            if (!businesses.isArray() || businesses.isEmpty()) {
                throw new MetaSignupException("Aucun Business Manager trouve pour cet utilisateur Meta");
            }
            String businessId = businesses.get(0).path("id").asText();

            // 2. List WABAs du business
            String wabasUrl = graphApiBase + "/" + businessId + "/owned_whatsapp_business_accounts";
            ResponseEntity<String> wabaResp = restTemplate.exchange(
                wabasUrl, HttpMethod.GET, withBearer(accessToken), String.class);
            JsonNode wabaBody = objectMapper.readTree(wabaResp.getBody());
            JsonNode wabas = wabaBody.path("data");
            if (!wabas.isArray() || wabas.isEmpty()) {
                throw new MetaSignupException("Aucun WhatsApp Business Account trouve");
            }
            String wabaId = wabas.get(0).path("id").asText();

            // 3. List phone numbers du WABA
            String phonesUrl = graphApiBase + "/" + wabaId + "/phone_numbers";
            ResponseEntity<String> phonesResp = restTemplate.exchange(
                phonesUrl, HttpMethod.GET, withBearer(accessToken), String.class);
            JsonNode phonesBody = objectMapper.readTree(phonesResp.getBody());
            JsonNode phones = phonesBody.path("data");
            if (!phones.isArray() || phones.isEmpty()) {
                throw new MetaSignupException(
                    "Aucun numero WhatsApp Business trouve dans le WABA. " +
                    "L'host doit en ajouter un et le verifier avant d'integrer Clenzy.");
            }
            JsonNode firstPhone = phones.get(0);
            String phoneNumberId = firstPhone.path("id").asText();
            String displayPhoneNumber = firstPhone.path("display_phone_number").asText("");

            return new WabaInfo(wabaId, phoneNumberId, displayPhoneNumber);
        } catch (MetaSignupException e) {
            throw e;
        } catch (Exception e) {
            log.error("Erreur resolution WABA Meta: {}", e.getMessage());
            throw new MetaSignupException("Impossible de resoudre le WABA Meta: " + e.getMessage(), e);
        }
    }

    /**
     * UPSERT atomique de WhatsAppConfig pour l'org. Le converter JPA Jasypt
     * chiffre automatiquement apiToken au persist.
     */
    private WhatsAppConfig provisionConfig(Long organizationId, String accessToken, WabaInfo waba) {
        // Compte WhatsApp GLOBAL (singleton plateforme) : la config n'est plus par-org.
        // organizationId reste passe pour les templates/logs, mais la config cible la
        // ligne globale (organization_id NULL).
        WhatsAppConfig config = configRepository.findFirstByOrganizationIdIsNull()
            .orElseGet(() -> {
                WhatsAppConfig c = new WhatsAppConfig();
                c.setOrganizationId(null); // ligne globale
                return c;
            });
        config.setProvider(WhatsAppProviderType.META);
        config.setApiToken(accessToken);
        config.setBusinessAccountId(waba.wabaId);
        config.setPhoneNumberId(waba.phoneNumberId);
        config.setEnabled(true);
        return configRepository.save(config);
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    private void ensureConfigured() {
        if (appId == null || appId.isBlank() || appSecret == null || appSecret.isBlank()
                || configId == null || configId.isBlank()) {
            throw new MetaSignupException(
                "Meta Embedded Signup non configure cote serveur (META_APP_ID / META_APP_SECRET / META_EMBEDDED_SIGNUP_CONFIG_ID manquants). " +
                "Cf. docs/meta-app-review/README.md pour le setup.");
        }
    }

    private HttpEntity<Void> withBearer(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        return new HttpEntity<>(headers);
    }

    private String extractGraphVersion(String graphApiBase) {
        // Extrait "v18.0" de "https://graph.facebook.com/v18.0"
        if (graphApiBase == null) return "v18.0";
        int idx = graphApiBase.lastIndexOf("/v");
        if (idx == -1) return "v18.0";
        return graphApiBase.substring(idx + 1);
    }

    // ─── Types ──────────────────────────────────────────────────────

    /** Resultat enrichi pour le frontend. Inclut le nombre de templates
     *  submitted a Meta pour afficher dans la confirmation success.
     *  Note : les templates sont en statut PENDING cote Meta, l'host pourra
     *  les utiliser quand approuves (~24h). */
    public record SignupResult(
        boolean success,
        String phoneNumber,
        String wabaId,
        String phoneNumberId,
        Long configId,
        int templatesSubmitted
    ) {}

    /** Snapshot WABA + phone resolu par /me/businesses + /phone_numbers. */
    private record WabaInfo(String wabaId, String phoneNumberId, String displayPhoneNumber) {}

    /** Exception applicative — convertie en HTTP 503 par le controller. */
    public static class MetaSignupException extends RuntimeException {
        public MetaSignupException(String message) { super(message); }
        public MetaSignupException(String message, Throwable cause) { super(message, cause); }
    }
}
