package com.clenzy.service.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;

/**
 * Job de migration <b>idempotent</b> qui copie les octets des {@code binary_asset} stockes en
 * <b>BYTEA</b> (colonne {@code bytes}) vers le <b>stockage objet</b> S3-compatible (OVH Object
 * Storage via {@link ObjectStorageClient}).
 *
 * <h2>Comment l'app resout un asset (CLEF de la migration)</h2>
 * Le {@code storage_key} d'un {@link com.clenzy.model.BinaryAsset} (ex {@code users/42/<uuid>.png})
 * est <b>deja</b> la reference persistee cote metier (ex {@code users.profile_picture_url}) et la
 * cle logique de {@link BinaryAssetStorage}. La cle objet = cette meme cle <b>verbatim</b>. Apres
 * bascule du flag {@code clenzy.storage.binary-assets=object}, {@link ObjectBinaryAssetStorage}
 * lit {@code client.get(bucket, storageKey)} : aucun autre changement de code, aucune reecriture
 * de colonne.
 *
 * <h2>Idempotence</h2>
 * Un asset est « deja migre » si l'objet existe deja sous sa cle ({@link ObjectStorageClient#exists}).
 * Relancer le job saute ces assets.
 *
 * <h2>Transactions courtes, upload HORS transaction (regle audit #2)</h2>
 * Lecture du snapshot en transaction READ-ONLY courte ({@link BinaryAssetMigrationTx}) ; upload +
 * verification HORS transaction. Aucune reecriture DB (la cle ne change pas).
 *
 * <h2>NON-destructif</h2>
 * La ligne {@code binary_asset} (et son BYTEA) n'est JAMAIS supprimee par ce job. La purge est une
 * etape separee, manuelle, post-validation humaine.
 */
@Service
public class BinaryAssetMigrationService {

    private static final Logger log = LoggerFactory.getLogger(BinaryAssetMigrationService.class);

    static final int DEFAULT_BATCH_SIZE = 100;
    static final int MAX_BATCH_SIZE = 1000;

    private final BinaryAssetMigrationTx tx;
    private final ObjectStorageClient objectStorageClient;

    public BinaryAssetMigrationService(BinaryAssetMigrationTx tx,
                                       ObjectStorageClient objectStorageClient) {
        this.tx = tx;
        this.objectStorageClient = objectStorageClient;
    }

    /** Resultat agrege d'un run de migration. */
    public record MigrationResult(int scanned, int migrated, int skipped, int failed) {
        public static MigrationResult empty() {
            return new MigrationResult(0, 0, 0, 0);
        }

        MigrationResult plus(int dScanned, int dMigrated, int dSkipped, int dFailed) {
            return new MigrationResult(
                    scanned + dScanned, migrated + dMigrated, skipped + dSkipped, failed + dFailed);
        }
    }

    /**
     * Parcourt TOUS les {@code binary_asset} par batch et copie vers le stockage objet ceux pas
     * encore presents. Relancable a volonte (idempotent).
     */
    public MigrationResult migrate(int batchSize) {
        final int pageSize = clampBatchSize(batchSize);
        log.info("Demarrage migration binary_asset BYTEA -> stockage objet (batchSize={})", pageSize);

        MigrationResult result = MigrationResult.empty();
        int pageIndex = 0;
        Page<Long> page;
        do {
            final Pageable pageable = PageRequest.of(pageIndex, pageSize);
            page = tx.loadAssetIdsPage(pageable);

            for (Long assetId : page.getContent()) {
                result = migrateOneAsset(assetId, result);
            }

            log.info("Migration binary_asset: page {}/{} traitee (scanned={}, migrated={}, skipped={}, failed={})",
                    pageIndex + 1, Math.max(page.getTotalPages(), 1),
                    result.scanned(), result.migrated(), result.skipped(), result.failed());
            pageIndex++;
        } while (page.hasNext());

        log.info("Migration binary_asset TERMINEE : scanned={}, migrated={}, skipped={}, failed={}",
                result.scanned(), result.migrated(), result.skipped(), result.failed());
        return result;
    }

    /** Surcharge avec la taille de batch par defaut ({@value #DEFAULT_BATCH_SIZE}). */
    public MigrationResult migrate() {
        return migrate(DEFAULT_BATCH_SIZE);
    }

    /**
     * Copie un seul asset. La cle objet = la cle logique. Idempotent (saute si l'objet existe).
     * Un echec n'altere PAS le BYTEA (jamais touche) et sera reessaye au prochain run.
     */
    private MigrationResult migrateOneAsset(Long assetId, MigrationResult acc) {
        try {
            final AssetSnapshot snapshot = tx.loadSnapshot(assetId);
            if (snapshot == null) {
                return acc.plus(1, 0, 1, 0); // disparu entre pagination et lecture
            }
            if (snapshot.storageKey() == null || snapshot.storageKey().isBlank()) {
                log.warn("binary_asset id={} sans storage_key : saute.", assetId);
                return acc.plus(1, 0, 1, 0);
            }
            if (objectStorageClient.exists(objectStorageClient.bucket(), snapshot.storageKey())) {
                return acc.plus(1, 0, 1, 0); // idempotence : objet deja present
            }
            if (snapshot.bytes() == null || snapshot.bytes().length == 0) {
                log.debug("binary_asset id={} sans bytes : saute.", assetId);
                return acc.plus(1, 0, 1, 0);
            }

            // Upload + verification HORS transaction. Cle = cle logique verbatim.
            objectStorageClient.put(objectStorageClient.bucket(), snapshot.storageKey(),
                    snapshot.bytes(), snapshot.contentType());
            verifyUpload(snapshot.storageKey(), snapshot.bytes());

            log.info("binary_asset id={} migre -> {} ({} octets)",
                    assetId, snapshot.storageKey(), snapshot.bytes().length);
            return acc.plus(1, 1, 0, 0);
        } catch (Exception e) {
            log.error("Echec migration binary_asset id={} (non bloquant, BYTEA intact) : {}",
                    assetId, e.getMessage(), e);
            return acc.plus(1, 0, 0, 1);
        }
    }

    /**
     * Verifie que l'objet uploade est lisible et identique (taille + SHA-256). Echoue si la copie
     * est corrompue : la ligne {@code binary_asset} reste la source de verite.
     */
    private void verifyUpload(String objectKey, byte[] expected) {
        final byte[] roundtrip = objectStorageClient.get(objectStorageClient.bucket(), objectKey);
        if (roundtrip == null || roundtrip.length != expected.length) {
            throw new IllegalStateException("Verification taille KO pour " + objectKey
                    + " (attendu=" + expected.length
                    + ", lu=" + (roundtrip == null ? "null" : roundtrip.length) + ")");
        }
        if (!Arrays.equals(sha256(expected), sha256(roundtrip))) {
            throw new IllegalStateException("Verification checksum KO pour " + objectKey);
        }
    }

    // --- Helpers ---

    private static int clampBatchSize(int batchSize) {
        if (batchSize <= 0) {
            return DEFAULT_BATCH_SIZE;
        }
        return Math.min(batchSize, MAX_BATCH_SIZE);
    }

    private static byte[] sha256(byte[] data) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(data);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponible", e); // jamais en pratique
        }
    }

    /** Snapshot immutable d'un asset a un instant T (hors transaction ensuite). */
    public record AssetSnapshot(String storageKey, String contentType, byte[] bytes) {}
}
