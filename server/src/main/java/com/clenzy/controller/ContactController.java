package com.clenzy.controller;

import com.clenzy.dto.ContactAttachmentDto;
import com.clenzy.dto.ContactBulkDeleteRequest;
import com.clenzy.dto.ContactBulkStatusRequest;
import com.clenzy.dto.ContactMessageDto;
import com.clenzy.dto.ContactSendRequest;
import com.clenzy.model.ContactMessage;
import com.clenzy.service.ContactFileStorageService;
import com.clenzy.service.ContactMessageService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/contact")
@PreAuthorize("isAuthenticated()")
@Tag(name = "Contact", description = "Gestion des messages de contact")
public class ContactController {

    private static final Logger log = LoggerFactory.getLogger(ContactController.class);

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final ContactMessageService contactMessageService;
    private final ContactFileStorageService fileStorageService;

    public ContactController(ContactMessageService contactMessageService,
                              ContactFileStorageService fileStorageService) {
        this.contactMessageService = contactMessageService;
        this.fileStorageService = fileStorageService;
    }

    // ─── Lecture (contact:view) ─────────────────────────────────────────────

    @GetMapping("/messages/inbox")
    @Operation(summary = "Recuperer les messages recus")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST','TECHNICIAN','HOUSEKEEPER','SUPERVISOR','LAUNDRY','EXTERIOR_TECH')")
    public ResponseEntity<Page<ContactMessageDto>> getInboxMessages(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(contactMessageService.listMessages("inbox", safePageable(page, size), jwt));
    }

    @GetMapping("/messages/received")
    @Operation(summary = "Compatibilite: alias vers inbox")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST','TECHNICIAN','HOUSEKEEPER','SUPERVISOR','LAUNDRY','EXTERIOR_TECH')")
    public ResponseEntity<Page<ContactMessageDto>> getReceivedMessages(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(contactMessageService.listMessages("inbox", safePageable(page, size), jwt));
    }

    @GetMapping("/messages/sent")
    @Operation(summary = "Recuperer les messages envoyes")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST','TECHNICIAN','HOUSEKEEPER','SUPERVISOR','LAUNDRY','EXTERIOR_TECH')")
    public ResponseEntity<Page<ContactMessageDto>> getSentMessages(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(contactMessageService.listMessages("sent", safePageable(page, size), jwt));
    }

    @GetMapping("/messages/archived")
    @Operation(summary = "Recuperer les messages archives")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST','TECHNICIAN','HOUSEKEEPER','SUPERVISOR','LAUNDRY','EXTERIOR_TECH')")
    public ResponseEntity<Page<ContactMessageDto>> getArchivedMessages(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(contactMessageService.listMessages("archived", safePageable(page, size), jwt));
    }

    @GetMapping("/recipients")
    @Operation(summary = "Recuperer la liste des destinataires autorises")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST','TECHNICIAN','HOUSEKEEPER','SUPERVISOR','LAUNDRY','EXTERIOR_TECH')")
    public ResponseEntity<?> getRecipients(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(contactMessageService.listRecipients(jwt));
    }

    @PutMapping("/messages/{id}/status")
    @Operation(summary = "Mettre a jour le statut d'un message")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST','TECHNICIAN','HOUSEKEEPER','SUPERVISOR','LAUNDRY','EXTERIOR_TECH')")
    public ResponseEntity<ContactMessageDto> updateMessageStatus(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @RequestParam String status
    ) {
        return ResponseEntity.ok(contactMessageService.updateStatus(jwt, id, status));
    }

    @PutMapping("/messages/{id}/archive")
    @Operation(summary = "Archiver un message")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST','TECHNICIAN','HOUSEKEEPER','SUPERVISOR','LAUNDRY','EXTERIOR_TECH')")
    public ResponseEntity<ContactMessageDto> archiveMessage(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return ResponseEntity.ok(contactMessageService.archiveMessage(jwt, id));
    }

    @PutMapping("/messages/{id}/unarchive")
    @Operation(summary = "Desarchiver un message")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST','TECHNICIAN','HOUSEKEEPER','SUPERVISOR','LAUNDRY','EXTERIOR_TECH')")
    public ResponseEntity<ContactMessageDto> unarchiveMessage(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return ResponseEntity.ok(contactMessageService.unarchiveMessage(jwt, id));
    }

    // ─── Telechargement pieces jointes ─────────────────────────────────────

    @GetMapping("/messages/{messageId}/attachments/{attachmentId}")
    @Operation(summary = "Telecharger une piece jointe")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST','TECHNICIAN','HOUSEKEEPER','SUPERVISOR','LAUNDRY','EXTERIOR_TECH')")
    public ResponseEntity<Resource> downloadAttachment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long messageId,
            @PathVariable String attachmentId
    ) {
        // 1. Valider l'acces utilisateur au message
        ContactMessage message = contactMessageService.getMessageForUser(messageId, jwt);

        // 2. Chercher la piece jointe dans les metadonnees
        List<ContactAttachmentDto> attachments = parseAttachments(message.getAttachments());
        ContactAttachmentDto attachment = attachments.stream()
                .filter(a -> attachmentId.equals(a.id()))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("Piece jointe introuvable"));

        // 3. Verifier que le fichier est disponible
        if (attachment.storagePath() == null || attachment.storagePath().isBlank()) {
            throw new NoSuchElementException("Fichier non disponible en telechargement");
        }

        // 4. Charger le fichier en streaming
        Resource resource = fileStorageService.load(attachment.storagePath());

        // 5. Content-Disposition avec encodage RFC 5987 pour les noms non-ASCII
        String encodedFilename = URLEncoder.encode(attachment.originalName(), StandardCharsets.UTF_8)
                .replace("+", "%20");
        String contentDisposition = "attachment; filename=\"" + attachment.originalName() + "\"; "
                + "filename*=UTF-8''" + encodedFilename;

        return ResponseEntity.ok()
                .header("Content-Type", attachment.contentType())
                .header("Content-Disposition", contentDisposition)
                .header("Cache-Control", "private, max-age=86400")
                .body(resource);
    }

    private List<ContactAttachmentDto> parseAttachments(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return MAPPER.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    // ─── Envoi (contact:send) ──────────────────────────────────────────────

    @PostMapping(value = "/messages")
    @Operation(summary = "Envoyer un message de contact (multipart)")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<ContactMessageDto> sendMessage(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam String recipientId,
            @RequestParam String subject,
            @RequestParam String message,
            @RequestParam(defaultValue = "MEDIUM") String priority,
            @RequestParam(defaultValue = "GENERAL") String category,
            @RequestParam(value = "attachments", required = false) List<MultipartFile> attachments
    ) {
        ContactMessageDto created = contactMessageService.sendMessage(
                jwt, recipientId, subject, message, priority, category, attachments
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping(value = "/messages/json", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Envoyer un message de contact (json)")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<ContactMessageDto> sendMessageJson(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody ContactSendRequest request
    ) {
        ContactMessageDto created = contactMessageService.sendMessage(
                jwt,
                request.recipientId(),
                request.subject(),
                request.message(),
                request.priority() != null ? request.priority() : "MEDIUM",
                request.category() != null ? request.category() : "GENERAL",
                List.of()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping(value = "/messages/{id}/reply")
    @Operation(summary = "Repondre a un message")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<ContactMessageDto> replyToMessage(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @RequestParam String message,
            @RequestParam(value = "attachments", required = false) List<MultipartFile> attachments
    ) {
        ContactMessageDto reply = contactMessageService.replyToMessage(jwt, id, message, attachments);
        return ResponseEntity.status(HttpStatus.CREATED).body(reply);
    }

    // ─── Gestion (contact:manage) ──────────────────────────────────────────

    @DeleteMapping("/messages/{id}")
    @Operation(summary = "Supprimer un message")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> deleteMessage(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        contactMessageService.deleteMessage(jwt, id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/messages/bulk/status")
    @Operation(summary = "Mettre a jour le statut de plusieurs messages")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> bulkUpdateStatus(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody ContactBulkStatusRequest request
    ) {
        return ResponseEntity.ok(contactMessageService.bulkUpdateStatus(jwt, request.ids(), request.status()));
    }

    @PostMapping("/messages/bulk/delete")
    @Operation(summary = "Supprimer plusieurs messages")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> bulkDelete(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody ContactBulkDeleteRequest request
    ) {
        return ResponseEntity.ok(contactMessageService.bulkDelete(jwt, request.ids()));
    }

    // ─── Exception handlers ───────────────────────────────────────────────

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(SecurityException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NoSuchElementException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception e) {
        log.error("Erreur sur le module contact: {}", e.getMessage(), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur interne"));
    }

    private Pageable safePageable(int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        return PageRequest.of(safePage, safeSize);
    }
}
