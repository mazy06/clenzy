package com.clenzy.repository;

import com.clenzy.model.MediaAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MediaAssetRepository extends JpaRepository<MediaAsset, Long> {

    List<MediaAsset> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    Optional<MediaAsset> findByIdAndOrganizationId(Long id, Long organizationId);
}
