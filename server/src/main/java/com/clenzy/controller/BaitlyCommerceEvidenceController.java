package com.clenzy.controller;

import com.clenzy.service.*;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequestMapping("/api/commerce/evidence")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class BaitlyCommerceEvidenceController {
    private final BaitlyCommerceEvidenceStore store;private final OrganizationService access;private final TenantContext tenant;
    public BaitlyCommerceEvidenceController(BaitlyCommerceEvidenceStore store,OrganizationService access,TenantContext tenant){this.store=store;this.access=access;this.tenant=tenant;}
    private Long org(Jwt jwt){Long org=tenant.getRequiredOrganizationId();access.validateOrgManagement(jwt.getSubject(),org);return org;}
    @GetMapping public BaitlyCommerceEvidenceStore.Dossier list(@RequestParam String source,@RequestParam Long sourceId,@AuthenticationPrincipal Jwt jwt){return store.dossier(org(jwt),source,sourceId);}
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public BaitlyCommerceEvidenceStore.View attach(@RequestParam String source,@RequestParam Long sourceId,
        @RequestPart("metadata") BaitlyCommerceEvidenceStore.Request metadata,@RequestPart("file") MultipartFile file,@AuthenticationPrincipal Jwt jwt){
        Long org=org(jwt);return store.attach(org,source,sourceId,metadata,BaitlyFinancialDocument.read(file),jwt.getSubject());
    }
    @GetMapping("/{id}/document") public ResponseEntity<byte[]> download(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt){
        var doc=store.document(org(jwt),id);String extension=doc.mime().equals("application/pdf")?"pdf":doc.mime().equals("image/png")?"png":"jpg";
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(doc.mime()))
            .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"baitly-piece-"+id+"."+extension+"\"").body(doc.bytes());
    }
}
