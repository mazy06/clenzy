package com.clenzy.service.storage;

import com.clenzy.model.BinaryAsset;
import com.clenzy.repository.BinaryAssetRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Operations DB <b>transactionnelles courtes</b> de la migration des {@code binary_asset}, isolees
 * dans un bean dedie (regle audit #6 : pas d'auto-invocation {@code @Transactional}).
 *
 * <p>Particularite vs les photos : la cle logique d'un {@link BinaryAsset} ({@code storage_key},
 * ex {@code users/42/<uuid>.png}) est <b>deja</b> la reference persistee sur l'entite metier
 * (ex {@code users.profile_picture_url}). La migration <b>ne reecrit donc aucune colonne</b> :
 * l'object store utilise la meme cle verbatim. La seule operation DB est la <b>lecture</b> des
 * snapshots. AUCUN appel reseau (S3) ici (regle audit #2).</p>
 */
@Component
public class BinaryAssetMigrationTx {

    private final BinaryAssetRepository repository;

    public BinaryAssetMigrationTx(BinaryAssetRepository repository) {
        this.repository = repository;
    }

    /** Page d'IDS uniquement (pas de bytes) — transaction read-only courte. */
    @Transactional(readOnly = true)
    public Page<Long> loadAssetIdsPage(Pageable pageable) {
        final Page<BinaryAsset> page = repository.findAll(pageable);
        final List<Long> ids = page.getContent().stream().map(BinaryAsset::getId).toList();
        return new PageImpl<>(ids, pageable, page.getTotalElements());
    }

    /** Lecture courte des bytes + metadonnees d'un asset (null si disparu). */
    @Transactional(readOnly = true)
    public BinaryAssetMigrationService.AssetSnapshot loadSnapshot(Long assetId) {
        return repository.findById(assetId)
                .map(a -> new BinaryAssetMigrationService.AssetSnapshot(
                        a.getStorageKey(),
                        a.getContentType(),
                        a.getBytes()))
                .orElse(null);
    }
}
