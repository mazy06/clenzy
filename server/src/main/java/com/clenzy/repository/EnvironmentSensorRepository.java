package com.clenzy.repository;

import com.clenzy.model.EnvironmentSensor;
import com.clenzy.model.EnvironmentSensor.SensorStatus;
import com.clenzy.model.EnvironmentSensor.SensorType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Acces aux capteurs d'environnement. L'isolation multi-tenant est assuree par le
 * filtre Hibernate {@code organizationFilter} (actif par requete authentifiee) ;
 * le scheduler tourne sans filtre → balaye toutes les orgs (comme NoiseAlertScheduler).
 */
public interface EnvironmentSensorRepository extends JpaRepository<EnvironmentSensor, Long> {

    List<EnvironmentSensor> findByStatus(SensorStatus status);

    List<EnvironmentSensor> findByStatusAndSensorTypeIn(SensorStatus status, List<SensorType> types);

    List<EnvironmentSensor> findByPropertyId(Long propertyId);

    long countByPropertyId(Long propertyId);
}
