package com.clenzy.repository;

import com.clenzy.model.PlatformAiFeatureModel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PlatformAiFeatureModelRepository extends JpaRepository<PlatformAiFeatureModel, Long> {

    Optional<PlatformAiFeatureModel> findByFeature(String feature);

    void deleteByFeature(String feature);

    /** Supprime toute assignation de feature pointant vers ce modèle (avant suppression du modèle). */
    void deleteByModelId(Long modelId);
}
