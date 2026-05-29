package com.clenzy.repository;

import com.clenzy.model.BinaryAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Acces aux {@link BinaryAsset} via leur {@code storageKey}.
 */
@Repository
public interface BinaryAssetRepository extends JpaRepository<BinaryAsset, Long> {

    Optional<BinaryAsset> findByStorageKey(String storageKey);

    boolean existsByStorageKey(String storageKey);

    @Modifying
    @Query("DELETE FROM BinaryAsset b WHERE b.storageKey = :storageKey")
    int deleteByStorageKey(@Param("storageKey") String storageKey);
}
