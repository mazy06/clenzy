package com.clenzy.service.storage;

import java.util.Optional;

/**
 * Abstraction de stockage pour les assets binaires (avatars, fichiers contacts,
 * etc.). Permet de switcher transparent entre backends sans toucher au code
 * applicatif.
 *
 * <h3>Backends</h3>
 * <ul>
 *   <li><b>V1 (actuel)</b> : {@code PostgresBinaryAssetStorage} —
 *       stockage BYTEA dans la table {@code binary_asset}.</li>
 *   <li><b>V2 (TODO migration AWS)</b> : {@code S3BinaryAssetStorage} —
 *       stockage objet S3. Activable via {@code clenzy.storage.binary-assets=s3}.</li>
 * </ul>
 *
 * <h3>Convention de cle</h3>
 * Le {@code storageKey} est arbitraire mais conventionnel par domaine, ex :
 * <ul>
 *   <li>{@code "users/{userId}/{uuid}.{ext}"} pour les avatars</li>
 *   <li>{@code "contacts/{contactId}/{uuid}.{ext}"} pour les fichiers contact (V2)</li>
 * </ul>
 *
 * <h3>TODO migration S3</h3>
 * Quand on passera sous AWS :
 * <ol>
 *   <li>Implementer {@code S3BinaryAssetStorage} (cf. {@code S3PhotoStorageService})</li>
 *   <li>Setter {@code clenzy.storage.binary-assets=s3} en prod</li>
 *   <li>Optionnel : job one-shot pour migrer les bytes Postgres existants vers S3</li>
 *   <li>Continuer de stocker le {@code storageKey} dans les entites metier
 *       (ex: {@code users.profile_picture_url}). Le code applicatif n'a pas
 *       besoin de savoir ou c'est physiquement stocke.</li>
 * </ol>
 */
public interface BinaryAssetStorage {

    /**
     * Persiste les bytes sous la {@code storageKey} donnee. Upsert :
     * si la cle existe deja, le contenu est remplace.
     */
    void store(String storageKey, String contentType, byte[] bytes);

    /**
     * Charge l'asset par sa cle. Empty si introuvable.
     */
    Optional<StoredBinaryAsset> load(String storageKey);

    /**
     * Verifie l'existence de la cle sans charger les bytes (efficient).
     */
    boolean exists(String storageKey);

    /**
     * Supprime l'asset. No-op si la cle n'existe pas.
     */
    void delete(String storageKey);

    /**
     * Payload immutable retourne par {@link #load}. Le content type est
     * conserve avec les bytes pour les servir avec le bon header HTTP.
     */
    record StoredBinaryAsset(byte[] bytes, String contentType, long fileSize) {}
}
