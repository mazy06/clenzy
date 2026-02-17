package com.clenzy.service;

import com.clenzy.model.DocumentTemplateTag;
import com.clenzy.model.TagCategory;
import com.clenzy.model.TagType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service de parsing des templates .odt pour detection automatique des tags Freemarker.
 * <p>
 * Detecte les tags du type : ${client.nom}, ${property.address}, ${intervention.date_fin},
 * ainsi que les directives [#list] et [#if].
 * <p>
 * Classification automatique par prefixe :
 * - client.*        → CLIENT
 * - property.*      → PROPERTY
 * - intervention.*  → INTERVENTION
 * - devis.*         → DEVIS
 * - facture.*       → FACTURE
 * - paiement.*      → PAIEMENT
 * - entreprise.*    → ENTREPRISE
 * - system.*        → SYSTEM
 * <p>
 * Detection du type par suffixe :
 * - date*, *_at     → DATE
 * - total*, montant*, prix*, cout*, tarif* → MONEY
 * - lignes*, items*, liste* → LIST
 * - logo, signature, photo  → IMAGE
 */
@Service
public class TemplateParserService {

    private static final Logger log = LoggerFactory.getLogger(TemplateParserService.class);

    // Pattern pour les variables Freemarker ${...} et les directives [#list ...] [#if ...]
    private static final Pattern FREEMARKER_VAR_PATTERN = Pattern.compile("\\$\\{([^}]+)}");
    private static final Pattern FREEMARKER_LIST_PATTERN = Pattern.compile("\\[#list\\s+(\\S+)\\s+as\\s+(\\S+)]");
    private static final Pattern FREEMARKER_IF_PATTERN = Pattern.compile("\\[#if\\s+([^]]+)]");

    // Mapping prefixe → TagCategory
    private static final Map<String, TagCategory> PREFIX_CATEGORY_MAP = Map.of(
            "client", TagCategory.CLIENT,
            "property", TagCategory.PROPERTY,
            "intervention", TagCategory.INTERVENTION,
            "devis", TagCategory.DEVIS,
            "facture", TagCategory.FACTURE,
            "paiement", TagCategory.PAIEMENT,
            "entreprise", TagCategory.ENTREPRISE,
            "system", TagCategory.SYSTEM
    );

    private static final int MAX_ZIP_ENTRY_SIZE = 10 * 1024 * 1024; // 10 MB

    // Suffixes de detection de type
    private static final Set<String> DATE_SUFFIXES = Set.of("date", "date_debut", "date_fin", "date_creation",
            "created_at", "updated_at", "paid_at", "scheduled_date", "completed_at");
    private static final Set<String> MONEY_PREFIXES = Set.of("total", "montant", "prix", "cout", "tarif",
            "estimated_cost", "actual_cost", "nightly_price", "tva", "ht", "ttc");
    private static final Set<String> LIST_PREFIXES = Set.of("lignes", "items", "liste", "services", "interventions");
    private static final Set<String> IMAGE_NAMES = Set.of("logo", "signature", "photo", "cachet");

    /**
     * Parse un fichier template .odt et retourne la liste des tags detectes.
     *
     * @param templatePath Chemin absolu du fichier .odt
     * @return Liste des tags detectes (non persistes, sans template_id)
     */
    public List<DocumentTemplateTag> parseTemplate(Path templatePath) {
        log.info("Parsing template: {}", templatePath.getFileName());

        Set<String> rawTags = new LinkedHashSet<>();

        // Extraction regex sur le contenu XML brut du .odt
        try {
            String xmlContent = extractOdtTextContent(templatePath);
            extractFreemarkerTags(xmlContent, rawTags);
        } catch (Exception e) {
            log.warn("Failed to extract tags via regex from {}: {}", templatePath.getFileName(), e.getMessage());
        }

        // Convertir les tags bruts en entites
        List<DocumentTemplateTag> tags = new ArrayList<>();
        for (String rawTag : rawTags) {
            DocumentTemplateTag tag = buildTag(rawTag);
            if (tag != null) {
                tags.add(tag);
            }
        }

        log.info("Parsed {} tags from template {}", tags.size(), templatePath.getFileName());
        return tags;
    }

    /**
     * Extrait le contenu texte XML d'un fichier .odt (format ZIP contenant content.xml).
     */
    private String extractOdtTextContent(Path odtPath) throws IOException {
        StringBuilder content = new StringBuilder();
        try (java.util.zip.ZipInputStream zis = new java.util.zip.ZipInputStream(Files.newInputStream(odtPath))) {
            java.util.zip.ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if ("content.xml".equals(entry.getName()) || "styles.xml".equals(entry.getName())) {
                    long entrySize = entry.getSize();
                    if (entrySize > MAX_ZIP_ENTRY_SIZE) {
                        throw new SecurityException("ODT entry too large: " + entry.getName()
                                + " (" + entrySize + " bytes, max " + MAX_ZIP_ENTRY_SIZE + ")");
                    }
                    byte[] bytes = zis.readAllBytes();
                    if (bytes.length > MAX_ZIP_ENTRY_SIZE) {
                        throw new SecurityException("ODT entry decompressed size exceeds limit: " + entry.getName());
                    }
                    content.append(new String(bytes, java.nio.charset.StandardCharsets.UTF_8));
                }
            }
        }
        return content.toString();
    }

    /**
     * Extrait les tags Freemarker du contenu XML brut.
     */
    private void extractFreemarkerTags(String xmlContent, Set<String> tags) {
        // Nettoyer les balises XML qui pourraient couper les expressions Freemarker
        String cleaned = xmlContent
                .replaceAll("<[^>]+>", " ")   // Supprimer les balises XML
                .replaceAll("&lt;", "<")
                .replaceAll("&gt;", ">")
                .replaceAll("&amp;", "&")
                .replaceAll("\\s+", " ");

        // Extraire ${variable}
        Matcher varMatcher = FREEMARKER_VAR_PATTERN.matcher(cleaned);
        while (varMatcher.find()) {
            String tag = varMatcher.group(1).trim();
            // Ignorer les expressions complexes (ternaires, methodes, etc.)
            if (!tag.contains("?") && !tag.contains("(") && !tag.contains("+")) {
                tags.add(tag);
            }
        }

        // Extraire [#list collection as item]
        Matcher listMatcher = FREEMARKER_LIST_PATTERN.matcher(cleaned);
        while (listMatcher.find()) {
            tags.add(listMatcher.group(1).trim());
        }

        // Extraire [#if condition]
        Matcher ifMatcher = FREEMARKER_IF_PATTERN.matcher(cleaned);
        while (ifMatcher.find()) {
            String condition = ifMatcher.group(1).trim();
            // Extraire la variable de la condition (ex: "client.siret??" → "client.siret")
            String varName = condition.replaceAll("[?!<>=]+.*", "").trim();
            if (!varName.isEmpty() && varName.matches("[a-zA-Z][a-zA-Z0-9._]*")) {
                tags.add(varName);
            }
        }
    }

    /**
     * Construit un DocumentTemplateTag a partir d'un nom de tag brut.
     */
    private DocumentTemplateTag buildTag(String rawTag) {
        if (rawTag == null || rawTag.isBlank()) return null;

        String tagName = rawTag.trim();
        TagCategory category = detectCategory(tagName);
        TagType type = detectType(tagName);
        String dataSource = detectDataSource(tagName, category);

        DocumentTemplateTag tag = new DocumentTemplateTag();
        tag.setTagName(tagName);
        tag.setTagCategory(category);
        tag.setTagType(type);
        tag.setDataSource(dataSource);
        tag.setRequired(type != TagType.CONDITIONAL && type != TagType.IMAGE);
        tag.setDescription(generateDescription(tagName, category));

        return tag;
    }

    private TagCategory detectCategory(String tagName) {
        String prefix = tagName.contains(".") ? tagName.substring(0, tagName.indexOf('.')) : tagName;
        return PREFIX_CATEGORY_MAP.getOrDefault(prefix.toLowerCase(), TagCategory.SYSTEM);
    }

    private TagType detectType(String tagName) {
        String lowerTag = tagName.toLowerCase();
        String field = tagName.contains(".") ? tagName.substring(tagName.lastIndexOf('.') + 1) : tagName;
        String lowerField = field.toLowerCase();

        // Verifier IMAGE
        for (String imageName : IMAGE_NAMES) {
            if (lowerField.contains(imageName)) return TagType.IMAGE;
        }

        // Verifier DATE
        for (String suffix : DATE_SUFFIXES) {
            if (lowerField.equals(suffix) || lowerField.endsWith("_" + suffix) || lowerField.startsWith("date")) {
                return TagType.DATE;
            }
        }

        // Verifier MONEY
        for (String prefix : MONEY_PREFIXES) {
            if (lowerField.equals(prefix) || lowerField.startsWith(prefix + "_") || lowerField.endsWith("_" + prefix)) {
                return TagType.MONEY;
            }
        }

        // Verifier LIST
        for (String listPrefix : LIST_PREFIXES) {
            if (lowerField.equals(listPrefix) || lowerField.startsWith(listPrefix)) {
                return TagType.LIST;
            }
        }

        return TagType.SIMPLE;
    }

    private String detectDataSource(String tagName, TagCategory category) {
        return switch (category) {
            case CLIENT -> "UserRepository / KeycloakService";
            case PROPERTY -> "PropertyRepository";
            case INTERVENTION -> "InterventionRepository";
            case DEVIS, FACTURE -> "ServiceRequestRepository / InterventionRepository";
            case PAIEMENT -> "Stripe / InterventionRepository";
            case ENTREPRISE -> "Configuration application";
            case SYSTEM -> "System (date, numero auto)";
        };
    }

    private String generateDescription(String tagName, TagCategory category) {
        String field = tagName.contains(".") ? tagName.substring(tagName.lastIndexOf('.') + 1) : tagName;
        String readableField = field.replace("_", " ");
        return category.name().toLowerCase() + " — " + readableField;
    }
}
