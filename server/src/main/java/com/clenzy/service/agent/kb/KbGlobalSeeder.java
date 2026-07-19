package com.clenzy.service.agent.kb;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Seed de la documentation produit Baitly dans la knowledge base globale.
 *
 * <p>Le corpus vit dans {@code src/main/resources/kb/{fr,en,ar}/*.md} (versionne en
 * git, embarque dans le jar) et est ingere au boot en scope <b>global</b>
 * ({@code organization_id = NULL}) avec la langue du sous-dossier. La recherche kb
 * filtre les docs globaux sur la langue de l'utilisateur. C'est la source de verite
 * reproductible du corpus — plus besoin d'uploads manuels pour la doc officielle.</p>
 *
 * <p><b>Idempotent et economique</b> : {@link IngestionService#ingestMarkdownIfChanged}
 * saute les documents inchanges (contenu identique ET chunker a jour) — aucun appel
 * embeddings aux boots suivants. Un contenu modifie ou un chunker bumpe re-ingere
 * sous le meme {@code sourcePath} (contrainte unique {@code (source_path, org)}).</p>
 *
 * <p>Si aucun modele EMBEDDINGS n'est configure au boot, les chunks sont persistes
 * sans vecteur — {@code KbEmbeddingHealthScheduler} les re-embeddera des qu'un
 * modele sera assigne.</p>
 */
@Component
public class KbGlobalSeeder {

    private static final Logger log = LoggerFactory.getLogger(KbGlobalSeeder.class);
    private static final String CORPUS_PATTERN = "classpath*:kb/*/*.md";
    private static final Set<String> SUPPORTED_LANGS = Set.of("fr", "en", "ar");
    /** Prefixe des sourcePath seedes — distingue le corpus officiel des uploads admin. */
    static final String SOURCE_PREFIX = "baitly/";

    private final IngestionService ingestionService;
    private final boolean enabled;

    public KbGlobalSeeder(IngestionService ingestionService,
                            @Value("${clenzy.assistant.kb.seed-enabled:true}") boolean enabled) {
        this.ingestionService = ingestionService;
        this.enabled = enabled;
    }

    /** Avant le health-check embeddings (HIGHEST+10 < son ordre par defaut). */
    @Order(Ordered.HIGHEST_PRECEDENCE + 10)
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        seed();
    }

    /** @return nombre de documents ingeres/mis a jour (0 si tout etait a jour). */
    public int seed() {
        if (!enabled) {
            log.debug("KbGlobalSeeder : desactive (clenzy.assistant.kb.seed-enabled=false)");
            return 0;
        }
        Resource[] resources;
        try {
            resources = new PathMatchingResourcePatternResolver().getResources(CORPUS_PATTERN);
        } catch (Exception e) {
            log.warn("KbGlobalSeeder : scan du corpus impossible : {}", e.getMessage());
            return 0;
        }
        if (resources.length == 0) {
            log.info("KbGlobalSeeder : aucun document dans {}", CORPUS_PATTERN);
            return 0;
        }

        int ingested = 0;
        int skipped = 0;
        for (Resource resource : resources) {
            String filename = resource.getFilename();
            String lang = resolveLang(resource);
            if (filename == null || lang == null) continue;
            String sourcePath = SOURCE_PREFIX + lang + "/" + filename;
            try {
                String content = resource.getContentAsString(StandardCharsets.UTF_8);
                if (ingestionService.ingestMarkdownIfChanged(sourcePath, content, null, lang)) {
                    ingested++;
                } else {
                    skipped++;
                }
            } catch (Exception e) {
                // Un doc en echec ne doit pas bloquer le reste du corpus (ni le boot).
                log.warn("KbGlobalSeeder : ingestion de '{}' echouee : {}", sourcePath, e.getMessage());
            }
        }
        log.info("KbGlobalSeeder : corpus Baitly seede — {} ingere(s)/mis a jour, {} inchange(s)",
                ingested, skipped);
        return ingested;
    }

    /** Langue = nom du sous-dossier ({@code kb/fr/x.md} → fr). Null si non supportee. */
    private static String resolveLang(Resource resource) {
        try {
            String path = resource.getURI().toString();
            int kbIdx = path.lastIndexOf("kb/");
            if (kbIdx < 0) return null;
            String[] parts = path.substring(kbIdx + 3).split("/");
            if (parts.length < 2) return null;
            String lang = parts[0].toLowerCase(java.util.Locale.ROOT);
            return SUPPORTED_LANGS.contains(lang) ? lang : null;
        } catch (Exception e) {
            return null;
        }
    }
}
