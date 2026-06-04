package com.clenzy.repository;

import com.clenzy.model.Thermostat;
import com.clenzy.model.Thermostat.ThermostatStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Acces aux thermostats. L'isolation multi-tenant est assuree par le filtre
 * Hibernate {@code organizationFilter} (active par requete authentifiee).
 */
public interface ThermostatRepository extends JpaRepository<Thermostat, Long> {

    List<Thermostat> findByStatus(ThermostatStatus status);

    List<Thermostat> findByPropertyId(Long propertyId);

    long countByPropertyId(Long propertyId);
}
