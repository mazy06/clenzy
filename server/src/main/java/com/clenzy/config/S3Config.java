package com.clenzy.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

/**
 * Configuration AWS S3 pour le stockage des photos.
 *
 * Active uniquement quand clenzy.storage.type=s3.
 * En dev/local, le LocalPhotoStorageService (PostgreSQL BYTEA) est utilise par defaut.
 *
 * Config requise en production :
 *   clenzy.storage.type=s3
 *   clenzy.storage.s3.bucket=clenzy-photos
 *   clenzy.storage.s3.region=eu-west-3
 *   clenzy.storage.s3.prefix=photos
 *   + AWS credentials (env vars AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY ou IAM role)
 */
@Configuration
@ConditionalOnProperty(name = "clenzy.storage.type", havingValue = "s3")
public class S3Config {

    @Value("${clenzy.storage.s3.region:eu-west-3}")
    private String region;

    @Bean
    public S3Client s3Client() {
        return S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
    }
}
