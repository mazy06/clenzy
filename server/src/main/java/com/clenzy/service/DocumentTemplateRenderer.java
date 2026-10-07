package com.clenzy.service;

import com.clenzy.exception.DocumentGenerationException;
import com.clenzy.exception.DocumentStorageException;
import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentTemplateTag;
import com.clenzy.model.TagType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Source de modèles HTML commune à la prévisualisation et à la génération finale. */
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
            return BaitlyLegacyOdtImporter.html(template.getFileContent());
        }
        if (template.getFilePath() != null && !template.getFilePath().isBlank()) {
            return BaitlyLegacyOdtImporter.html(templateStorageService.loadAsBytes(template.getFilePath()));
        }
        throw new DocumentStorageException("No content for template: " + template.getId());
    }

    /** Rendu HTML UTF-8 ; l'adaptateur ODT ne lit que les anciennes sources conservées. */
    public byte[] fillTemplate(byte[] templateContent, Map<String, Object> contextMap) {
        return BaitlyHtmlTemplates.render(BaitlyLegacyOdtImporter.html(templateContent), contextMap);
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
                if (!containsPath(groupMap, field)) {
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

    /**
     * Variante TOLERANTE : rend les tags optionnels. Pour chaque tag "groupe.champ"
     * du template, si le groupe ou le champ est absent du contexte, on le remplit
     * avec une valeur vide typee (au lieu de lever une erreur). Expose aussi un
     * booleen {@code has_<groupe>} par groupe (true ssi le groupe etait REELLEMENT fourni
     * et non vide AVANT remplissage) pour permettre le conditionnement des sections
     * du template via Freemarker {@code <#if has_xxx> ... </#if>} (libelle + champ masques
     * si l'info manque).
     *
     * @param visiblePlaceholder true (preview) -&gt; "—" visible ; false (generation) -&gt; "" (rien ne s'affiche)
     */
    @SuppressWarnings("unchecked")
    public void fillMissingTags(DocumentTemplate template, Map<String, Object> context, boolean visiblePlaceholder) {
        List<DocumentTemplateTag> tags = template.getTags();
        if (tags == null || tags.isEmpty()) return;

        // 1) Presence reelle de chaque groupe AVANT toute mutation du contexte.
        Map<String, Boolean> groupPresent = new LinkedHashMap<>();
        for (DocumentTemplateTag tag : tags) {
            String tagName = tag.getTagName();
            if (tagName == null || !tagName.contains(".")) continue;
            String group = tagName.substring(0, tagName.indexOf('.'));
            groupPresent.computeIfAbsent(group, g -> {
                Object obj = context.get(g);
                return (obj instanceof Map) && !((Map<?, ?>) obj).isEmpty();
            });
        }
        // 2) Flags has_<groupe> (ne pas ecraser une cle deja posee par le resolver).
        for (Map.Entry<String, Boolean> e : groupPresent.entrySet()) {
            context.putIfAbsent("has_" + e.getKey(), e.getValue());
        }
        // 3) Remplissage des champs manquants par une valeur vide typee.
        for (DocumentTemplateTag tag : tags) {
            String tagName = tag.getTagName();
            if (tagName == null) continue;
            if (!tagName.contains(".")) {
                context.putIfAbsent(tagName, emptyForType(tag.getTagType() != null ? tag.getTagType() : TagType.SIMPLE, visiblePlaceholder));
                continue;
            }
            int dot = tagName.indexOf('.');
            String group = tagName.substring(0, dot);
            String field = tagName.substring(dot + 1);
            TagType type = tag.getTagType() != null ? tag.getTagType() : TagType.SIMPLE;

            Object groupObj = context.get(group);
            Map<String, Object> groupMap;
            if (groupObj instanceof Map) {
                groupMap = (Map<String, Object>) groupObj;
            } else {
                groupMap = new LinkedHashMap<>();
                context.put(group, groupMap);
            }
            String[] path = field.split("\\.");
            // Copy each branch: resolver maps may be immutable or shared with a snapshot.
            groupMap = new LinkedHashMap<>(groupMap);
            context.put(group, groupMap);
            for (int index = 0; index < path.length - 1; index++) {
                Object child = groupMap.get(path[index]);
                Map<String, Object> next = child instanceof Map<?, ?>
                        ? new LinkedHashMap<>((Map<String, Object>) child) : new LinkedHashMap<>();
                groupMap.put(path[index], next);
                groupMap = next;
            }
            if (!groupMap.containsKey(path[path.length - 1])) {
                groupMap.put(path[path.length - 1], emptyForType(type, visiblePlaceholder));
            }
        }
    }

    private boolean containsPath(Map<String, Object> context, String path) {
        Object value = context;
        for (String field : path.split("\\.")) {
            if (!(value instanceof Map<?, ?> map) || !map.containsKey(field)) return false;
            value = map.get(field);
        }
        return value != null;
    }

    private Object emptyForType(TagType type, boolean visiblePlaceholder) {
        return switch (type) {
            case LIST -> List.of();
            case CONDITIONAL -> Boolean.FALSE;
            case IMAGE -> "";
            default -> visiblePlaceholder ? "—" : "";
        };
    }
}
