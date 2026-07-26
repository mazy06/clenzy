package com.clenzy.repository;

import com.clenzy.model.MediaAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MediaAssetRepository extends JpaRepository<MediaAsset, Long> {

    List<MediaAsset> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    Optional<MediaAsset> findByIdAndOrganizationId(Long id, Long organizationId);

    /** Resolution publique par jeton opaque (route non enumerable — audit P1-06). */
    Optional<MediaAsset> findByPublicToken(UUID publicToken);
}
