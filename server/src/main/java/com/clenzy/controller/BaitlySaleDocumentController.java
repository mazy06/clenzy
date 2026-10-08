package com.clenzy.controller;

import com.clenzy.service.BaitlySaleDocumentStore;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/commerce/documents")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class BaitlySaleDocumentController {
    private final BaitlySaleDocumentStore store;private final TenantContext tenant;private final com.clenzy.service.OrganizationService access;
    public BaitlySaleDocumentController(BaitlySaleDocumentStore store,TenantContext tenant,com.clenzy.service.OrganizationService access){this.store=store;this.tenant=tenant;this.access=access;}
    private Long organization(org.springframework.security.oauth2.jwt.Jwt jwt){Long org=tenant.getRequiredOrganizationId();access.validateOrgManagement(jwt.getSubject(),org);return org;}
    @GetMapping("/{id}/export") public java.util.Map<String,Object> export(@PathVariable Long id,@org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt){return store.export(organization(jwt),id,null,null);}
    @GetMapping public List<BaitlySaleDocumentStore.View> list(@RequestParam(required=false) String source,@RequestParam(required=false) Long sourceId,@org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt){return store.list(organization(jwt),source,sourceId);}
}
