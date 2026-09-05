package com.clenzy.controller;

import com.clenzy.dto.report.ReportDocumentDto;
import com.clenzy.dto.report.ReportRequest;
import com.clenzy.dto.report.ReportSnapshot;
import com.clenzy.dto.report.SendReportRequest;
import com.clenzy.service.report.ReportDocumentService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Rapports d'analyse : composition, apercu, generation, relecture, diffusion.
 *
 * <p>Controller mince : validation d'entree, delegation, mapping DTO. L'org
 * vient du contexte tenant, jamais d'un parametre — un identifiant
 * d'organisation en entree serait une porte ouverte sur le portefeuille du
 * voisin.</p>
 */
@RestController
@RequestMapping("/api/reports/documents")
@Tag(name = "Report documents", description = "Rapports d'analyse Baitly")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER', 'HOST', 'SUPERVISOR')")
public class ReportDocumentController {

    private final ReportDocumentService service;
    private final TenantContext tenantContext;

    public ReportDocumentController(ReportDocumentService service, TenantContext tenantContext) {
        this.service = service;
        this.tenantContext = tenantContext;
    }

    @PostMapping("/preview")
    @Operation(summary = "Calcule un rapport sans le persister ni le commenter")
    public ReportSnapshot preview(@RequestBody ReportRequest request) {
        return service.preview(request, tenantContext.getRequiredOrganizationId());
    }

    @PostMapping
    @Operation(summary = "Produit un ou plusieurs rapports selon le decoupage demande")
    public List<ReportDocumentDto> generate(@RequestBody ReportRequest request,
                                            @AuthenticationPrincipal Jwt jwt) {
        return service.generate(request, tenantContext.getRequiredOrganizationId(), jwt.getSubject())
                .stream().map(ReportDocumentDto::of).toList();
    }

    @GetMapping
    @Operation(summary = "Les rapports produits, du plus recent au plus ancien")
    public List<ReportDocumentDto> list() {
        return service.list(tenantContext.getRequiredOrganizationId()).stream()
                .map(ReportDocumentDto::of).toList();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Le snapshot fige d'un rapport — ce que l'ecran affiche")
    public ReportSnapshot snapshot(@PathVariable Long id) {
        return service.readSnapshot(service.load(id, tenantContext.getRequiredOrganizationId()));
    }

    @GetMapping("/{id}/pdf")
    @Operation(summary = "Le rapport en PDF")
    public ResponseEntity<byte[]> pdf(@PathVariable Long id) {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        final byte[] pdf = service.pdf(id, orgId);
        final String filename = service.load(id, orgId).getDocumentNumber() + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(pdf);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprime un brouillon ou un rapport relu, jamais un rapport envoye")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id, tenantContext.getRequiredOrganizationId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/send")
    @Operation(summary = "Transmet le rapport a ses destinataires — l'envoi vaut relecture")
    public ReportDocumentDto send(@PathVariable Long id,
                                  @RequestBody(required = false) SendReportRequest request,
                                  @AuthenticationPrincipal Jwt jwt) {
        return ReportDocumentDto.of(service.send(id, tenantContext.getRequiredOrganizationId(),
                jwt.getSubject(), request == null ? List.of() : request.recipients()));
    }
}
