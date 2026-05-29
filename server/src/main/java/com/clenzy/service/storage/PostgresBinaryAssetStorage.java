package com.clenzy.service.storage;

import com.clenzy.model.BinaryAsset;
import com.clenzy.repository.BinaryAssetRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Implementation Postgres BYTEA de {@link BinaryAssetStorage}.
 *
 * <p>Active par defaut (V1). Pour basculer vers S3 plus tard, definir
 * {@code clenzy.storage.binary-assets=s3} et implementer
 * {@code S3BinaryAssetStorage}.</p>
 *
 * <h3>Trade-offs Postgres BYTEA</h3>
 * <ul>
 *   <li>+ Backup unifie avec {@code pg_dump} (les fichiers sont dans la DB)</li>
 *   <li>+ Transactionnel : la creation d'un User et de son avatar peut etre
 *       atomique (rollback ensemble si echec)</li>
 *   <li>+ Pas de configuration storage externe</li>
 *   <li>- Charge tout en memoire a la lecture (OK pour avatars &lt;5 MB)</li>
 *   <li>- Augmente la taille de la DB ; pour de gros volumes, S3 reste preferable</li>
 * </ul>
 */
@Component
@ConditionalOnProperty(
    name = "clenzy.storage.binary-assets",
    havingValue = "postgres",
    matchIfMissing = true
)
public class PostgresBinaryAssetStorage implements BinaryAssetStorage {

    private static final Logger log = LoggerFactory.getLogger(PostgresBinaryAssetStorage.class);

    private final BinaryAssetRepository repository;

    public PostgresBinaryAssetStorage(BinaryAssetRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public void store(String storageKey, String contentType, byte[] bytes) {
        BinaryAsset asset = repository.findByStorageKey(storageKey).orElseGet(BinaryAsset::new);
        asset.setStorageKey(storageKey);
        asset.setContentType(contentType);
        asset.setFileSize(bytes != null ? bytes.length : 0);
        asset.setBytes(bytes);
        repository.save(asset);
        log.debug("Stored binary asset (postgres) : key={}, size={} bytes", storageKey, asset.getFileSize());
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<StoredBinaryAsset> load(String storageKey) {
        return repository.findByStorageKey(storageKey)
            .map(a -> new StoredBinaryAsset(a.getBytes(), a.getContentType(), a.getFileSize()));
    }

    @Override
    @Transactional(readOnly = true)
    public boolean exists(String storageKey) {
        return repository.existsByStorageKey(storageKey);
    }

    @Override
    @Transactional
    public void delete(String storageKey) {
        int deleted = repository.deleteByStorageKey(storageKey);
        if (deleted > 0) {
            log.debug("Deleted binary asset (postgres) : key={}", storageKey);
        }
    }
}
