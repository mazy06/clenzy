package com.clenzy.service.storage.offload;

import com.clenzy.service.storage.ObjectStorageClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.List;

/**
 * Déplace vers le stockage objet (OVH en production) les fichiers encore en base ou sur le disque du
 * serveur, puis efface leur ancienne copie : c'est ce qui allège réellement PostgreSQL et le VPS.
 *
 * <p>Pour chaque élément : lecture courte, écriture de l'objet et vérification (taille + SHA-256)
 * <b>hors transaction</b> (règle audit n°2), puis, seulement si la copie est identique, enregistrement
 * de la clé et effacement de l'ancienne copie ({@link InlineBinarySource#complete}). Un échec laisse
 * l'élément intact : il est retenté au passage suivant. Relançable à volonté.</p>
 */
@Service
public class InlineBinaryOffloadService {

    private static final Logger log = LoggerFactory.getLogger(InlineBinaryOffloadService.class);

    static final int BATCH_SIZE = 50;

    private final ObjectStorageClient client;
    private final List<InlineBinarySource> sources;

    public InlineBinaryOffloadService(ObjectStorageClient client, List<InlineBinarySource> sources) {
        this.client = client;
        this.sources = sources;
    }

    /** Bilan d'une famille. */
    public record OffloadResult(String family, int offloaded, int skipped, int failed) {
    }

    /** Reprend toutes les familles basculées sur le stockage objet. */
    public List<OffloadResult> offloadAll() {
        return sources.stream().filter(InlineBinarySource::active).map(this::offload).toList();
    }

    OffloadResult offload(InlineBinarySource source) {
        int offloaded = 0;
        int skipped = 0;
        int failed = 0;
        long cursor = 0;
        List<Long> ids = source.pendingIdsAfter(cursor, BATCH_SIZE);
        while (!ids.isEmpty()) {
            for (Long id : ids) {
                switch (offloadOne(source, id)) {
                    case OFFLOADED -> offloaded++;
                    case SKIPPED -> skipped++;
                    case FAILED -> failed++;
                }
                cursor = id;
            }
            ids = source.pendingIdsAfter(cursor, BATCH_SIZE);
        }
        final OffloadResult result = new OffloadResult(source.family(), offloaded, skipped, failed);
        if (offloaded + skipped + failed > 0) {
            log.info("Reprise vers le stockage objet [{}] : {} déplacés, {} ignorés, {} en échec",
                    source.family(), offloaded, skipped, failed);
        }
        return result;
    }

    private enum Outcome { OFFLOADED, SKIPPED, FAILED }

    private Outcome offloadOne(InlineBinarySource source, long id) {
        try {
            final PendingBinary binary = source.load(id);
            if (binary == null || binary.data() == null || binary.data().length == 0) {
                return Outcome.SKIPPED;
            }
            final String bucket = source.bucket() == InlineBinarySource.Bucket.DOCUMENTS
                    ? client.documentsBucket() : client.bucket();
            final String key = source.objectKey(binary);
            client.put(bucket, key, binary.data(), binary.contentType());
            verify(bucket, key, binary.data());
            return source.complete(id, binary, key) ? Outcome.OFFLOADED : Outcome.SKIPPED;
        } catch (RuntimeException e) {
            log.error("Reprise [{}] id={} en échec, ancienne copie conservée (nouvel essai au prochain passage) : {}",
                    source.family(), id, e.getMessage(), e);
            return Outcome.FAILED;
        }
    }

    /** Relit l'objet écrit : l'ancienne copie n'est effacée que si la copie est identique. */
    private void verify(String bucket, String key, byte[] expected) {
        final byte[] stored = client.get(bucket, key);
        if (stored == null || stored.length != expected.length || !Arrays.equals(sha256(stored), sha256(expected))) {
            throw new IllegalStateException("Copie non conforme sur le stockage objet : " + key);
        }
    }

    private static byte[] sha256(byte[] data) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(data);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponible", e);
        }
    }
}
