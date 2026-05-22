package com.clenzy.integration.odoo.repository;

import com.clenzy.integration.odoo.model.OdooConnection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OdooConnectionRepository extends JpaRepository<OdooConnection, Long> {

    /** Une seule connexion Odoo active par organisation. */
    Optional<OdooConnection> findByOrganizationId(Long organizationId);
}
