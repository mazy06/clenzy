package com.clenzy.controller;

import com.clenzy.dto.SystemEmailTemplateDto;
import com.clenzy.dto.SystemEmailTemplateGroupDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.SystemEmailTemplate;
import com.clenzy.service.messaging.SystemEmailTemplateService;
import com.clenzy.service.messaging.TemplateInterpolationService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * CRUD des templates email systeme editables pour l'organisation courante.
 *
 * <p>Memes principes que {@link WhatsAppTemplateController} :</p>
 * <ul>
 *   <li>Resolution org/systeme automatique (override > systeme)</li>
 *   <li>{@code @PreAuthorize("isAuthenticated()")} au niveau classe (lecture)</li>
 *   <li>Isolation per-org via {@link TenantContext#getRequiredOrganizationId}</li>
 * </ul>
 *
 * <h3>Endpoints</h3>
 * <ul>
 *   <li>{@code GET /} : liste groupee par templateKey</li>
 *   <li>{@code GET /{key}} : detail (multi-langues)</li>
 *   <li>{@code PUT /{key}/{language}} : cree/met a jour un override per-org</li>
 *   <li>{@code DELETE /{key}/{language}} : supprime l'override → retour systeme</li>
 * </ul>
 *
 * <h3>Securite (stored XSS / phishing email)</h3>
 * <p>Le body des overrides est emis dans des emails transactionnels recus par
 * des tiers (proprietaires, voyageurs). L'ecriture (PUT/DELETE) est donc
 * restreinte aux roles d'administration d'org — SUPER_ADMIN, SUPER_MANAGER,
 * ADMIN, HOST — jamais aux roles operationnels (TECHNICIAN, HOUSEKEEPER,
 * SUPERVISOR…). Le body est en outre sanitise cote service
 * ({@link com.clenzy.util.EmailHtmlSanitizer}) au stockage ET au rendu.</p>
 */
@RestController
@RequestMapping("/api/system-email-templates")
@PreAuthorize("isAuthenticated()")
public class SystemEmailTemplateController {

    private static final Logger log = LoggerFactory.getLogger(SystemEmailTemplateController.class);

    /** Pattern pour extraire les variables {nameVar} d'un texte (subject + body). */
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{([a-zA-Z][a-zA-Z0-9_]*)}");

    private final SystemEmailTemplateService templateService;
    private final TenantContext tenantContext;

    public SystemEmailTemplateController(SystemEmailTemplateService templateService,
                                           TenantContext tenantContext) {
        this.templateService = templateService;
        this.tenantContext = tenantContext;
    }

    /** Liste tous les templates visibles par l'org (systeme + overrides), groupes par cle. */
    @GetMapping
    public List<SystemEmailTemplateGroupDto> listGrouped() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Map<String, Map<String, SystemEmailTemplate>> grouped = templateService.listGroupedForOrg(orgId);

        return grouped.entrySet().stream()
            .map(entry -> toGroupDto(entry.getKey(), entry.getValue(), orgId))
            .toList();
    }

    /** Detail d'un template (toutes ses langues). */
    @GetMapping("/{key}")
    public ResponseEntity<SystemEmailTemplateGroupDto> getByKey(@PathVariable String key) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Map<String, Map<String, SystemEmailTemplate>> grouped = templateService.listGroupedForOrg(orgId);

        Map<String, SystemEmailTemplate> languages = grouped.get(key);
        if (languages == null || languages.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toGroupDto(key, languages, orgId));
    }

    /**
     * Cree ou met a jour un override per-org pour une langue donnee.
     * Body : {@code { "subject": "...", "body": "..." }}.
     * Reserve aux roles d'administration d'org (cf. javadoc classe).
     */
    @PutMapping("/{key}/{language}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','ADMIN','HOST')")
    public ResponseEntity<SystemEmailTemplateDto> upsertOverride(
            @PathVariable String key,
            @PathVariable String language,
            @RequestBody UpsertOverrideRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        try {
            SystemEmailTemplate saved = templateService.upsertOverride(
                orgId, key, language, request.subject(), request.body());
            log.info("Override email template upsert : org={} key={} lang={}", orgId, key, language);
            return ResponseEntity.ok(SystemEmailTemplateDto.fromEntity(saved, extractVariables(saved)));
        } catch (NotFoundException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /** Supprime l'override per-org → retour au defaut systeme. Reserve aux roles d'administration d'org. */
    @DeleteMapping("/{key}/{language}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','ADMIN','HOST')")
    public ResponseEntity<Void> removeOverride(@PathVariable String key, @PathVariable String language) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        try {
            templateService.removeOverride(orgId, key, language);
            log.info("Override email template delete : org={} key={} lang={}", orgId, key, language);
            return ResponseEntity.noContent().build();
        } catch (NotFoundException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Liste des variables supportees par {@link TemplateInterpolationService}.
     * Reutilise la meme liste que pour les templates WhatsApp et MessageTemplate
     * pour une coherence d'UX.
     */
    @GetMapping("/variables")
    public List<TemplateInterpolationService.TemplateVariable> getVariables() {
        return TemplateInterpolationService.SUPPORTED_VARIABLES;
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    private SystemEmailTemplateGroupDto toGroupDto(String templateKey,
                                                     Map<String, SystemEmailTemplate> languages,
                                                     Long requesterOrgId) {
        Map<String, SystemEmailTemplateDto> langDtos = new LinkedHashMap<>();
        String recipientType = null;
        boolean isCustomized = false;

        for (Map.Entry<String, SystemEmailTemplate> entry : languages.entrySet()) {
            SystemEmailTemplate content = entry.getValue();
            if (recipientType == null) {
                recipientType = content.getRecipientType();
            }
            if (content.getOrganizationId() != null && content.getOrganizationId().equals(requesterOrgId)) {
                isCustomized = true;
            }
            langDtos.put(entry.getKey(), SystemEmailTemplateDto.fromEntity(content, extractVariables(content)));
        }

        return new SystemEmailTemplateGroupDto(templateKey, recipientType, isCustomized, langDtos);
    }

    /**
     * Extrait les variables {nameVar} uniques de subject + body, dans l'ordre
     * de premiere apparition. Permet a l'UI d'afficher "Ce template utilise :
     * guestName, propertyName, …" sans dupliquer le regex cote client.
     */
    private List<String> extractVariables(SystemEmailTemplate template) {
        LinkedHashSet<String> vars = new LinkedHashSet<>();
        extractInto(vars, template.getSubject());
        extractInto(vars, template.getBody());
        return vars.stream().toList();
    }

    private void extractInto(LinkedHashSet<String> set, String text) {
        if (text == null) return;
        Matcher m = VARIABLE_PATTERN.matcher(text);
        while (m.find()) {
            set.add(m.group(1));
        }
    }

    // ─── Request payload ─────────────────────────────────────────────

    public record UpsertOverrideRequest(
        @NotBlank @Size(max = 255) String subject,
        @NotBlank @Size(max = 100000) String body
    ) {}
}
