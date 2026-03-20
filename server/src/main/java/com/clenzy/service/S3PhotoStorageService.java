package com.clenzy.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.util.UUID;

/**
 * Amazon S3 photo storage implementation.
 *
 * Activated when clenzy.storage.type=s3.
 * Stores photos in an S3 bucket under the prefix "photos/".
 *
 * Supports both property photos and intervention photos — the caller
 * provides context via the originalFilename (e.g. "property/3/photo.jpg"
 * or "intervention/55/before.jpg").
 *
 * Configuration:
 * - clenzy.storage.s3.bucket: S3 bucket name
 * - clenzy.storage.s3.prefix: key prefix (default: "photos")
 * - AWS credentials via default credential chain (env vars, EC2 role, etc.)
 */
@Service
@ConditionalOnProperty(name = "clenzy.storage.type", havingValue = "s3")
public class S3PhotoStorageService implements PhotoStorageService {

    private static final Logger log = LoggerFactory.getLogger(S3PhotoStorageService.class);

    private final S3Client s3Client;
    private final String bucket;
    private final String prefix;

    public S3PhotoStorageService(
            S3Client s3Client,
            @Value("${clenzy.storage.s3.bucket}") String bucket,
            @Value("${clenzy.storage.s3.prefix:photos}") String prefix) {
        this.s3Client = s3Client;
        this.bucket = bucket;
        this.prefix = prefix;
    }

    @Override
    public String store(byte[] data, String contentType, String originalFilename) {
        String key = buildKey(originalFilename);

        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(contentType)
                        .contentLength((long) data.length)
                        .build(),
                RequestBody.fromBytes(data)
        );

        log.info("Stored photo in S3: bucket={}, key={}, size={}", bucket, key, data.length);
        return key;
    }

    @Override
    public byte[] retrieve(String storageKey) {
        try (var response = s3Client.getObject(
                GetObjectRequest.builder()
                        .bucket(bucket)
                        .key(storageKey)
                        .build())) {
            return response.readAllBytes();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to retrieve photo from S3: " + storageKey, e);
        }
    }

    @Override
    public void delete(String storageKey) {
        s3Client.deleteObject(
                DeleteObjectRequest.builder()
                        .bucket(bucket)
                        .key(storageKey)
                        .build()
        );
        log.info("Deleted photo from S3: bucket={}, key={}", bucket, storageKey);
    }

    /**
     * Build the S3 key from prefix + UUID + extension.
     * Example: "photos/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg"
     */
    private String buildKey(String originalFilename) {
        String extension = extractExtension(originalFilename);
        String uuid = UUID.randomUUID().toString();
        return prefix + "/" + uuid + extension;
    }

    private String extractExtension(String filename) {
        if (filename == null) return ".jpg";
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot).toLowerCase() : ".jpg";
    }
}
