package com.clenzy.service.storage.archival;

import com.clenzy.service.storage.ObjectStorageClient;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Moteur d'<b>archivage froid</b> generique, configurable et <b>DESACTIVE PAR DEFAUT</b>.
 *
 * <p>Il exporte des donnees froides designees vers le bucket d'archive OVH (classe « Cold
 * Archive ») au format <b>NDJSON</b> (une ligne JSON par enregistrement), en <b>lecture seule</b>
 * sur la base. <b>Il n'efface RIEN</b> : l'export est la seule operation cablee. Une purge
 * eventuelle (apres expiration de la retention legale) serait une etape <b>separee, explicite et
 * non implementee</b> dans cette phase — voir le commentaire {@code PURGE} en bas de classe.</p>
 *
 * <h2>Inerte par defaut (double verrou)</h2>
 * <ol>
 *   <li>{@code clenzy.archival.enabled=false} (defaut) ⇒ {@link #archive(String)} est un no-op
 *       (log + resultat vide), aucune lecture/ecriture.</li>
 *   <li>Meme {@code enabled=true}, une cible sans {@link ArchivalSource} enregistree n'exporte
 *       rien (aucune source = aucune donnee designee). Aucune {@code ArchivalSource} n'est
 *       fournie par defaut.</li>
 * </ol>
 *
 * <h2>Generique — aucune table/duree en dur</h2>
 * Le moteur ne connait ni table ni entite ni duree legale. Le « quoi archiver » est porte par
 * une {@link ArchivalSource} (SPI) fournie en code par l'exploitant et reliee a une cible
 * {@code clenzy.archival.targets[].name}.
 *
 * <h2>Respect des regles d'audit</h2>
 * <ul>
 *   <li><b>Regle #2</b> : aucun appel objet (S3) dans une transaction DB longue. Chaque batch
 *       est lu via la {@link ArchivalSource} (transaction courte cote source), PUIS serialise
 *       et uploade HORS de toute transaction.</li>
 *   <li><b>Idempotence</b> : cle d'archive deterministe {@code archive/{target}/page-{n}.ndjson}.
 *       Un re-run reecrit les memes objets (memes pages → memes cles). Cote OVH, l'Object Lock
 *       en mode COMPLIANCE peut rejeter l'ecrasement d'une version verrouillee : c'est le
 *       comportement WORM attendu (voir doc d'activation).</li>
 *   <li><b>Borne</b> : export pagine, taille de batch configurable.</li>
 * </ul>
 */
@Service
public class ArchivalService {

    private static final Logger log = LoggerFactory.getLogger(ArchivalService.class);

    private static final String NDJSON_CONTENT_TYPE = "application/x-ndjson";
    /** Garde-fou : evite un export non borne en cas de source mal pagine (boucle infinie). */
    private static final int MAX_PAGES = 100_000;

    private final ArchivalProperties properties;
    private final ObjectStorageClient objectStorageClient;
    private final ObjectMapper objectMapper;
    /** Sources indexees par {@code targetName} (peut etre vide : aucune source fournie par defaut). */
    private final Map<String, ArchivalSource> sourcesByTarget;

    public ArchivalService(ArchivalProperties properties,
                           ObjectStorageClient objectStorageClient,
                           ObjectMapper objectMapper,
                           List<ArchivalSource> sources) {
        this.properties = properties;
        this.objectStorageClient = objectStorageClient;
        this.objectMapper = objectMapper;
        this.sourcesByTarget = indexByTarget(sources);
    }

    /**
     * Resultat agrege d'un run d'archivage (logging + reponse admin).
     *
     * @param target     nom de la cible demandee
     * @param executed   {@code true} si l'export a reellement tourne ; {@code false} si no-op
     *                   (desactive, cible inconnue, ou source absente)
     * @param reason     explication courte (surtout quand {@code executed=false})
     * @param batches    nombre de pages exportees
     * @param records    nombre total d'enregistrements exportes
     * @param bytes      taille totale (octets NDJSON) uploadee
     */
    public record ArchivalResult(String target, boolean executed, String reason,
                                 int batches, long records, long bytes) {

        static ArchivalResult noop(String target, String reason) {
            return new ArchivalResult(target, false, reason, 0, 0L, 0L);
        }
    }

    /**
     * Archive la cible {@code targetName} : exporte ses donnees froides (lecture seule) vers le
     * bucket d'archive en NDJSON. <b>Ne supprime rien.</b>
     *
     * <p>No-op (resultat avec {@code executed=false}) si : l'archivage est desactive, la cible
     * n'est pas configuree, le bucket d'archive n'est pas configure, ou aucune
     * {@link ArchivalSource} n'est enregistree pour cette cible.</p>
     *
     * @param targetName nom de la cible ({@code clenzy.archival.targets[].name})
     * @return compteurs agreges + indicateur d'execution
     */
    public ArchivalResult archive(String targetName) {
        if (!properties.enabled()) {
            log.info("Archivage froid DESACTIVE (clenzy.archival.enabled=false) : no-op pour target='{}'.",
                    targetName);
            return ArchivalResult.noop(targetName, "archival-disabled");
        }

        final Optional<ArchivalProperties.Target> target = properties.findTarget(targetName);
        if (target.isEmpty()) {
            log.warn("Archivage : cible '{}' inconnue (absente de clenzy.archival.targets) : no-op.",
                    targetName);
            return ArchivalResult.noop(targetName, "unknown-target");
        }

        if (!objectStorageClient.isArchiveConfigured()) {
            log.warn("Archivage : bucket d'archive non configure (clenzy.storage.object.bucket-archive) "
                    + ": no-op pour target='{}'.", targetName);
            return ArchivalResult.noop(targetName, "archive-bucket-missing");
        }

        final ArchivalSource source = sourcesByTarget.get(target.get().name());
        if (source == null) {
            log.warn("Archivage : aucune ArchivalSource enregistree pour la cible '{}' : "
                    + "rien a exporter (fournir une implementation d'ArchivalSource).", targetName);
            return ArchivalResult.noop(targetName, "no-source-registered");
        }

        return exportTarget(target.get().name(), source);
    }

    /**
     * Boucle d'export paginee. Lit page apres page via la source (lecture seule), serialise en
     * NDJSON et uploade chaque page sous une cle deterministe. HORS transaction (regle #2).
     */
    private ArchivalResult exportTarget(String targetName, ArchivalSource source) {
        final int batchSize = properties.effectiveBatchSize();
        log.info("Archivage DEMARRE : target='{}', batchSize={}, bucket='{}'.",
                targetName, batchSize, objectStorageClient.archiveBucket());

        int pageIndex = 0;
        int batches = 0;
        long totalRecords = 0L;
        long totalBytes = 0L;

        while (pageIndex < MAX_PAGES) {
            final Pageable pageable = PageRequest.of(pageIndex, batchSize);
            final List<?> rows = source.fetchBatch(pageable);
            if (rows == null || rows.isEmpty()) {
                break;
            }

            final byte[] ndjson = toNdjson(rows);
            final String key = archiveKey(targetName, pageIndex);
            objectStorageClient.putArchive(key, ndjson, NDJSON_CONTENT_TYPE);

            batches++;
            totalRecords += rows.size();
            totalBytes += ndjson.length;
            log.info("Archivage : target='{}' page {} exportee -> {} ({} lignes, {} octets).",
                    targetName, pageIndex, key, rows.size(), ndjson.length);

            if (rows.size() < batchSize) {
                break; // derniere page (partielle)
            }
            pageIndex++;
        }

        log.info("Archivage TERMINE : target='{}', batches={}, records={}, bytes={} (AUCUNE suppression DB).",
                targetName, batches, totalRecords, totalBytes);
        return new ArchivalResult(targetName, true, "ok", batches, totalRecords, totalBytes);
    }

    /** Serialise une page en NDJSON (une ligne JSON compacte par enregistrement, UTF-8). */
    private byte[] toNdjson(List<?> rows) {
        final ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            for (Object row : rows) {
                out.write(objectMapper.writeValueAsBytes(row));
                out.write('\n');
            }
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Echec de serialisation NDJSON d'une ligne d'archive", e);
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Echec d'ecriture du tampon NDJSON", e);
        }
        return out.toByteArray();
    }

    /**
     * Cle d'archive <b>deterministe</b> (idempotence) : meme cible + meme index de page →
     * meme cle. Format : {@code archive/{target}/page-NNNNNN.ndjson}.
     */
    static String archiveKey(String targetName, int pageIndex) {
        return "archive/" + targetName + "/page-" + String.format("%06d", pageIndex) + ".ndjson";
    }

    private static Map<String, ArchivalSource> indexByTarget(List<ArchivalSource> sources) {
        final Map<String, ArchivalSource> map = new java.util.HashMap<>();
        for (ArchivalSource s : sources != null ? sources : List.<ArchivalSource>of()) {
            final String name = s.targetName();
            if (name == null || name.isBlank()) {
                throw new IllegalStateException(
                        "ArchivalSource " + s.getClass().getName() + " a un targetName vide.");
            }
            final ArchivalSource previous = map.putIfAbsent(name.trim(), s);
            if (previous != null) {
                throw new IllegalStateException("Deux ArchivalSource declarent la meme cible '" + name
                        + "' : " + previous.getClass().getName() + " et " + s.getClass().getName());
            }
        }
        return Map.copyOf(map);
    }

    // ----------------------------------------------------------------------------------------
    // PURGE (NON IMPLEMENTEE — decision et etape explicites de l'exploitant)
    // ----------------------------------------------------------------------------------------
    // La suppression des donnees froides en base APRES archivage n'est volontairement PAS
    // cablee ici. Elle ne doit etre concue qu'apres que l'exploitant a tranche :
    //   (a) les durees de retention legales (ex : factures FR ~10 ans) ;
    //   (b) la verification que l'export d'archive est complet, immuable (Object Lock OVH) et
    //       restaurable ;
    //   (c) une etape de validation humaine explicite avant toute suppression.
    // Tant que ces points ne sont pas tranches, V1 = export seul, 100% non destructif.
}
