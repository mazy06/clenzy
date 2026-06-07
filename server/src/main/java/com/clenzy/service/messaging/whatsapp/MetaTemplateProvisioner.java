package com.clenzy.service.messaging.whatsapp;

import com.clenzy.model.OrgWhatsAppTemplate;
import com.clenzy.model.WhatsAppConfig;
import com.clenzy.repository.OrgWhatsAppTemplateRepository;
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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Soumet automatiquement les 5 templates Clenzy standards a un WABA Meta apres
 * un signup Embedded reussi.
 *
 * <h3>Flow</h3>
 * <ol>
 *   <li>Pour chaque template charge par {@link WhatsAppTemplateLoader}</li>
 *   <li>Pour chaque langue du template (fr_FR, en_US, ar_AR)</li>
 *   <li>POST {@code /{waba_id}/message_templates} avec le body, le name
 *       (ex: "clenzy_booking_confirmation_v1"), la category UTILITY,
 *       et les components (body avec parametres)</li>
 *   <li>Persist le mapping dans {@code org_whatsapp_templates} (key + language
 *       + template_name) pour que les services applicatifs ({@code BriefingDelivery},
 *       {@code GuestMessagingService}) puissent les utiliser</li>
 * </ol>
 *
 * <h3>Resilience</h3>
 * Best-effort : une erreur sur un template (ex: nom deja existant) n'arrete pas
 * le batch. Resultats agreges dans {@link ProvisionResult} pour reporting frontend.
 *
 * <h3>Note Meta</h3>
 * Templates submitted = statut PENDING. Meta met ~24h a les approuver
 * (parfois <1h). L'host peut envoyer des messages utility uniquement quand
 * APPROVED. Le statut est interrogeable via {@code GET /{waba_id}/message_templates}
 * — exposé en suivi (Phase 5) si besoin de polling automatique.
 */
@Service
public class MetaTemplateProvisioner {

    private static final Logger log = LoggerFactory.getLogger(MetaTemplateProvisioner.class);

    private final WhatsAppTemplateLoader templateLoader;
    private final OrgWhatsAppTemplateRepository orgTemplateRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String graphApiBase;

    public MetaTemplateProvisioner(
            WhatsAppTemplateLoader templateLoader,
            OrgWhatsAppTemplateRepository orgTemplateRepository,
            ObjectMapper objectMapper,
            @Value("${clenzy.whatsapp.meta.graph-api-base:https://graph.facebook.com/v23.0}") String graphApiBase) {
        this.templateLoader = templateLoader;
        this.orgTemplateRepository = orgTemplateRepository;
        this.restTemplate = new RestTemplate();
        this.objectMapper = objectMapper;
        this.graphApiBase = graphApiBase;
    }

    /**
     * Soumet tous les templates standards Clenzy au WABA de l'org.
     * Best-effort : les erreurs individuelles sont loguees mais ne stoppent
     * pas le batch global.
     *
     * @return resume agrege (submitted/failed counts + details)
     */
    public ProvisionResult provisionAll(WhatsAppConfig config) {
        if (config.getBusinessAccountId() == null || config.getBusinessAccountId().isBlank()) {
            log.warn("Skip provisioning templates : pas de WABA pour l'org {}", config.getOrganizationId());
            return new ProvisionResult(0, 0, List.of());
        }
        if (config.getApiToken() == null || config.getApiToken().isBlank()) {
            log.warn("Skip provisioning templates : pas d'apiToken pour l'org {}", config.getOrganizationId());
            return new ProvisionResult(0, 0, List.of());
        }

        List<WhatsAppTemplateDefinition> templates = templateLoader.getAllTemplates();
        if (templates.isEmpty()) {
            log.warn("Aucun template Clenzy charge — rien a provisioner pour l'org {}", config.getOrganizationId());
            return new ProvisionResult(0, 0, List.of());
        }

        List<TemplateResult> results = new ArrayList<>();
        int submitted = 0;
        int failed = 0;

        for (WhatsAppTemplateDefinition def : templates) {
            // Pour chaque langue du template, on submit + persist mapping
            for (Map.Entry<String, WhatsAppTemplateDefinition.LanguageBody> langEntry : def.languages().entrySet()) {
                String language = langEntry.getKey();
                String body = langEntry.getValue().body();
                String templateName = def.metaTemplateName();

                try {
                    submitToMeta(config, templateName, language, body, def.category());
                    persistMapping(config.getOrganizationId(), def.key(), templateName, language);
                    submitted++;
                    results.add(new TemplateResult(def.key(), language, templateName, "SUBMITTED", null));
                    log.info("Template Meta soumis : {} ({}) pour org {}",
                        templateName, language, config.getOrganizationId());
                } catch (Exception e) {
                    failed++;
                    String errorMsg = extractErrorMessage(e);
                    results.add(new TemplateResult(def.key(), language, templateName, "FAILED", errorMsg));
                    log.warn("Echec submission template Meta {} ({}) pour org {} : {}",
                        templateName, language, config.getOrganizationId(), errorMsg);
                }
            }
        }

        log.info("Provisioning templates Meta termine pour org {} : {} succes / {} echecs",
            config.getOrganizationId(), submitted, failed);
        return new ProvisionResult(submitted, failed, results);
    }

    // ─── Internes ──────────────────────────────────────────────────

    private void submitToMeta(WhatsAppConfig config, String templateName, String language, String body, String category) {
        String url = graphApiBase + "/" + config.getBusinessAccountId() + "/message_templates";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(config.getApiToken());

        // Construction du payload Meta selon le format documente
        // https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
        Map<String, Object> bodyComponent = Map.of(
            "type", "BODY",
            "text", body
        );
        Map<String, Object> payload = new HashMap<>();
        payload.put("name", templateName);
        payload.put("language", language);
        payload.put("category", category);
        payload.put("components", List.of(bodyComponent));

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, request, String.class);

        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new RuntimeException("Meta a refuse le template : " + response.getStatusCode());
        }
        // Meta renvoie { id, status: "PENDING", category }
        // On ne persiste pas le meta_template_id en MVP — peut etre ajoute en
        // Phase 5 si polling status approval necessaire.
    }

    /**
     * Persist le mapping cle_logique → template_name dans org_whatsapp_templates.
     * Si un mapping existe deja (re-signup), on update plutot que doublonner.
     */
    private void persistMapping(Long orgId, String key, String templateName, String language) {
        // OrgWhatsAppTemplate a une UNIQUE (organization_id, template_key) —
        // donc on garde 1 ligne par cle (la derniere langue submitted gagne).
        // Pour MVP c'est OK : l'host configurera sa langue preferee dans Settings.
        OrgWhatsAppTemplate existing = orgTemplateRepository
            .findByOrganizationIdAndTemplateKey(orgId, key)
            .orElseGet(() -> new OrgWhatsAppTemplate(orgId, key, templateName, language));
        existing.setTemplateName(templateName);
        existing.setTemplateLanguage(language);
        orgTemplateRepository.save(existing);
    }

    /**
     * Extrait le message d'erreur Meta du body de la response, sinon retourne
     * le message d'exception brut. Format Meta typique :
     * {@code { "error": { "message": "...", "code": 123, "fbtrace_id": "..." } }}
     */
    private String extractErrorMessage(Exception e) {
        String raw = e.getMessage();
        if (raw == null) return "Erreur inconnue";
        // Si l'exception contient un body JSON Meta, essayer de l'extraire
        int idx = raw.indexOf("{\"error\"");
        if (idx != -1) {
            try {
                JsonNode error = objectMapper.readTree(raw.substring(idx)).path("error");
                String message = error.path("message").asText("");
                if (!message.isBlank()) return message;
            } catch (Exception ignored) { /* fallback raw message */ }
        }
        return raw.length() > 200 ? raw.substring(0, 200) + "..." : raw;
    }

    // ─── Types ──────────────────────────────────────────────────

    /** Resultat agrege du batch provisioning, pour reporting frontend. */
    public record ProvisionResult(
        int submitted,
        int failed,
        List<TemplateResult> details
    ) {}

    /** Resultat unitaire par template+langue. */
    public record TemplateResult(
        String key,
        String language,
        String templateName,
        String status, // SUBMITTED | FAILED
        String errorMessage // null si status=SUBMITTED
    ) {}
}
