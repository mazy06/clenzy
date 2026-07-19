package com.clenzy.service.agent.kb;

import com.clenzy.model.KbChunk;
import com.clenzy.model.KbDocument;
import com.clenzy.repository.KbChunkRepository;
import com.clenzy.repository.KbDocumentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Ingestion de documents (markdown) dans la knowledge base.
 *
 * <p>Decoupage :
 * <ol>
 *   <li>Detection du titre (1er {@code # H1} ou nom du fichier en fallback).</li>
 *   <li>Split en sections par {@code ## H2}.</li>
 *   <li>Re-chunk chaque section a ~{@value #TARGET_CHARS_PER_CHUNK} caracteres
 *       (heuristique : ~500 tokens). Les sections plus courtes restent un seul chunk.</li>
 * </ol>
 *
 * <p>Embeddings calcules en batch via {@link EmbeddingService}, <b>HORS transaction</b>
 * (regle projet : jamais d'appel HTTP externe dans une transaction DB — l'API peut
 * prendre plusieurs secondes avec les retries). Seule la persistance doc+chunks est
 * transactionnelle ({@link TransactionTemplate}). Si l'embedding provider echoue, le
 * chunk est quand meme persiste avec {@code embedding=NULL} — invisible a la recherche
 * mais rattrape par le job de re-embedding.</p>
 *
 * <p>Idempotence : si un document existe deja pour ce {@code (sourcePath, orgId)},
 * on supprime tous ses chunks et on les recree. {@link #CHUNKER_VERSION} est stampee
 * sur le doc : les documents decoupes avec un ancien algorithme sont re-ingeres par
 * {@link #reingestOutdatedDocuments(int)} meme a contenu identique.</p>
 */
@Service
public class IngestionService {

    private static final Logger log = LoggerFactory.getLogger(IngestionService.class);
    private static final int TARGET_CHARS_PER_CHUNK = 2000; // ~500 tokens en moyenne
    private static final int MIN_CHARS_PER_CHUNK = 200;
    /** Overlap max repris du chunk precedent lors d'un re-decoupage par paragraphe. */
    private static final int OVERLAP_MAX_CHARS = 240;
    /**
     * Version courante de l'algorithme de chunking. A INCREMENTER a chaque changement
     * de decoupage (contexte, overlap, tailles) : les docs existants seront re-ingeres.
     * v2 = contexte doc/section + overlap (2026-07).
     */
    public static final int CHUNKER_VERSION = 2;
    private static final Pattern H1_PATTERN = Pattern.compile("(?m)^#\\s+(.+)$");
    private static final Pattern H2_SPLIT = Pattern.compile("(?m)^##\\s+");

    private final KbDocumentRepository documentRepository;
    private final KbChunkRepository chunkRepository;
    private final EmbeddingService embeddingService;
    private final TransactionTemplate transactionTemplate;

    public IngestionService(KbDocumentRepository documentRepository,
                              KbChunkRepository chunkRepository,
                              EmbeddingService embeddingService,
                              PlatformTransactionManager transactionManager) {
        this.documentRepository = documentRepository;
        this.chunkRepository = chunkRepository;
        this.embeddingService = embeddingService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    /**
     * Ingere un markdown depuis un chemin filesystem (typiquement utilise par
     * un CLI ou un job de bootstrap).
     */
    public KbDocument ingestMarkdownFile(Path filePath, Long organizationId) {
        try {
            String content = Files.readString(filePath, StandardCharsets.UTF_8);
            String sourcePath = filePath.toString();
            return ingestMarkdown(sourcePath, content, organizationId);
        } catch (Exception e) {
            log.error("Failed to read markdown file : {}", filePath, e);
            throw new IllegalArgumentException("Lecture impossible : " + filePath, e);
        }
    }

    /**
     * Ingere le markdown depuis son contenu deja en memoire (utilise par
     * l'endpoint upload + les tests). Langue par defaut : fr.
     */
    public KbDocument ingestMarkdown(String sourcePath, String content, Long organizationId) {
        return ingestMarkdown(sourcePath, content, organizationId, "fr");
    }

    /** Variante avec langue explicite (corpus multilingue seede par {@link KbGlobalSeeder}). */
    public KbDocument ingestMarkdown(String sourcePath, String content, Long organizationId,
                                       String lang) {
        if (sourcePath == null || sourcePath.isBlank()) {
            throw new IllegalArgumentException("sourcePath est requis");
        }
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("Le contenu est vide");
        }

        String title = extractTitle(content, sourcePath);
        List<String> sections = splitIntoChunks(content, title);
        log.info("Ingestion '{}' : {} chunks a indexer", sourcePath, sections.size());

        // Embeddings en batch, HORS transaction (appel HTTP potentiellement long).
        List<String> vectorStrings;
        try {
            vectorStrings = embeddingService.embedBatchAsVectorStrings(sections);
        } catch (Exception e) {
            log.warn("Embedding batch failed for '{}' : {}. Chunks persistes sans embedding.",
                    sourcePath, e.getMessage());
            vectorStrings = null;
        }
        final List<String> vectors = vectorStrings;

        // Persistance doc + chunks dans une transaction courte.
        return transactionTemplate.execute(status -> {
            KbDocument doc = documentRepository.findBySourcePathAndOrg(sourcePath, organizationId)
                    .orElseGet(() -> new KbDocument(sourcePath, title, content, lang, organizationId));
            doc.setTitle(title);
            doc.setContent(content);
            doc.setOrganizationId(organizationId);
            if (lang != null) doc.setLang(lang);
            doc.setChunkerVersion(CHUNKER_VERSION);
            doc = documentRepository.save(doc);

            // Re-ingest : on supprime les chunks existants et on les regenere
            chunkRepository.deleteByDocumentId(doc.getId());

            for (int i = 0; i < sections.size(); i++) {
                String text = sections.get(i);
                String vec = vectors != null && i < vectors.size() ? vectors.get(i) : null;
                int estimatedTokens = Math.max(1, text.length() / 4);
                KbChunk chunk = new KbChunk(doc.getId(), i, text, vec, estimatedTokens);
                // La langue pilote la config full-text de la tsvector generee.
                chunk.setLang(doc.getLang());
                chunkRepository.save(chunk);
            }
            return doc;
        });
    }

    /**
     * Ingere seulement si necessaire : contenu change OU document decoupe avec un
     * ancien chunker. Evite de re-payer les embeddings a chaque passage (seed au
     * boot, cron quotidien des fiches hebergements).
     *
     * @return true si le document a ete (re)ingere, false s'il etait deja a jour
     */
    public boolean ingestMarkdownIfChanged(String sourcePath, String content,
                                             Long organizationId, String lang) {
        KbDocument existing = documentRepository.findBySourcePathAndOrg(sourcePath, organizationId)
                .orElse(null);
        if (existing != null
                && existing.getChunkerVersion() >= CHUNKER_VERSION
                && content != null && content.equals(existing.getContent())) {
            return false;
        }
        ingestMarkdown(sourcePath, content, organizationId, lang);
        return true;
    }

    /**
     * Re-ingere un lot de documents decoupes avec un ancien chunker (depuis leur
     * contenu stocke). Appele periodiquement par {@code KbEmbeddingHealthScheduler}
     * — convergence progressive apres un bump de {@link #CHUNKER_VERSION}.
     *
     * @return nombre de documents re-ingeres
     */
    public int reingestOutdatedDocuments(int limit) {
        List<KbDocument> outdated = documentRepository.findByChunkerVersionLessThan(
                CHUNKER_VERSION, PageRequest.of(0, Math.max(1, limit)));
        int done = 0;
        for (KbDocument doc : outdated) {
            try {
                ingestMarkdown(doc.getSourcePath(), doc.getContent(),
                        doc.getOrganizationId(), doc.getLang());
                done++;
            } catch (Exception e) {
                log.warn("Re-ingestion chunker v{} de '{}' echouee : {}",
                        CHUNKER_VERSION, doc.getSourcePath(), e.getMessage());
            }
        }
        if (done > 0) {
            log.info("Re-ingestion chunker v{} : {} document(s) mis a niveau", CHUNKER_VERSION, done);
        }
        return done;
    }

    /** Variante sans contexte documentaire — conservee pour les tests/usages simples. */
    List<String> splitIntoChunks(String content) {
        return splitIntoChunks(content, null);
    }

    /**
     * Decoupe le contenu en chunks selon les sections H2, puis re-decoupe les
     * sections trop longues pour rester sous {@value #TARGET_CHARS_PER_CHUNK}.
     *
     * <p>Chaque chunk est <b>contextualise</b> pour rester comprehensible seul
     * (les chunks sont embeddes et montres au LLM independamment) :
     * <ul>
     *   <li>les sous-chunks issus d'un re-decoupage gardent le titre de leur
     *       section ({@code ## Titre (suite)}) ;</li>
     *   <li>chaque chunk sans H1 est prefixe du titre du document ;</li>
     *   <li>un overlap (dernier paragraphe, max {@value #OVERLAP_MAX_CHARS} chars)
     *       est repris entre sous-chunks pour ne pas couper le contexte.</li>
     * </ul>
     * Package-private pour les tests.
     */
    List<String> splitIntoChunks(String content, String docTitle) {
        List<String> sections = new ArrayList<>();

        // Si pas de ## headers, on traite tout le doc comme une seule section
        if (!H2_SPLIT.matcher(content).find()) {
            sections.add(content);
        } else {
            // Split sur ## (en gardant les headers comme prefixe de section)
            String[] parts = H2_SPLIT.split(content);
            // Le premier part est le preambule (avant le 1er ##) — on le garde s'il a du contenu
            if (parts.length > 0 && parts[0].trim().length() >= MIN_CHARS_PER_CHUNK) {
                sections.add(parts[0]);
            }
            for (int i = 1; i < parts.length; i++) {
                sections.add("## " + parts[i]);
            }
        }

        // Re-chunk les sections trop longues
        List<String> finalChunks = new ArrayList<>();
        for (String section : sections) {
            if (section.length() <= TARGET_CHARS_PER_CHUNK) {
                finalChunks.add(withDocContext(section.trim(), docTitle));
                continue;
            }
            String sectionTitle = extractSectionTitle(section);
            List<String> parts = splitByParagraph(section);
            for (int i = 0; i < parts.size(); i++) {
                String part = parts.get(i);
                if (i > 0 && sectionTitle != null && !part.startsWith("## ")) {
                    part = "## " + sectionTitle + " (suite)\n\n" + part;
                }
                finalChunks.add(withDocContext(part, docTitle));
            }
        }
        return finalChunks;
    }

    private List<String> splitByParagraph(String section) {
        List<String> result = new ArrayList<>();
        String[] paragraphs = section.split("\\n\\s*\\n");
        StringBuilder buffer = new StringBuilder();
        String lastParagraph = null;
        for (String p : paragraphs) {
            if (buffer.length() + p.length() + 2 > TARGET_CHARS_PER_CHUNK
                    && buffer.length() >= MIN_CHARS_PER_CHUNK) {
                result.add(buffer.toString().trim());
                buffer.setLength(0);
                // Overlap : le chunk suivant reprend le dernier paragraphe du
                // precedent pour ne pas couper le contexte a la frontiere.
                if (lastParagraph != null && lastParagraph.length() <= OVERLAP_MAX_CHARS) {
                    buffer.append(lastParagraph);
                }
            }
            if (buffer.length() > 0) buffer.append("\n\n");
            buffer.append(p);
            lastParagraph = p;
        }
        if (buffer.length() > 0) result.add(buffer.toString().trim());
        return result;
    }

    /** Titre de la section ({@code ## Titre}) ou null si la section n'en a pas. */
    private static String extractSectionTitle(String section) {
        if (!section.startsWith("## ")) return null;
        int newline = section.indexOf('\n');
        String title = newline > 3 ? section.substring(3, newline) : section.substring(3);
        return title.isBlank() ? null : title.trim();
    }

    /**
     * Prefixe le chunk du titre du document s'il ne porte pas deja son propre
     * contexte (H1) — un chunk isole du type « Cliquez sur Valider » devient
     * retrouvable et comprehensible.
     */
    private static String withDocContext(String chunk, String docTitle) {
        if (docTitle == null || docTitle.isBlank()) return chunk;
        if (chunk.startsWith("# ") || chunk.contains("\n# ")) return chunk;
        return "Document : " + docTitle + "\n\n" + chunk;
    }

    /**
     * Extrait le titre du document : 1er {@code # H1}, ou nom du fichier
     * (sans extension) en fallback.
     */
    String extractTitle(String content, String sourcePath) {
        Matcher m = H1_PATTERN.matcher(content);
        if (m.find()) {
            return m.group(1).trim();
        }
        // Fallback : nom du fichier
        String name = sourcePath;
        int lastSlash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        if (lastSlash >= 0) name = name.substring(lastSlash + 1);
        int dot = name.lastIndexOf('.');
        if (dot > 0) name = name.substring(0, dot);
        return name.replace('_', ' ').replace('-', ' ');
    }

    /**
     * Liste les documents visibles par une organisation (globaux + propres),
     * tries par date de mise a jour decroissante.
     */
    @Transactional(readOnly = true)
    public List<KbDocument> listVisibleDocuments(Long organizationId) {
        return documentRepository.findVisibleByOrg(organizationId);
    }

    /** KPI plateforme de la knowledge base (ecran admin). */
    public record KbStats(long totalDocuments, long globalDocuments,
                            long totalChunks, long orphanChunks) {}

    /** Compteurs plateforme : documents (global/org), chunks, orphelins sans embedding. */
    @Transactional(readOnly = true)
    public KbStats stats() {
        return new KbStats(
                documentRepository.count(),
                documentRepository.countByOrganizationIdIsNull(),
                chunkRepository.count(),
                chunkRepository.countByEmbeddingIsNull());
    }

    /**
     * Supprime un document de la KB (et ses chunks via le ON DELETE CASCADE).
     * Verifie que le caller est autorise (org_id NULL = doc globale → admin
     * obligatoire, sinon org_id doit matcher).
     */
    @Transactional
    public void deleteDocument(Long documentId, Long callerOrgId, boolean isPlatformAdmin) {
        KbDocument doc = documentRepository.findById(documentId).orElse(null);
        if (doc == null) return;
        if (doc.getOrganizationId() == null && !isPlatformAdmin) {
            throw new SecurityException("Suppression d'un doc global reserve aux admins plateforme");
        }
        if (doc.getOrganizationId() != null && !doc.getOrganizationId().equals(callerOrgId)) {
            throw new SecurityException("Ce document appartient a une autre organisation");
        }
        documentRepository.delete(doc);
    }
}
