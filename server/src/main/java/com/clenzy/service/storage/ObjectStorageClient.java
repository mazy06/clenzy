package com.clenzy.service.storage;

import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.errors.ErrorResponseException;
import io.minio.http.Method;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.ByteArrayInputStream;
import java.time.Duration;

/**
 * Wrapper vendor-neutral autour du client <b>MinIO Java</b> pour le stockage objet
 * S3-compatible (OVH Object Storage, MinIO, etc.) — <b>AUCUNE dependance au SDK AWS</b>.
 *
 * <p>Le client {@link MinioClient} est construit <b>paresseusement</b> (lazy, double-checked)
 * a la premiere utilisation a partir de la config {@code clenzy.storage.object.*}. Tant que
 * le flag {@code clenzy.storage.photos} vaut {@code bytea} (defaut), {@link ObjectStoragePhotoService}
 * n'est pas instancie et aucune connexion n'est ouverte — ce composant reste inerte.</p>
 *
 * <h2>Configuration ({@code clenzy.storage.object.*})</h2>
 * <ul>
 *   <li>{@code endpoint}     — URL du endpoint S3 (ex : {@code https://s3.gra.io.cloud.ovh.net})</li>
 *   <li>{@code region}       — region (ex : {@code gra})</li>
 *   <li>{@code accessKey}    — cle d'acces (secret, via env)</li>
 *   <li>{@code secretKey}      — cle secrete (secret, via env)</li>
 *   <li>{@code bucketMedia}    — bucket des medias (photos)</li>
 *   <li>{@code bucketDocuments}— bucket des documents generes (factures/recus, justificatifs) ;
 *       si vide, repli sur {@code bucketMedia}</li>
 *   <li>{@code bucketArchive} — bucket d'<b>archivage froid</b> (exports JSON/NDJSON de donnees
 *       froides). Defaut vide : tant qu'il n'est pas renseigne, l'archivage est inerte.
 *       <b>Ce bucket DOIT etre provisionne cote OVH en classe « Cold Archive » avec
 *       Object Lock / WORM</b> (retention legale immuable). Aucun repli automatique : un
 *       export d'archive sans bucket dedie echoue explicitement (on n'ecrit JAMAIS des
 *       archives froides dans le bucket medias/documents chaud).</li>
 * </ul>
 *
 * <p><b>Securite</b> : aucune URL publique — l'acces de lecture passe par une URL
 * <b>presignee</b> a TTL court ({@link #presignGet}). Les secrets ne sont jamais en dur :
 * defauts vides, valeurs injectees via variables d'environnement.</p>
 */
@Component
public class ObjectStorageClient {

    private static final Logger log = LoggerFactory.getLogger(ObjectStorageClient.class);

    /** Taille de part par defaut pour les uploads streaming (-1 = laisse MinIO calculer). */
    private static final long UNKNOWN_PART_SIZE = -1L;

    private final Properties properties;

    /** Construit paresseusement (double-checked locking) a la 1re utilisation. */
    private volatile MinioClient client;

    public ObjectStorageClient(Properties properties) {
        this.properties = properties;
    }

    /**
     * Upload d'un objet sous la cle donnee.
     *
     * @param key         cle org-scopee (ex : {@code org/42/photos/<uuid>})
     * @param data        bytes a stocker
     * @param contentType type MIME (ex : {@code image/jpeg})
     */
    public void put(String key, byte[] data, String contentType) {
        put(bucket(), key, data, contentType);
    }

    /**
     * Upload d'un objet dans le <b>bucket d'archivage froid</b> ({@code bucketArchive}).
     *
     * <p>Echoue explicitement (fail-fast) si {@code bucketArchive} n'est pas configure :
     * on ne replie JAMAIS une archive froide sur le bucket medias/documents chaud. Le bucket
     * cible DOIT etre en classe « Cold Archive » avec Object Lock / WORM cote OVH — c'est ce
     * verrou (cote bucket, non gere ici) qui garantit l'immuabilite fiscale/OTA des exports.</p>
     *
     * @param key         cle d'archive deterministe (ex : {@code archive/{target}/{batch}.ndjson})
     * @param data        bytes a archiver (export JSON/NDJSON)
     * @param contentType type MIME (ex : {@code application/x-ndjson})
     */
    public void putArchive(String key, byte[] data, String contentType) {
        put(requireArchiveBucket(), key, data, contentType);
    }

    /** Variante multi-bucket : upload sous {@code bucket}/{@code key}. */
    public void put(String bucket, String key, byte[] data, String contentType) {
        try {
            client().putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(key)
                            .stream(new ByteArrayInputStream(data), (long) data.length, UNKNOWN_PART_SIZE)
                            .contentType(contentType != null ? contentType : "application/octet-stream")
                            .build());
            log.info("Stored object: bucket={}, key={}, size={}", bucket, key, data.length);
        } catch (Exception e) {
            throw new IllegalStateException("Echec de l'upload objet: " + key, e);
        }
    }

    /**
     * Telecharge l'objet sous la cle donnee.
     *
     * @param key cle de l'objet
     * @return bytes de l'objet
     */
    public byte[] get(String key) {
        return get(bucket(), key);
    }

    /** Variante multi-bucket : lit {@code bucket}/{@code key}. */
    public byte[] get(String bucket, String key) {
        try (GetObjectResponse response = client().getObject(
                GetObjectArgs.builder()
                        .bucket(bucket)
                        .object(key)
                        .build())) {
            return response.readAllBytes();
        } catch (Exception e) {
            throw new IllegalStateException("Echec de la lecture objet: " + key, e);
        }
    }

    /**
     * Indique si un objet existe sous {@code bucket}/{@code key} (via {@code statObject}).
     * Une absence ({@code NoSuchKey}) renvoie {@code false} ; toute autre erreur remonte.
     */
    public boolean exists(String bucket, String key) {
        try {
            client().statObject(
                    StatObjectArgs.builder()
                            .bucket(bucket)
                            .object(key)
                            .build());
            return true;
        } catch (ErrorResponseException e) {
            final String code = e.errorResponse() != null ? e.errorResponse().code() : null;
            if ("NoSuchKey".equals(code) || "NoSuchObject".equals(code)) {
                return false;
            }
            throw new IllegalStateException("Echec du statObject: " + key, e);
        } catch (Exception e) {
            throw new IllegalStateException("Echec du statObject: " + key, e);
        }
    }

    /**
     * Supprime l'objet sous la cle donnee.
     *
     * @param key cle de l'objet
     */
    public void delete(String key) {
        delete(bucket(), key);
    }

    /** Variante multi-bucket : supprime {@code bucket}/{@code key}. */
    public void delete(String bucket, String key) {
        try {
            client().removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(bucket)
                            .object(key)
                            .build());
            log.info("Deleted object: bucket={}, key={}", bucket, key);
        } catch (Exception e) {
            throw new IllegalStateException("Echec de la suppression objet: " + key, e);
        }
    }

    /**
     * Genere une URL presignee <b>GET</b> a TTL court — jamais d'URL publique.
     *
     * @param key cle de l'objet
     * @param ttl duree de validite de l'URL
     * @return URL presignee
     */
    public String presignGet(String key, Duration ttl) {
        return presignGet(bucket(), key, ttl);
    }

    /** Variante multi-bucket : URL presignee GET sur {@code bucket}/{@code key}. */
    public String presignGet(String bucket, String key, Duration ttl) {
        try {
            return client().getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucket)
                            .object(key)
                            .expiry((int) ttl.toSeconds())
                            .build());
        } catch (Exception e) {
            throw new IllegalStateException("Echec de la generation d'URL presignee: " + key, e);
        }
    }

    /** Nom du bucket des medias (photos). */
    public String bucket() {
        return properties.bucketMedia();
    }

    /**
     * Nom du bucket des documents generes (factures/recus, justificatifs). Repli sur
     * {@code bucketMedia} si {@code bucketDocuments} n'est pas configure — un deploiement
     * mono-bucket reste fonctionnel.
     */
    public String documentsBucket() {
        return properties.effectiveBucketDocuments();
    }

    /**
     * Nom du bucket d'archivage froid ({@code bucketArchive}), chaine vide si non configure.
     * Aucun repli : un bucket d'archive vide signifie que l'archivage est inerte.
     */
    public String archiveBucket() {
        return properties.bucketArchive();
    }

    /** Indique si un bucket d'archive est configure (prerequis a tout archivage). */
    public boolean isArchiveConfigured() {
        return StringUtils.hasText(properties.bucketArchive());
    }

    /**
     * Renvoie le bucket d'archive ou echoue (fail-fast) s'il n'est pas configure — pour ne
     * jamais ecrire une archive froide dans un bucket chaud par megarde.
     */
    private String requireArchiveBucket() {
        if (!StringUtils.hasText(properties.bucketArchive())) {
            throw new IllegalStateException(
                    "Archivage froid demande mais bucket d'archive non configure : "
                            + "renseigner clenzy.storage.object.bucket-archive (bucket OVH Cold Archive "
                            + "+ Object Lock/WORM). Aucun repli sur les buckets medias/documents.");
        }
        return properties.bucketArchive();
    }

    /**
     * Construction paresseuse et thread-safe du {@link MinioClient}. Echoue explicitement
     * (fail-fast a l'usage) si la config est incomplete — evite d'ouvrir une connexion
     * avec des credentials vides et d'obtenir une erreur opaque cote serveur objet.
     */
    private MinioClient client() {
        MinioClient local = client;
        if (local == null) {
            synchronized (this) {
                local = client;
                if (local == null) {
                    requireConfigured();
                    local = MinioClient.builder()
                            .endpoint(properties.endpoint())
                            .credentials(properties.accessKey(), properties.secretKey())
                            .region(StringUtils.hasText(properties.region()) ? properties.region() : null)
                            .build();
                    client = local;
                }
            }
        }
        return local;
    }

    private void requireConfigured() {
        final boolean hasAnyBucket = StringUtils.hasText(properties.bucketMedia())
                || StringUtils.hasText(properties.bucketDocuments());
        if (!StringUtils.hasText(properties.endpoint())
                || !StringUtils.hasText(properties.accessKey())
                || !StringUtils.hasText(properties.secretKey())
                || !hasAnyBucket) {
            throw new IllegalStateException(
                    "Stockage objet active (clenzy.storage.photos=object et/ou "
                            + "clenzy.storage.documents=object) mais mal configure : "
                            + "renseigner clenzy.storage.object.{endpoint,accessKey,secretKey} et "
                            + "au moins un bucket (bucketMedia et/ou bucketDocuments).");
        }
    }

    /**
     * Contrat de configuration {@code clenzy.storage.object.*}. Defauts vides : aucun
     * secret en dur, valeurs fournies via variables d'environnement.
     */
    @ConfigurationProperties(prefix = "clenzy.storage.object")
    public record Properties(
            String endpoint,
            String region,
            String accessKey,
            String secretKey,
            String bucketMedia,
            String bucketDocuments,
            String bucketArchive) {

        public Properties {
            endpoint = endpoint != null ? endpoint : "";
            region = region != null ? region : "";
            accessKey = accessKey != null ? accessKey : "";
            secretKey = secretKey != null ? secretKey : "";
            bucketMedia = bucketMedia != null ? bucketMedia : "";
            bucketDocuments = bucketDocuments != null ? bucketDocuments : "";
            bucketArchive = bucketArchive != null ? bucketArchive : "";
        }

        /** Bucket documents effectif : {@code bucketDocuments} si renseigne, sinon {@code bucketMedia}. */
        public String effectiveBucketDocuments() {
            return !bucketDocuments.isBlank() ? bucketDocuments : bucketMedia;
        }
    }
}
