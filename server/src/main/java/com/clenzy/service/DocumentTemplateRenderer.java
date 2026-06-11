package com.clenzy.service;

import com.clenzy.exception.DocumentGenerationException;
import com.clenzy.exception.DocumentStorageException;
import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentTemplateTag;
import fr.opensagres.xdocreport.document.IXDocReport;
import fr.opensagres.xdocreport.document.registry.XDocReportRegistry;
import fr.opensagres.xdocreport.template.IContext;
import fr.opensagres.xdocreport.template.TemplateEngineKind;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Rendu des templates de documents : resolution du contenu binaire (.odt),
 * remplissage Freemarker via XDocReport et validation de la presence des tags.
 * <p>
 * Extrait de {@link DocumentGeneratorService} (refactor SRP) — comportement
 * strictement identique. Utilise par le pipeline de generation, la preview
 * et la gestion des templates.
 */
@Component
public class DocumentTemplateRenderer {

    private static final Logger log = LoggerFactory.getLogger(DocumentTemplateRenderer.class);

    private final DocumentTemplateStorageService templateStorageService;

    public DocumentTemplateRenderer(DocumentTemplateStorageService templateStorageService) {
        this.templateStorageService = templateStorageService;
    }

    /**
     * Resout le contenu binaire d'un template (DB-first, fallback filesystem pour legacy).
     */
    public byte[] resolveTemplateContent(DocumentTemplate template) {
        if (template.getFileContent() != null) {
            return template.getFileContent();
        }
        if (template.getFilePath() != null && !template.getFilePath().isBlank()) {
            return templateStorageService.loadAsBytes(template.getFilePath());
        }
        throw new DocumentStorageException("No content for template: " + template.getId());
    }

    public byte[] fillTemplate(byte[] templateContent, Map<String, Object> contextMap) throws Exception {
        try (InputStream is = new ByteArrayInputStream(templateContent)) {
            IXDocReport report = XDocReportRegistry.getRegistry().loadReport(
                    is, TemplateEngineKind.Freemarker);

            IContext context = report.createContext();

            // Sanitize string values to prevent Freemarker template injection
            for (Map.Entry<String, Object> entry : contextMap.entrySet()) {
                if (entry.getValue() instanceof String strVal) {
                    // Block Freemarker directives in user-provided values
                    if (strVal.contains("<#") || strVal.contains("${") || strVal.contains("<@")) {
                        log.warn("Potential template injection detected in tag '{}', sanitizing", entry.getKey());
                        entry.setValue(strVal.replace("<#", "&lt;#").replace("${", "&#36;{").replace("<@", "&lt;@"));
                    }
                }
            }

            for (Map.Entry<String, Object> entry : contextMap.entrySet()) {
                context.put(entry.getKey(), entry.getValue());
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            report.process(context, out);
            return out.toByteArray();
        }
    }

    /**
     * Valide que tous les tags references dans le template sont presents dans le contexte.
     * Si des tags sont manquants, leve une erreur explicite avec la liste des tags absents
     * pour permettre de corriger le template ou le code de resolution.
     */
    @SuppressWarnings("unchecked")
    public void ensureTemplateTagsPresent(DocumentTemplate template, Map<String, Object> context) {
        List<DocumentTemplateTag> tags = template.getTags();
        if (tags == null || tags.isEmpty()) return;

        List<String> missingTags = new ArrayList<>();

        for (DocumentTemplateTag tag : tags) {
            String tagName = tag.getTagName();
            if (tagName == null || !tagName.contains(".")) continue;

            int dotIndex = tagName.indexOf('.');
            String group = tagName.substring(0, dotIndex);
            String field = tagName.substring(dotIndex + 1);

            Object groupObj = context.get(group);
            if (groupObj == null) {
                missingTags.add("${" + tagName + "} (groupe '" + group + "' absent)");
            } else if (groupObj instanceof Map) {
                Map<String, Object> groupMap = (Map<String, Object>) groupObj;
                if (!groupMap.containsKey(field)) {
                    missingTags.add("${" + tagName + "} (champ '" + field + "' absent du groupe '" + group + "')");
                }
            }
        }

        if (!missingTags.isEmpty()) {
            String availableGroups = context.keySet().stream()
                    .sorted()
                    .collect(Collectors.joining(", "));
            throw new DocumentGenerationException(
                    "Le template '" + template.getName() + "' contient " + missingTags.size()
                    + " tag(s) non resolus. Tags manquants : " + String.join(" | ", missingTags)
                    + ". Groupes disponibles dans le contexte : [" + availableGroups + "]"
                    + ". Corrigez le template ou ajoutez la resolution de ces tags dans TagResolverService/ComplianceService.");
        }
    }
}
