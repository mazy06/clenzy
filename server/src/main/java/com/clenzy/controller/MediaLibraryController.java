package com.clenzy.controller;

import com.clenzy.dto.MediaAssetDto;
import com.clenzy.service.MediaLibraryService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Médiathèque du Studio (2.1) — CRUD org-scopé des médias. Upload multipart, liste, suppression.
 * Scopé org via {@link TenantContext}. Le binaire est servi publiquement par {@link PublicMediaController}.
 */
@RestController
@RequestMapping("/api/booking-engine/media")
@PreAuthorize("isAuthenticated()")
public class MediaLibraryController {

    private final MediaLibraryService service;
    private final TenantContext tenantContext;

    public MediaLibraryController(MediaLibraryService service, TenantContext tenantContext) {
        this.service = service;
        this.tenantContext = tenantContext;
    }

    private Long orgId() {
        return tenantContext.getRequiredOrganizationId();
    }

    @GetMapping
    public ResponseEntity<List<MediaAssetDto>> list() {
        return ResponseEntity.ok(service.list(orgId()));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MediaAssetDto> upload(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(service.upload(orgId(), file));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(orgId(), id);
        return ResponseEntity.noContent().build();
    }
}
