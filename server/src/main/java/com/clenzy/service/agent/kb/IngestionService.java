package com.clenzy.service.agent.kb;

import com.clenzy.model.KbChunk;
import com.clenzy.model.KbDocument;
import com.clenzy.repository.KbChunkRepository;
import com.clenzy.repository.KbDocumentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
 * <p>Embeddings calcules en batch via {@link EmbeddingService}. Si l'embedding
 * provider echoue, le chunk est quand meme persiste avec {@code embedding=NULL}
 * — il restera invisible a la recherche vectorielle mais consultable cote admin.</p>
 *
 * <p>Idempotence : si un document existe deja pour ce {@code (sourcePath, orgId)},
 * on supprime tous ses chunks et on les recree.</p>
 */
@Service
@Transactional
public class IngestionService {

    private static final Logger log = LoggerFactory.getLogger(IngestionService.class);
    private static final int TARGET_CHARS_PER_CHUNK = 2000; // ~500 tokens en moyenne
    private static final int MIN_CHARS_PER_CHUNK = 200;
    private static final Pattern H1_PATTERN = Pattern.compile("(?m)^#\\s+(.+)$");
    private static final Pattern H2_SPLIT = Pattern.compile("(?m)^##\\s+");

    private final KbDocumentRepository documentRepository;
    private final KbChunkRepository chunkRepository;
    private final EmbeddingService embeddingService;

    public IngestionService(KbDocumentRepository documentRepository,
                              KbChunkRepository chunkRepository,
                              EmbeddingService embeddingService) {
        this.documentRepository = documentRepository;
        this.chunkRepository = chunkRepository;
        this.embeddingService = embeddingService;
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
     * l'endpoint upload + les tests).
     */
    public KbDocument ingestMarkdown(String sourcePath, String content, Long organizationId) {
        if (sourcePath == null || sourcePath.isBlank()) {
            throw new IllegalArgumentException("sourcePath est requis");
        }
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("Le contenu est vide");
        }

        String title = extractTitle(content, sourcePath);
        KbDocument doc = documentRepository.findBySourcePathAndOrg(sourcePath, organizationId)
                .orElseGet(() -> new KbDocument(sourcePath, title, content, "fr", organizationId));
        doc.setTitle(title);
        doc.setContent(content);
        doc.setOrganizationId(organizationId);
        doc = documentRepository.save(doc);

        // Re-ingest : on supprime les chunks existants et on les regenere
        chunkRepository.deleteByDocumentId(doc.getId());

        List<String> sections = splitIntoChunks(content);
        log.info("Ingestion '{}' : {} chunks a indexer", sourcePath, sections.size());

        // Embeddings en batch pour limiter les appels API
        List<String> vectorStrings;
        try {
            vectorStrings = embeddingService.embedBatchAsVectorStrings(sections);
        } catch (Exception e) {
            log.warn("Embedding batch failed for '{}' : {}. Chunks persistes sans embedding.",
                    sourcePath, e.getMessage());
            vectorStrings = null;
        }

        for (int i = 0; i < sections.size(); i++) {
            String text = sections.get(i);
            String vec = vectorStrings != null && i < vectorStrings.size() ? vectorStrings.get(i) : null;
            int estimatedTokens = Math.max(1, text.length() / 4);
            KbChunk chunk = new KbChunk(doc.getId(), i, text, vec, estimatedTokens);
            chunkRepository.save(chunk);
        }
        return doc;
    }

    /**
     * Decoupe le contenu en chunks selon les sections H2, puis re-decoupe les
     * sections trop longues pour rester sous {@value #TARGET_CHARS_PER_CHUNK}.
     * Package-private pour les tests.
     */
    List<String> splitIntoChunks(String content) {
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
                finalChunks.add(section.trim());
            } else {
                finalChunks.addAll(splitByParagraph(section));
            }
        }
        return finalChunks;
    }

    private List<String> splitByParagraph(String section) {
        List<String> result = new ArrayList<>();
        String[] paragraphs = section.split("\\n\\s*\\n");
        StringBuilder buffer = new StringBuilder();
        for (String p : paragraphs) {
            if (buffer.length() + p.length() + 2 > TARGET_CHARS_PER_CHUNK
                    && buffer.length() >= MIN_CHARS_PER_CHUNK) {
                result.add(buffer.toString().trim());
                buffer.setLength(0);
            }
            if (buffer.length() > 0) buffer.append("\n\n");
            buffer.append(p);
        }
        if (buffer.length() > 0) result.add(buffer.toString().trim());
        return result;
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
     * Supprime un document de la KB (et ses chunks via le ON DELETE CASCADE).
     * Verifie que le caller est autorise (org_id NULL = doc globale → admin
     * obligatoire, sinon org_id doit matcher).
     */
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
