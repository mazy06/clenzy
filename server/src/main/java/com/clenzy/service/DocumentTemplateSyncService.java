package com.clenzy.service;

import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentTemplateTag;
import com.clenzy.repository.DocumentTemplateRepository;
import com.clenzy.repository.DocumentTemplateTagRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * Synchronise les templates ODT bundles dans le JAR (classpath:templates/*.odt)
 * avec les enregistrements existants en base.
 * <p>
 * S'execute au demarrage de l'application apres le boot complet de Spring.
 * Pour chaque template active dont le contenu en base differe du fichier
 * bundle, on remplace le contenu et on re-parse les tags. Idempotent :
 * si le contenu est deja a jour, rien n'est touche.
 * <p>
 * Cas d'usage : faire evoluer le rendu d'un template sans demander aux
 * admins de re-uploader le .odt depuis l'UI.
 */
@Service
public class DocumentTemplateSyncService {

    private static final Logger log = LoggerFactory.getLogger(DocumentTemplateSyncService.class);

    /** Mapping : nom de fichier bundle -> documentType attendu en base. */
    private static final Map<String, String> BUNDLED_TEMPLATES = Map.of(
            "template_devis.odt", "DEVIS"
            // Ajouter d'autres mappings ici quand les templates evoluent.
    );

    private final DocumentTemplateRepository templateRepository;
    private final DocumentTemplateTagRepository tagRepository;
    private final TemplateParserService templateParserService;

    public DocumentTemplateSyncService(
            DocumentTemplateRepository templateRepository,
            DocumentTemplateTagRepository tagRepository,
            TemplateParserService templateParserService
    ) {
        this.templateRepository = templateRepository;
        this.tagRepository = tagRepository;
        this.templateParserService = templateParserService;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void syncBundledTemplates() {
        for (Map.Entry<String, String> entry : BUNDLED_TEMPLATES.entrySet()) {
            try {
                syncOne(entry.getKey(), entry.getValue());
            } catch (Exception e) {
                log.warn("Failed to sync bundled template {}: {}", entry.getKey(), e.getMessage());
            }
        }
    }

    private void syncOne(String resourceName, String documentType) throws IOException {
        ClassPathResource res = new ClassPathResource("templates/" + resourceName);
        if (!res.exists()) {
            log.debug("Bundled template not present on classpath: {}", resourceName);
            return;
        }
        byte[] bundledBytes;
        try (InputStream is = res.getInputStream()) {
            bundledBytes = is.readAllBytes();
        }
        String bundledHash = sha256(bundledBytes);

        // On synchronise tous les enregistrements de ce documentType (un par org).
        List<DocumentTemplate> existing = templateRepository.findAll().stream()
                .filter(t -> t.getDocumentType() != null && documentType.equals(t.getDocumentType().name()))
                .toList();
        if (existing.isEmpty()) {
            log.info("No existing template found for documentType={}, skipping classpath sync", documentType);
            return;
        }

        for (DocumentTemplate tpl : existing) {
            byte[] current = tpl.getFileContent();
            String currentHash = current != null ? sha256(current) : "";
            if (bundledHash.equals(currentHash)) {
                log.debug("Template '{}' (id={}) already in sync with bundled file", tpl.getName(), tpl.getId());
                continue;
            }

            log.info("Updating template '{}' (id={}) from bundled file {} ({} -> {} bytes)",
                    tpl.getName(), tpl.getId(), resourceName,
                    current != null ? current.length : 0, bundledBytes.length);

            tpl.setFileContent(bundledBytes);
            if (tpl.getOriginalFilename() == null || tpl.getOriginalFilename().isBlank()) {
                tpl.setOriginalFilename(resourceName);
            }
            tpl.setVersion(tpl.getVersion() == null ? 2 : tpl.getVersion() + 1);
            templateRepository.save(tpl);

            // Re-parse les tags pour que ensureTemplateTagsPresent voie les nouveaux.
            List<DocumentTemplateTag> oldTags = tpl.getTags();
            if (oldTags != null && !oldTags.isEmpty()) {
                tagRepository.deleteAll(oldTags);
            }
            List<DocumentTemplateTag> newTags = templateParserService.parseTemplate(bundledBytes);
            for (DocumentTemplateTag tag : newTags) {
                tag.setTemplate(tpl);
            }
            tagRepository.saveAll(newTags);
            tpl.setTags(newTags);
            log.info("Re-parsed {} tags for template '{}' (id={})",
                    newTags.size(), tpl.getName(), tpl.getId());
        }
    }

    private static String sha256(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(data));
        } catch (Exception e) {
            // Fallback : compare bytes directly via Arrays.hashCode (collisions possibles
            // mais on accepte pour ce cas non-critique).
            return String.valueOf(Arrays.hashCode(data));
        }
    }
}
