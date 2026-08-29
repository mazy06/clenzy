package com.clenzy.controller;

import com.clenzy.model.ProviderDocument;
import com.clenzy.service.ProviderDocumentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Justificatifs professionnels de l'intervenant connecte.
 *
 * <p>Tout se joue sur « moi » : aucun endpoint ne prend d'identifiant
 * d'utilisateur en parametre, et le service verifie la propriete de chaque piece
 * avant de la servir. Un intervenant depose et consulte SES pieces, rien
 * d'autre.</p>
 */
@RestController
@RequestMapping("/api/provider-documents")
@Tag(name = "Justificatifs prestataire")
@PreAuthorize("isAuthenticated()")
public class ProviderDocumentController {

    private final ProviderDocumentService service;

    public ProviderDocumentController(ProviderDocumentService service) {
        this.service = service;
    }

    @GetMapping("/me")
    @Operation(summary = "Lister mes justificatifs professionnels")
    public ResponseEntity<List<ProviderDocumentDto>> listMine(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(service.listMine(jwt.getSubject()).stream()
                .map(ProviderDocumentDto::from)
                .toList());
    }

    @PostMapping(value = "/me", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Deposer un justificatif")
    public ResponseEntity<ProviderDocumentDto> upload(
            @RequestParam("documentType") ProviderDocument.DocumentType documentType,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "expiresAt", required = false)
            @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
            LocalDate expiresAt,
            @AuthenticationPrincipal Jwt jwt) throws IOException {
        ProviderDocument saved = service.upload(jwt.getSubject(), documentType, file, expiresAt);
        return ResponseEntity.status(HttpStatus.CREATED).body(ProviderDocumentDto.from(saved));
    }

    @GetMapping("/me/{id}/download")
    @Operation(summary = "Telecharger un de mes justificatifs")
    public ResponseEntity<byte[]> download(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        ProviderDocumentService.DownloadPayload payload = service.download(jwt.getSubject(), id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE,
                        payload.contentType() != null ? payload.contentType() : MediaType.APPLICATION_OCTET_STREAM_VALUE)
                // `inline` et non `attachment` : l'intervenant veut relire sa
                // piece dans l'onglet, pas la re-telecharger a chaque fois.
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + payload.fileName() + "\"")
                .body(payload.data());
    }

    @DeleteMapping("/me/{id}")
    @Operation(summary = "Retirer un justificatif non encore valide")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        service.delete(jwt.getSubject(), id);
        return ResponseEntity.noContent().build();
    }

    /** Vue client d'une piece — le {@code storageKey} ne sort jamais de l'API. */
    public record ProviderDocumentDto(
            Long id,
            ProviderDocument.DocumentType documentType,
            String fileName,
            String contentType,
            Long fileSize,
            LocalDate expiresAt,
            ProviderDocument.Status status,
            String reviewNote,
            boolean currentlyValid,
            LocalDateTime createdAt) {

        static ProviderDocumentDto from(ProviderDocument doc) {
            return new ProviderDocumentDto(
                    doc.getId(),
                    doc.getDocumentType(),
                    doc.getFileName(),
                    doc.getContentType(),
                    doc.getFileSize(),
                    doc.getExpiresAt(),
                    doc.getStatus(),
                    doc.getReviewNote(),
                    doc.isCurrentlyValid(),
                    doc.getCreatedAt());
        }
    }
}
