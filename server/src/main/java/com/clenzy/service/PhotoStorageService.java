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
     * Delete photo binary data by storage key.
     *
     * @param storageKey the key returned by {@link #store}
     */
    void delete(String storageKey);
}
