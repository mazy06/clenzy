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
 * Garantit qu'un template DEVIS actif existe au demarrage de l'application.
 *
 * <p><b>Pourquoi ce runner</b> : la prod tourne avec
 * {@code SPRING_LIQUIBASE_ENABLED=false} + {@code ddl-auto=update}. Le schema
 * est cree par Hibernate, mais les <i>seeds de donnees</i> (l'INSERT du
 * template DEVIS du changeset 0163) ne sont jamais joues. Resultat : la
 * generation du devis PDF a la soumission d'une demande publique echoue
 * silencieusement (aucun template actif → {@code Mode A}), donc aucun PDF
 * n'est genere, envoye, ni persiste.</p>
 *
 * <p><b>Org-scoping</b> : le DEVIS exige une numerotation legale NF
 * (org-scopee). Le flow public n'a pas de TenantContext, donc l'org de
 * generation est derivee du template. Le template seede DOIT donc porter
 * l'org Clenzy (non-null), resolue par nom comme dans le changeset 0163.</p>
 *
 * <p><b>Idempotent</b> : ne fait rien si un template DEVIS actif existe deja
 * (toutes orgs confondues — au boot le filtre Hibernate n'est pas actif).</p>
 *
 * <p><b>Non bloquant</b> : toute erreur est loggee mais ne fait jamais
 * echouer le demarrage de l'application.</p>
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class DefaultDocumentTemplateSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DefaultDocumentTemplateSeeder.class);

    private static final String RESOURCE_PATH = "seed/document-templates/devis-clenzy.odt";
    private static final String TEMPLATE_NAME = "Devis Clenzy";
    private static final String ORIGINAL_FILENAME = "Devis Clenzy.odt";
    private static final String CREATED_BY = "system-seed";

    private final DocumentTemplateRepository templateRepository;
    private final DocumentTemplateTagRepository tagRepository;
    private final OrganizationRepository organizationRepository;
    private final TemplateParserService templateParserService;
    private final TransactionTemplate transactionTemplate;

    @Value("${clenzy.seed.devis-template.enabled:true}")
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
            log.debug("Seed du template DEVIS desactive (clenzy.seed.devis-template.enabled=false).");
            return;
        }
        try {
            transactionTemplate.executeWithoutResult(status -> seedDevisTemplate());
        } catch (Exception e) {
            // Ne JAMAIS bloquer le boot : on log et on poursuit le demarrage.
            log.error("Echec du seed du template DEVIS (non bloquant) : {}", e.getMessage(), e);
        }
    }

    private void seedDevisTemplate() {
        if (templateRepository.existsByDocumentTypeAndActiveTrue(DocumentType.DEVIS)) {
            log.debug("Template DEVIS actif deja present : seed ignore (idempotent).");
            return;
        }
        Organization org = organizationRepository.findByName(orgName).orElse(null);
        if (org == null) {
            log.warn("Organisation '{}' introuvable : seed du template DEVIS ignore.", orgName);
            return;
        }
        byte[] content = loadOdtBytes();
        if (content == null) {
            return;
        }
        DocumentTemplate template = persistTemplate(org.getId(), content);
        persistTags(template, content);
        log.info("Template DEVIS seede pour l'organisation '{}' (orgId={}, templateId={}, {} tags).",
                orgName, org.getId(), template.getId(), template.getTags().size());
    }

    private DocumentTemplate persistTemplate(Long organizationId, byte[] content) {
        DocumentTemplate template = new DocumentTemplate();
        template.setOrganizationId(organizationId);
        template.setName(TEMPLATE_NAME);
        template.setDocumentType(DocumentType.DEVIS);
        template.setFileContent(content);
        template.setOriginalFilename(ORIGINAL_FILENAME);
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

    private byte[] loadOdtBytes() {
        ClassPathResource resource = new ClassPathResource(RESOURCE_PATH);
        if (!resource.exists()) {
            log.warn("Ressource template DEVIS introuvable au classpath : {}", RESOURCE_PATH);
            return null;
        }
        try (InputStream in = resource.getInputStream()) {
            return in.readAllBytes();
        } catch (IOException e) {
            log.error("Lecture de la ressource {} impossible : {}", RESOURCE_PATH, e.getMessage());
            return null;
        }
    }
}
