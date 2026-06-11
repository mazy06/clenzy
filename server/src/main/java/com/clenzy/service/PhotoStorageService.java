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
