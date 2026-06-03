package com.clenzy.repository;

import com.clenzy.model.Camera;
import com.clenzy.model.Camera.CameraStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Acces aux cameras. L'isolation multi-tenant est assuree par le filtre
 * Hibernate {@code organizationFilter} (active par requete authentifiee).
 */
public interface CameraRepository extends JpaRepository<Camera, Long> {

    List<Camera> findByStatus(CameraStatus status);

    List<Camera> findByPropertyId(Long propertyId);

    Optional<Camera> findByStreamName(String streamName);

    long countByPropertyId(Long propertyId);
}
