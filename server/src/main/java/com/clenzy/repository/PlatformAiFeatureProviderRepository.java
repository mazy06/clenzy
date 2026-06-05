package com.clenzy.repository;

import com.clenzy.model.PlatformAiFeatureProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PlatformAiFeatureProviderRepository extends JpaRepository<PlatformAiFeatureProvider, Long> {

    Optional<PlatformAiFeatureProvider> findByFeature(String feature);

    void deleteByFeature(String feature);
}
