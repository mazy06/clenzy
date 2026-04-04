package com.clenzy.repository;

import com.clenzy.model.PlatformAiModel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlatformAiModelRepository extends JpaRepository<PlatformAiModel, Long> {
}
