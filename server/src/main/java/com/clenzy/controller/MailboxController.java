package com.clenzy.controller;

import com.clenzy.service.MailReceiverService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controleur admin pour lire la boîte mail info@clenzy.fr via IMAP.
 * Accessible uniquement aux rôles ADMIN et MANAGER.
 */
@RestController
@RequestMapping("/api/admin/mailbox")
public class MailboxController {

    private static final Logger log = LoggerFactory.getLogger(MailboxController.class);

    private final MailReceiverService mailReceiverService;

    public MailboxController(MailReceiverService mailReceiverService) {
        this.mailReceiverService = mailReceiverService;
    }

    /**
     * Teste la connexion IMAP.
     */
    @GetMapping("/status")
    public ResponseEntity<?> getStatus(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!hasRole(jwt, "ADMIN") && !hasRole(jwt, "MANAGER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        boolean connected = mailReceiverService.testConnection();
        return ResponseEntity.ok(Map.of(
                "imapConnected", connected,
                "message", connected ? "Connexion IMAP OK" : "IMAP non disponible ou non configuré"
        ));
    }

    /**
     * Liste les dossiers IMAP disponibles.
     */
    @GetMapping("/folders")
    public ResponseEntity<?> listFolders(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!hasRole(jwt, "ADMIN") && !hasRole(jwt, "MANAGER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok(mailReceiverService.listFolders());
    }

    /**
     * Liste les emails d'un dossier avec pagination.
     */
    @GetMapping("/emails")
    public ResponseEntity<?> listEmails(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "INBOX") String folder,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        if (jwt == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!hasRole(jwt, "ADMIN") && !hasRole(jwt, "MANAGER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok(mailReceiverService.listEmails(folder, page, size));
    }

    /**
     * Lit un email spécifique par son numéro de message.
     */
    @GetMapping("/emails/{messageNum}")
    public ResponseEntity<?> getEmail(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable int messageNum,
            @RequestParam(defaultValue = "INBOX") String folder) {

        if (jwt == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!hasRole(jwt, "ADMIN") && !hasRole(jwt, "MANAGER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Map<String, Object> email = mailReceiverService.getEmail(folder, messageNum);
        if (email.containsKey("error")) {
            return ResponseEntity.badRequest().body(email);
        }
        return ResponseEntity.ok(email);
    }

    // ─── Role check JWT ───────────────────────────────────────────

    private boolean hasRole(Jwt jwt, String role) {
        try {
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            if (realmAccess != null) {
                Object roles = realmAccess.get("roles");
                if (roles instanceof List<?>) {
                    return ((List<?>) roles).stream()
                            .anyMatch(r -> role.equals(r.toString()));
                }
            }
        } catch (Exception e) {
            log.warn("Erreur extraction role JWT: {}", e.getMessage());
        }
        return false;
    }
}
