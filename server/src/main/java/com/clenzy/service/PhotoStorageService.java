package com.clenzy.service;

/**
 * Abstraction for photo storage.
 * Current implementation: LocalPhotoStorageService (PostgreSQL BYTEA).
 * Future: S3PhotoStorageService, swapped via @Profile or configuration.
 */
public interface PhotoStorageService {

    /**
     * Store photo binary data and return a storage key.
     *
     * @param data             raw bytes
     * @param contentType      MIME type (e.g. image/jpeg)
     * @param originalFilename original file name
     * @return a storage key to retrieve the photo later
     */
    String store(byte[] data, String contentType, String originalFilename);

    /**
     * Stocke un binaire qui n'appartient a AUCUNE organisation.
     *
     * <p>{@link #store} exige un tenant et produit une cle {@code org/{id}/...}.
     * Certains binaires n'ont pas d'organisation et n'en auront peut-etre
     * jamais : les justificatifs d'un candidat de la place de marche arrivent
     * d'une surface publique, avant tout compte. Les ranger sous une
     * organisation arbitraire aurait ete un mensonge de plus dans la cle.</p>
     *
     * <p>La cle produite ne correspond PAS au motif org-scope, et
     * {@link #assertReadableInCurrentOrg} la refuse donc systematiquement :
     * un binaire plateforme ne se lit jamais par un chemin ou la cle vient du
     * client. Les appelants legitimes verifient eux-memes leur autorisation.</p>
     *
     * @param namespace famille du binaire, en minuscules et tirets
     *                  (ex. {@code marketplace-applications})
     */
    String storePlatformAsset(String namespace, byte[] data, String contentType,
                              String originalFilename);

    /**
     * Retrieve photo binary data by storage key.
     *
     * @param storageKey the key returned by {@link #store}
     * @return raw bytes
     */
    byte[] retrieve(String storageKey);

    /**
     * Garde d'autorisation <b>fail-closed</b> a appeler AVANT {@link #retrieve}
     * quand la cle est <b>controlee par le client</b> (ex : refs d'attachments
     * re-injectees dans le body du chat assistant).
     *
     * <p>Contexte (audit 2026-06, A1-AGENT-IA-01) : le storageKey d'un
     * {@code AttachmentRef} est fourni par le client. Sans verification, un user
     * pouvait forger une cle pointant vers une ressource d'une AUTRE organisation
     * (ex : {@code property_photos.id} cross-org) et la faire resoudre par
     * {@code retrieve} — lecture de fichier arbitraire (path traversal logique).</p>
     *
     * <p>L'implementation doit lever
     * {@link org.springframework.security.access.AccessDeniedException} si la cle
     * ne pointe pas vers une ressource accessible par l'organisation du tenant
     * courant. {@code retrieve} ne traverse PAS le filtre Hibernate
     * {@code organizationFilter} (findById), d'ou la necessite de cette garde
     * explicite.</p>
     *
     * @param storageKey la cle controlee par le client a valider
     * @throws org.springframework.security.access.AccessDeniedException
     *         si la cle n'appartient pas a l'organisation du tenant courant
     */
    void assertReadableInCurrentOrg(String storageKey);

    /**
     * Delete photo binary data by storage key.
     *
     * @param storageKey the key returned by {@link #store}
     */
    void delete(String storageKey);
}
