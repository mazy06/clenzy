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
import java.util.UUID;

/**
 * Job de migration <b>idempotent</b> qui deplace les bytes de {@code InterventionPhoto} stockes
 * en <b>BYTEA</b> (colonne {@code data}) vers le <b>stockage objet</b> S3-compatible (OVH Object
 * Storage via {@link ObjectStorageClient}). Jumeau d'{@link PhotoStorageMigrationService} pour
 * {@code intervention_photos}.
 *
 * <h2>Comment l'app resout une photo (CLEF de la migration)</h2>
 * {@code InterventionPhotoService} lit une photo via {@code resolvePhotoBytes} : si
 * {@code storageKey != null}, il delegue a {@link InterventionPhotoBinaryStore#resolveBytes}.
 * <ul>
 *   <li>Mode BYTEA (flag {@code clenzy.storage.intervention-photos=bytea}, defaut) : les photos
 *       non migrees ont {@code storageKey == null} et sont lues directement depuis {@code data}.</li>
 *   <li>Mode objet (flag {@code clenzy.storage.intervention-photos=object}) :
 *       {@code ObjectInterventionPhotoStore.resolveBytes} fait {@code client.get(storageKey)} —
 *       le {@code storageKey} DOIT alors etre la cle objet {@code org/{orgId}/intervention-photos/{uuid}}.</li>
 * </ul>
 * <p>Ce job ecrit donc la cle objet DANS {@code storageKey} : apres bascule du flag, la lecture
 * resout l'objet sans autre changement de code.</p>
 *
 * <h2>Idempotence</h2>
 * Une photo est « deja migree » si son {@code storageKey} matche le format objet
 * {@code org/{orgId}/intervention-photos/...} ({@link InterventionPhotoMigrationTx#OBJECT_KEY_PATTERN}).
 * Relancer le job saute ces photos. Une photo sans bytes ({@code data} null) est aussi sautee.
 *
 * <h2>Transactions courtes, upload HORS transaction (regle audit #2)</h2>
 * Aucun appel reseau (S3) dans une transaction DB. Pour chaque photo : (1) lecture des bytes +
 * metadonnees en transaction READ-ONLY courte, (2) upload + verification HORS transaction, (3)
 * reecriture du {@code storageKey} en transaction WRITE courte. Les operations DB sont dans un bean
 * separe ({@link InterventionPhotoMigrationTx}) pour eviter l'auto-invocation {@code @Transactional}
 * (regle audit #6).
 *
 * <h2>NON-destructif</h2>
 * Le BYTEA ({@code data}) n'est JAMAIS efface par ce job. La purge est une etape separee,
 * manuelle, post-validation humaine. Aucune suppression n'est cablee ici.
 */
@Service
public class InterventionPhotoMigrationService {

    private static final Logger log = LoggerFactory.getLogger(InterventionPhotoMigrationService.class);

    static final int DEFAULT_BATCH_SIZE = 100;
    static final int MAX_BATCH_SIZE = 1000;

    private final InterventionPhotoMigrationTx tx;
    private final ObjectStorageClient objectStorageClient;

    public InterventionPhotoMigrationService(InterventionPhotoMigrationTx tx,
                                             ObjectStorageClient objectStorageClient) {
        this.tx = tx;
        this.objectStorageClient = objectStorageClient;
    }

    /** Resultat agrege d'un run de migration (pour le logging + la reponse admin). */
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
     * Parcourt TOUTES les photos d'intervention par batch et migre celles encore en BYTEA vers le
     * stockage objet. Relancable a volonte (idempotent).
     *
     * @param batchSize taille de page (clampe entre 1 et {@value #MAX_BATCH_SIZE} ;
     *                  &le; 0 → {@value #DEFAULT_BATCH_SIZE})
     * @return compteurs agreges (scannees / migrees / sautees / en echec)
     */
    public MigrationResult migrate(int batchSize) {
        final int pageSize = clampBatchSize(batchSize);
        log.info("Demarrage migration photos d'intervention BYTEA -> stockage objet (batchSize={})", pageSize);

        MigrationResult result = MigrationResult.empty();
        int pageIndex = 0;
        Page<Long> page;
        do {
            final Pageable pageable = PageRequest.of(pageIndex, pageSize);
            page = tx.loadPhotoIdsPage(pageable);

            for (Long photoId : page.getContent()) {
                result = migrateOnePhoto(photoId, result);
            }

            log.info("Migration photos intervention: page {}/{} traitee (scanned={}, migrated={}, skipped={}, failed={})",
                    pageIndex + 1, Math.max(page.getTotalPages(), 1),
                    result.scanned(), result.migrated(), result.skipped(), result.failed());
            pageIndex++;
        } while (page.hasNext());

        log.info("Migration photos intervention TERMINEE : scanned={}, migrated={}, skipped={}, failed={}",
                result.scanned(), result.migrated(), result.skipped(), result.failed());
        return result;
    }

    /** Surcharge avec la taille de batch par defaut ({@value #DEFAULT_BATCH_SIZE}). */
    public MigrationResult migrate() {
        return migrate(DEFAULT_BATCH_SIZE);
    }

    /**
     * Migre une seule photo. Decoupe en 3 etapes pour ne JAMAIS faire d'IO objet dans une
     * transaction DB. Un echec (upload ou verification) n'altere PAS le BYTEA et n'ecrit PAS le
     * storageKey : la photo reste integralement reversible et sera reessayee au prochain run.
     */
    private MigrationResult migrateOnePhoto(Long photoId, MigrationResult acc) {
        try {
            final PhotoSnapshot snapshot = tx.loadSnapshot(photoId);
            if (snapshot == null) {
                return acc.plus(1, 0, 1, 0); // disparue entre pagination et lecture
            }
            if (snapshot.alreadyMigrated()) {
                return acc.plus(1, 0, 1, 0); // idempotence
            }
            if (snapshot.data() == null || snapshot.data().length == 0) {
                log.debug("Photo intervention id={} sans bytes : sautee.", photoId);
                return acc.plus(1, 0, 1, 0);
            }

            // Upload + verification HORS transaction.
            final String objectKey = "org/" + snapshot.organizationId() + "/intervention-photos/" + UUID.randomUUID();
            objectStorageClient.put(objectKey, snapshot.data(), snapshot.contentType());
            verifyUpload(objectKey, snapshot.data());

            // Reecriture du storageKey en transaction courte (le BYTEA reste intact).
            tx.writeStorageKey(photoId, objectKey);

            log.info("Photo intervention id={} migree -> {} ({} octets)", photoId, objectKey, snapshot.data().length);
            return acc.plus(1, 1, 0, 0);
        } catch (Exception e) {
            log.error("Echec migration photo intervention id={} (non bloquant, BYTEA intact) : {}",
                    photoId, e.getMessage(), e);
            return acc.plus(1, 0, 0, 1);
        }
    }

    /**
     * Verifie que l'objet uploade est lisible et identique (taille + SHA-256). Echoue si la copie
     * est corrompue : l'appelant ne reecrira PAS le storageKey, le BYTEA reste la source de verite.
     */
    private void verifyUpload(String objectKey, byte[] expected) {
        final byte[] roundtrip = objectStorageClient.get(objectKey);
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

    /** Snapshot immutable des donnees d'une photo a un instant T (hors transaction ensuite). */
    public record PhotoSnapshot(Long organizationId, String contentType, byte[] data,
                                String storageKey, boolean alreadyMigrated) {}
}
