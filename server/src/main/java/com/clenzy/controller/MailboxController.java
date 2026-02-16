package com.clenzy.controller;

import com.clenzy.service.MailReceiverService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controleur admin pour lire la boite mail info@clenzy.fr via IMAP.
 * Accessible uniquement aux roles ADMIN et MANAGER.
 */
@RestController
@RequestMapping("/api/admin/mailbox")
@PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
public class MailboxController {

    private final MailReceiverService mailReceiverService;

    public MailboxController(MailReceiverService mailReceiverService) {
        this.mailReceiverService = mailReceiverService;
    }

    /**
     * Teste la connexion IMAP.
     */
    @GetMapping("/status")
    public ResponseEntity<?> getStatus() {
        boolean connected = mailReceiverService.testConnection();
        return ResponseEntity.ok(Map.of(
                "imapConnected", connected,
                "message", connected ? "Connexion IMAP OK" : "IMAP non disponible ou non configure"
        ));
    }

    /**
     * Liste les dossiers IMAP disponibles.
     */
    @GetMapping("/folders")
    public ResponseEntity<?> listFolders() {
        return ResponseEntity.ok(mailReceiverService.listFolders());
    }

    /**
     * Liste les emails d'un dossier avec pagination.
     */
    @GetMapping("/emails")
    public ResponseEntity<?> listEmails(
            @RequestParam(defaultValue = "INBOX") String folder,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(mailReceiverService.listEmails(folder, page, size));
    }

    /**
     * Lit un email specifique par son numero de message.
     */
    @GetMapping("/emails/{messageNum}")
    public ResponseEntity<?> getEmail(
            @PathVariable int messageNum,
            @RequestParam(defaultValue = "INBOX") String folder) {
        Map<String, Object> email = mailReceiverService.getEmail(folder, messageNum);
        if (email.containsKey("error")) {
            return ResponseEntity.badRequest().body(email);
        }
        return ResponseEntity.ok(email);
    }
}
