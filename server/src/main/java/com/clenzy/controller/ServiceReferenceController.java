package com.clenzy.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/** Lecture commune du catalogue global : aucune donnée de prestataire ou d'organisation. */
@RestController
@RequestMapping("/api/service-reference")
@PreAuthorize("isAuthenticated()")
public class ServiceReferenceController {
    private final JdbcTemplate db;
    private final com.clenzy.service.catalog.ServiceCatalogReference catalog;
    private final com.clenzy.tenant.TenantContext tenant;
    public ServiceReferenceController(JdbcTemplate db, com.clenzy.tenant.TenantContext tenant, com.clenzy.service.catalog.ServiceCatalogReference catalog) {
        this.catalog=catalog;
        this.db=db; this.tenant=tenant;
    }
    public record Issue(String sourceType, Long sourceId, String legacyType, String reason) {}
    @GetMapping("/issues")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public List<Issue> issues() {
        return db.query("""
            SELECT source_type,source_id,legacy_type,reason FROM service_catalog_reference_issues
            WHERE organization_id=? ORDER BY source_type,source_id LIMIT 200
            """, (r,n) -> new Issue(r.getString(1),r.getLong(2),r.getString(3),r.getString(4)),
            tenant.getRequiredOrganizationId());
    }
    @GetMapping
    public List<com.clenzy.service.catalog.ServiceCatalogReference.Item> list() { return catalog.items(); }
}
