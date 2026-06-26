package com.clenzy.service.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Implementation {@link BinaryAssetStorage} sur <b>stockage objet</b> S3-compatible (OVH Object
 * Storage via le client vendor-neutral {@link ObjectStorageClient}).
 *
 * <p><b>Activation</b> : uniquement quand {@code clenzy.storage.binary-assets=object}. Tant que le
 * flag vaut {@code postgres} (defaut, {@code matchIfMissing=true} sur {@link PostgresBinaryAssetStorage}),
 * ce bean n'est pas instancie et les octets restent en BYTEA — <b>aucun changement</b>.</p>
 *
 * <h2>Cle logique conservee verbatim (pas de re-prefixage org)</h2>
 * Contrairement aux photos/documents (cles {@code org/{orgId}/...}), un {@link BinaryAssetStorage}
 * porte une cle <b>logique deja choisie par l'appelant</b> (ex : {@code users/{userId}/{uuid}.{ext}}
 * pour les avatars). Elle est :
 * <ul>
 *   <li><b>non devinable</b> (UUID dans le chemin),</li>
 *   <li><b>controlee en acces a la couche controller</b> : le service d'avatar sert les octets via
 *       une URL ticketee HMAC (scope {@code avatar:{userId}}) OU une verification d'appartenance a
 *       l'organisation ({@code validateSameOrganizationOrPlatformStaff}). Le storageKey n'est jamais
 *       fourni librement par le client — il est resolu cote serveur depuis
 *       {@code users.profile_picture_url}.</li>
 * </ul>
 * On stocke donc la cle <b>verbatim</b> comme cle objet : ajouter un prefixe org ici n'apporterait
 * rien (pas d'{@code orgId} dans le contexte de stockage des avatars) et casserait le contrat de cle
 * du domaine.
 *
 * <h2>Content-type a la lecture</h2>
 * {@code UserAvatarStorageService.contentTypeFor} derive le type depuis l'<b>extension de la cle</b>
 * ({@code .png}/{@code .jpg}/...) en priorite ; le {@code contentType} retourne par {@link #load}
 * (generique) n'est qu'un repli pour cle sans extension connue. On stocke neanmoins le bon
 * content-type sur l'objet a l'ecriture (header MIME S3).
 */
@Component
@ConditionalOnProperty(name = "clenzy.storage.binary-assets", havingValue = "object")
public class ObjectBinaryAssetStorage implements BinaryAssetStorage {

    private static final Logger log = LoggerFactory.getLogger(ObjectBinaryAssetStorage.class);

    private static final String DEFAULT_CONTENT_TYPE = "application/octet-stream";

    private final ObjectStorageClient client;

    public ObjectBinaryAssetStorage(ObjectStorageClient client) {
        this.client = client;
    }

    @Override
    public void store(String storageKey, String contentType, byte[] bytes) {
        client.put(client.bucket(), storageKey, bytes,
                contentType != null ? contentType : DEFAULT_CONTENT_TYPE);
        log.debug("Stored binary asset (object) : key={}, size={} bytes",
                storageKey, bytes != null ? bytes.length : 0);
    }

    @Override
    public Optional<StoredBinaryAsset> load(String storageKey) {
        if (!exists(storageKey)) {
            return Optional.empty();
        }
        final byte[] bytes = client.get(client.bucket(), storageKey);
        // Le content-type effectif est porte par l'objet ; MinIO ne l'expose pas via get(), on
        // applique donc le type generique. Les appelants (avatar) re-derivent au besoin depuis
        // l'extension de la cle.
        return Optional.of(new StoredBinaryAsset(bytes, DEFAULT_CONTENT_TYPE, bytes.length));
    }

    @Override
    public boolean exists(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            return false;
        }
        return client.exists(client.bucket(), storageKey);
    }

    @Override
    public void delete(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            return;
        }
        client.delete(client.bucket(), storageKey);
        log.debug("Deleted binary asset (object) : key={}", storageKey);
    }
}
