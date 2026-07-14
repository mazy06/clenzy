package com.clenzy.controller;

import com.clenzy.dto.WhatsAppTemplateContentDto;
import com.clenzy.dto.WhatsAppTemplateGroupDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.WhatsAppTemplateContent;
import com.clenzy.service.messaging.TemplateInterpolationService;
import com.clenzy.service.messaging.whatsapp.WhatsAppTemplateService;
import com.clenzy.service.messaging.whatsapp.WhatsAppVariableConverter;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * CRUD des templates WhatsApp editables pour l'organisation courante.
 *
 * <h3>Resolution org/systeme</h3>
 * Les endpoints retournent la vue "effective" pour l'org : si l'org a un
 * override pour {@code (templateKey, language)}, il est retourne ; sinon le
 * template systeme global Clenzy. Voir
 * {@link WhatsAppTemplateService#listGroupedForOrg} pour le detail.
 *
 * <h3>Securite</h3>
 * {@link PreAuthorize}{@code ("isAuthenticated()")} au niveau classe.
 * L'isolation per-org est garantie par {@link TenantContext#getRequiredOrganizationId}
 * (rejette avec 403 si pas d'org dans le JWT) + les requetes du repository qui
 * filtrent explicitement sur organizationId.
 *
 * <h3>Endpoints</h3>
 * <ul>
 *   <li>{@code GET /} : liste groupee par templateKey (UI principale)</li>
 *   <li>{@code GET /{key}} : detail d'un template (3 langues)</li>
 *   <li>{@code PUT /{key}/{language}} : cree/met a jour un override per-org</li>
 *   <li>{@code DELETE /{key}/{language}} : supprime l'override → retour systeme</li>
 *   <li>{@code POST /{key}/{language}/preview} : render avec valeurs mock</li>
 *   <li>{@code GET /variables} : liste des variables supportees (i18n)</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/whatsapp-templates")
@PreAuthorize("isAuthenticated()")
public class WhatsAppTemplateController {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppTemplateController.class);

    private final WhatsAppTemplateService templateService;
    private final WhatsAppVariableConverter converter;
    private final TenantContext tenantContext;

    public WhatsAppTemplateController(WhatsAppTemplateService templateService,
                                        WhatsAppVariableConverter converter,
                                        TenantContext tenantContext) {
        this.templateService = templateService;
        this.converter = converter;
        this.tenantContext = tenantContext;
    }

    /**
     * Retourne la liste de TOUS les templates visibles par l'org (systeme +
     * overrides), groupes par templateKey. Pour chaque groupe, indique si l'org
     * a personnalise au moins une langue.
     */
    @GetMapping
    public List<WhatsAppTemplateGroupDto> listGrouped() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Map<String, Map<String, WhatsAppTemplateContent>> grouped = templateService.listGroupedForOrg(orgId);

        return grouped.entrySet().stream()
            .map(entry -> toGroupDto(entry.getKey(), entry.getValue(), orgId))
            .toList();
    }

    /**
     * Detail d'un template (3 langues). 404 si la cle est inconnue cote systeme
     * et que l'org n'a pas d'override.
     */
    @GetMapping("/{key}")
    public ResponseEntity<WhatsAppTemplateGroupDto> getByKey(@PathVariable String key) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Map<String, Map<String, WhatsAppTemplateContent>> grouped = templateService.listGroupedForOrg(orgId);

        Map<String, WhatsAppTemplateContent> languages = grouped.get(key);
        if (languages == null || languages.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toGroupDto(key, languages, orgId));
    }

    /**
     * Cree ou met a jour un override per-org pour une langue donnee.
     * Body : {@code { "bodyNamed": "Bonjour {guestFirstName} ..." }}.
     *
     * <p>Si pas d'override existant pour {@code (key, language)} : cree une
     * nouvelle ligne (fork du template systeme parent). Sinon : update le body.</p>
     */
    @PutMapping("/{key}/{language}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','ADMIN','HOST')")
    public ResponseEntity<WhatsAppTemplateContentDto> upsertOverride(
            @PathVariable String key,
            @PathVariable String language,
            @RequestBody UpsertOverrideRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        try {
            WhatsAppTemplateContent saved = templateService.upsertOverride(
                orgId, key, language, request.bodyNamed());
            List<String> variables = converter.extractVariables(saved.getBodyNamed());
            log.info("Override WhatsApp template upsert : org={} key={} lang={}", orgId, key, language);
            return ResponseEntity.ok(WhatsAppTemplateContentDto.fromEntity(saved, variables));
        } catch (NotFoundException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Supprime l'override per-org → l'org retombe sur le template systeme.
     * 404 si pas d'override (rien a supprimer).
     */
    @DeleteMapping("/{key}/{language}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','ADMIN','HOST')")
    public ResponseEntity<Void> removeOverride(@PathVariable String key, @PathVariable String language) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        try {
            templateService.removeOverride(orgId, key, language);
            log.info("Override WhatsApp template delete : org={} key={} lang={}", orgId, key, language);
            return ResponseEntity.noContent().build();
        } catch (NotFoundException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Preview : substitue les variables {nameVar} dans le body courant avec les
     * valeurs mock fournies. Permet a l'UI de montrer un rendu "comme envoye"
     * sans devoir simuler une vraie reservation.
     *
     * <p>Body de la requete : {@code { "mockValues": { "guestFirstName": "Marie", "accessCode": "1234" } }}.
     * Les variables non fournies sont laissees telles quelles (visibles dans le preview).</p>
     */
    @PostMapping("/{key}/{language}/preview")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','ADMIN','HOST')")
    public ResponseEntity<PreviewResponse> preview(
            @PathVariable String key,
            @PathVariable String language,
            @RequestBody PreviewRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        return templateService.resolve(orgId, key, language)
            .map(template -> {
                String rendered = interpolateMockValues(template.getBodyNamed(), request.mockValues());
                return ResponseEntity.ok(new PreviewResponse(rendered));
            })
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Liste des variables supportees par {@link TemplateInterpolationService}.
     * Permet au frontend de proposer une sidebar de variables a cliquer pour
     * insertion (UX MessageTemplateEditor existante).
     */
    @GetMapping("/variables")
    public List<TemplateInterpolationService.TemplateVariable> getVariables() {
        return TemplateInterpolationService.SUPPORTED_VARIABLES;
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    private WhatsAppTemplateGroupDto toGroupDto(String templateKey,
                                                  Map<String, WhatsAppTemplateContent> languages,
                                                  Long requesterOrgId) {
        // Map ordonnee fr_FR / en_US / ar_AR (l'ordre du LinkedHashMap retourne
        // par le service est deja par insertion stable).
        Map<String, WhatsAppTemplateContentDto> langDtos = new LinkedHashMap<>();
        String category = null;
        boolean isCustomized = false;

        for (Map.Entry<String, WhatsAppTemplateContent> entry : languages.entrySet()) {
            WhatsAppTemplateContent content = entry.getValue();
            if (category == null) {
                category = content.getCategory();
            }
            if (content.getOrganizationId() != null && content.getOrganizationId().equals(requesterOrgId)) {
                isCustomized = true;
            }
            List<String> variables = converter.extractVariables(content.getBodyNamed());
            langDtos.put(entry.getKey(), WhatsAppTemplateContentDto.fromEntity(content, variables));
        }

        return new WhatsAppTemplateGroupDto(templateKey, category, isCustomized, langDtos);
    }

    /**
     * Substitue {@code {nameVar}} → valeur mock. Variables non fournies sont
     * laissees telles quelles pour que l'UI mette en evidence "preview non
     * complet".
     */
    private String interpolateMockValues(String body, Map<String, String> mockValues) {
        if (body == null || body.isEmpty()) return "";
        if (mockValues == null || mockValues.isEmpty()) return body;

        String result = body;
        for (Map.Entry<String, String> entry : mockValues.entrySet()) {
            String placeholder = "{" + entry.getKey() + "}";
            // Echappement XSS basique : on remplace par la valeur sans interpretation
            // HTML (le frontend doit afficher en text plain de toute facon — c'est
            // un message WhatsApp, pas une page web).
            result = result.replace(placeholder, entry.getValue() != null ? entry.getValue() : "");
        }
        return result;
    }

    // ─── Request/response payloads ───────────────────────────────────

    /** Payload pour PUT /{key}/{language}. */
    public record UpsertOverrideRequest(
        @NotBlank @Size(max = 1024) String bodyNamed
    ) {}

    /** Payload pour POST /{key}/{language}/preview. */
    public record PreviewRequest(
        Map<String, String> mockValues
    ) {}

    /** Reponse de preview : body apres substitution. */
    public record PreviewResponse(String renderedBody) {}
}
