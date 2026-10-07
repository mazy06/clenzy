package com.clenzy.controller;

import com.clenzy.service.export.AccountExportService;
import com.clenzy.service.migration.PmsImportService;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;

/** Self-service full export: available at any time, without request to support and without fees. */
@RestController
@RequestMapping("/api/account/export")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class AccountExportController {
    private final AccountExportService exports;
    private final TenantContext tenant;

    public AccountExportController(AccountExportService exports, TenantContext tenant) {
        this.exports = exports; this.tenant = tenant;
    }

    @GetMapping
    public ResponseEntity<StreamingResponseBody> export(@AuthenticationPrincipal Jwt jwt) throws IOException {
        var actor = new PmsImportService.Actor(tenant.getRequiredOrganizationId(), jwt.getSubject(),
            JwtRoleExtractor.extractUserRole(jwt).isPlatformStaff());
        Path file = exports.export(actor);
        StreamingResponseBody body = out -> {
            try { Files.copy(file, out); } finally { Files.deleteIfExists(file); }
        };
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"baitly-export-" + LocalDate.now() + ".zip\"")
            .contentType(MediaType.parseMediaType("application/zip"))
            .contentLength(Files.size(file))
            .body(body);
    }
}
