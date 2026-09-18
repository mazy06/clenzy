package com.clenzy.marketplace.repository;

import com.clenzy.marketplace.model.MarketplaceRecurrence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.List;

/** Découverte interne des échéances ; chaque traitement rétablit ensuite son tenant. */
public interface MarketplaceRecurrenceRepository extends JpaRepository<MarketplaceRecurrence, Long> {
    interface Due { Long getQuoteRequestId(); Long getOrganizationId(); }
    @Query(value = "SELECT quote_request_id AS quoteRequestId, organization_id AS organizationId "
        + "FROM marketplace_recurrences WHERE enabled AND next_date - lead_days <= :today "
        + "ORDER BY next_date - lead_days, quote_request_id LIMIT 50", nativeQuery = true)
    List<Due> findDue(@org.springframework.data.repository.query.Param("today") LocalDate today);
}
