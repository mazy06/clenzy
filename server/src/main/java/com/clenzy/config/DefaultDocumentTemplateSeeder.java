package com.clenzy.config;

import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentTemplateTag;
import com.clenzy.model.DocumentType;
import com.clenzy.model.Organization;
import com.clenzy.repository.DocumentTemplateRepository;
import com.clenzy.repository.DocumentTemplateTagRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.TemplateParserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

/**
 * Garantit que les templates de documents systeme (DEVIS, FACTURE) actifs
 * existent et restent a jour au demarrage de l'application.
 *
 * <p><b>Pourquoi ce runner</b> : la generation des PDF (devis a la soumission
 * d'une demande publique, facture a la cloture d'une intervention) exige un
 * template actif org-scope (numerotation legale NF). Le flux public n'a pas de
 * TenantContext : l'org de generation est derivee du template, qui DOIT donc
 * porter l'org Clenzy (non-null), resolue par nom.</p>
 *
 * <p><b>Idempotent + re-seed par checksum</b> : pour chaque template embarque,
 * s'il n'existe pas d'actif il est seede ; s'il en existe un et qu'il provient
 * du seed ({@code createdBy = system-seed}), son contenu est mis a jour quand le
 * .odt embarque change (comparaison SHA-256) — ce qui permet de propager une
 * refonte du rendu en prod. Un template personnalise par un admin via l'UI
 * ({@code createdBy != system-seed}) n'est JAMAIS ecrase.</p>
 *
 * <p><b>Isolation + non bloquant</b> : chaque template est traite dans sa propre
 * transaction ; une erreur sur l'un est loggee sans bloquer les autres ni le
 * demarrage de l'application.</p>
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class DefaultDocumentTemplateSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DefaultDocumentTemplateSeeder.class);

    private static final String CREATED_BY = "system-seed";

    /** Un template embarque a seeder puis a maintenir a jour (re-seed par checksum). */
    private record TemplateSeed(DocumentType type, String resourcePath, String name, String originalFilename) {}

    private static final List<TemplateSeed> SEEDS = List.of(
            new TemplateSeed(DocumentType.DEVIS, "seed/document-templates/devis-clenzy.odt",
                    "Devis Clenzy", "Devis Clenzy.odt"),
            new TemplateSeed(DocumentType.FACTURE, "seed/document-templates/facture-clenzy.odt",
                    "Facture Clenzy", "Facture Clenzy.odt")
    );

    private final DocumentTemplateRepository templateRepository;
    private final DocumentTemplateTagRepository tagRepository;
    private final OrganizationRepository organizationRepository;
    private final TemplateParserService templateParserService;
    private final TransactionTemplate transactionTemplate;

    @Value("${clenzy.seed.document-templates.enabled:true}")
    private boolean enabled;

    @Value("${clenzy.seed.default-org-name:Clenzy}")
    private String orgName;

    public DefaultDocumentTemplateSeeder(DocumentTemplateRepository templateRepository,
                                         DocumentTemplateTagRepository tagRepository,
                                         OrganizationRepository organizationRepository,
                                         TemplateParserService templateParserService,
                                         PlatformTransactionManager transactionManager) {
        this.templateRepository = templateRepository;
        this.tagRepository = tagRepository;
        this.organizationRepository = organizationRepository;
        this.templateParserService = templateParserService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            log.debug("Seed des templates de documents desactive (clenzy.seed.document-templates.enabled=false).");
            return;
        }
        for (TemplateSeed seed : SEEDS) {
            try {
                transactionTemplate.executeWithoutResult(status -> seedTemplate(seed));
            } catch (Exception e) {
                log.error("Echec du seed du template {} (non bloquant) : {}", seed.type(), e.getMessage(), e);
            }
        }
    }

    private void seedTemplate(TemplateSeed seed) {
        byte[] content = loadOdtBytes(seed.resourcePath());
        if (content == null) {
            return;
        }
        // Un template actif existe deja : on tente une mise a jour par checksum
        // (re-seed du nouveau rendu embarque), sans jamais ecraser un template
        // personnalise par un admin via l'UI.
        if (templateRepository.existsByDocumentTypeAndActiveTrue(seed.type())) {
            templateRepository.findByDocumentTypeAndActiveTrue(seed.type())
                    .ifPresent(active -> maybeUpdateSeededTemplate(seed, active, content));
            return;
        }
        Organization org = organizationRepository.findByName(orgName).orElse(null);
        if (org == null) {
            log.warn("Organisation '{}' introuvable : seed du template {} ignore.", orgName, seed.type());
            return;
        }
        DocumentTemplate template = persistTemplate(seed, org.getId(), content);
        persistTags(template, content);
        log.info("Template {} seede pour l'organisation '{}' (orgId={}, templateId={}, {} tags).",
                seed.type(), orgName, org.getId(), template.getId(), template.getTags().size());
    }

    /**
     * Met a jour le contenu d'un template seede si le fichier .odt embarque a
     * change (comparaison par checksum SHA-256). N'ecrase JAMAIS un template dont
     * le {@code createdBy} n'est pas {@value #CREATED_BY} (= personnalise par un
     * admin). Idempotent : ne sauvegarde que si le contenu differe reellement.
     */
    private void maybeUpdateSeededTemplate(TemplateSeed seed, DocumentTemplate active, byte[] freshContent) {
        if (!CREATED_BY.equals(active.getCreatedBy())) {
            log.debug("Template {} actif personnalise (createdBy={}) : mise a jour auto ignoree.",
                    seed.type(), active.getCreatedBy());
            return;
        }
        String current = sha256(active.getFileContent());
        String fresh = sha256(freshContent);
        if (fresh.equals(current)) {
            log.debug("Template {} (seed) deja a jour (checksum identique).", seed.type());
            return;
        }
        active.setFileContent(freshContent);
        active.setOriginalFilename(seed.originalFilename());
        Integer v = active.getVersion();
        active.setVersion(v == null ? 2 : v + 1);
        templateRepository.save(active);
        log.info("Template {} (seed) mis a jour vers le nouveau rendu (checksum {} -> {}, version {}).",
                seed.type(), shortHash(current), shortHash(fresh), active.getVersion());
    }

    private DocumentTemplate persistTemplate(TemplateSeed seed, Long organizationId, byte[] content) {
        DocumentTemplate template = new DocumentTemplate();
        template.setOrganizationId(organizationId);
        template.setName(seed.name());
        template.setDocumentType(seed.type());
        template.setFileContent(content);
        template.setOriginalFilename(seed.originalFilename());
        template.setVersion(1);
        template.setActive(true);
        template.setCreatedBy(CREATED_BY);
        return templateRepository.save(template);
    }

    private void persistTags(DocumentTemplate template, byte[] content) {
        List<DocumentTemplateTag> tags = templateParserService.parseTemplate(content);
        for (DocumentTemplateTag tag : tags) {
            tag.setTemplate(template);
        }
        tagRepository.saveAll(tags);
        template.setTags(tags);
    }

    private static String sha256(byte[] data) {
        if (data == null) {
            return "";
        }
        try {
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256").digest(data);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            return Integer.toHexString(java.util.Arrays.hashCode(data));
        }
    }

    private static String shortHash(String hash) {
        return hash.length() >= 8 ? hash.substring(0, 8) : hash;
    }

    private byte[] loadOdtBytes(String resourcePath) {
        ClassPathResource resource = new ClassPathResource(resourcePath);
        if (!resource.exists()) {
            log.warn("Ressource template introuvable au classpath : {}", resourcePath);
            return null;
        }
        try (InputStream in = resource.getInputStream()) {
            return in.readAllBytes();
        } catch (IOException e) {
            log.error("Lecture de la ressource {} impossible : {}", resourcePath, e.getMessage());
            return null;
        }
    }
}
