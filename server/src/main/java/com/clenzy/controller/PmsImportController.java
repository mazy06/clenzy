package com.clenzy.controller;

import com.clenzy.service.migration.*;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.*;

@RestController
@RequestMapping("/api/migration/imports")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class PmsImportController {
    private final PmsImportService service;
    private final com.clenzy.service.migration.api.PmsApiImportService api;
    private final TenantContext tenant;
    public PmsImportController(PmsImportService service, com.clenzy.service.migration.api.PmsApiImportService api,
                               TenantContext tenant) { this.service = service; this.api = api; this.tenant = tenant; }
    public record CommitRequest(String token) {}

    @GetMapping("/schema")
    public Map<ImportPlan.Kind, List<PmsImportSchema.Field>> schema() { return PmsImportSchema.FIELDS; }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PmsImportService.View upload(@RequestParam List<MultipartFile> files, @RequestParam String source,
        @RequestParam String account, @RequestParam(defaultValue = "UTF-8") String encoding,
        @AuthenticationPrincipal Jwt jwt) throws IOException {
        return service.upload(files, source, account, encoding, actor(jwt));
    }

    @GetMapping("/api-vendors")
    public List<com.clenzy.service.migration.api.PmsApiConnectors.Vendor> apiVendors() { return api.vendors(); }

    /** Read-only pull from the source PMS API into a draft; credentials are used once and never stored. */
    @PostMapping(value = "/api", consumes = MediaType.APPLICATION_JSON_VALUE)
    public PmsImportService.View pull(@RequestBody com.clenzy.service.migration.api.PmsApiImportService.PullRequest request,
                                      @AuthenticationPrincipal Jwt jwt) {
        return api.pull(request, actor(jwt));
    }

    @GetMapping
    public List<Map<String, Object>> recent(@AuthenticationPrincipal Jwt jwt) { return service.recent(actor(jwt)); }

    @GetMapping("/{id}")
    public PmsImportService.View get(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) { return service.get(id, actor(jwt)); }

    @PutMapping("/{id}/validate")
    public PmsImportService.View validate(@PathVariable UUID id, @RequestBody List<ImportPlan> plans,
        @AuthenticationPrincipal Jwt jwt) { return service.validate(id, plans, actor(jwt)); }

    @PostMapping("/{id}/commit")
    public PmsImportService.View commit(@PathVariable UUID id, @RequestBody CommitRequest request,
        @AuthenticationPrincipal Jwt jwt) { return service.commit(id, request.token(), actor(jwt)); }

    @GetMapping("/{id}/export")
    public ResponseEntity<Map<String, Object>> export(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,
            "attachment; filename=\"baitly-import-" + id + ".json\"").body(service.export(id, actor(jwt)));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) { service.deleteDraft(id, actor(jwt)); }

    @ExceptionHandler({IllegalArgumentException.class, IOException.class})
    public ResponseEntity<Map<String, String>> invalid(Exception error) {
        // Parser exceptions can contain source cells; return only our controlled codes.
        String code = error instanceof IllegalArgumentException && error.getMessage() != null
            && error.getMessage().matches("[A-Z_]+(:[A-Za-z0-9 /_-]+)?") ? error.getMessage() : "FILE_UNREADABLE";
        return ResponseEntity.badRequest().body(Map.of("message", code));
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> concurrentImport() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "VALIDATION_CHANGED"));
    }

    private PmsImportService.Actor actor(Jwt jwt) {
        return new PmsImportService.Actor(tenant.getRequiredOrganizationId(), jwt.getSubject(),
            JwtRoleExtractor.extractUserRole(jwt).isPlatformStaff());
    }
}
