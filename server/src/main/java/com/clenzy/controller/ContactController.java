package com.clenzy.controller;

import com.clenzy.dto.ContactMessageDto;
import com.clenzy.model.ContactStatus;
import com.clenzy.service.ContactService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import com.clenzy.model.User;

@RestController
@RequestMapping("/api/contact")
@CrossOrigin(origins = "*")
public class ContactController {
    
    @Autowired
    private ContactService contactService;
    
    /**
     * Créer un nouveau message de contact
     */
    @PostMapping("/messages")
    public ResponseEntity<ContactMessageDto> createMessage(
            @RequestPart("message") @Valid ContactMessageDto messageDto,
            @RequestPart(value = "files", required = false) List<MultipartFile> files,
            @AuthenticationPrincipal Jwt jwt) {
        
        try {
            ContactMessageDto createdMessage = contactService.createContactMessage(messageDto, files);
            return ResponseEntity.ok(createdMessage);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * Récupérer les messages reçus par l'utilisateur connecté
     */
    @GetMapping("/messages/received")
    public ResponseEntity<Page<ContactMessageDto>> getReceivedMessages(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal Jwt jwt) {
        
        try {
            String userId = jwt.getSubject();
            // TODO: Extraire l'ID utilisateur depuis le JWT ou la base de données
            Long userIdLong = 1L; // Temporaire
            
            Pageable pageable = PageRequest.of(page, size);
            Page<ContactMessageDto> messages = contactService.getReceivedMessages(userIdLong, pageable);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * Récupérer les messages envoyés par l'utilisateur connecté
     */
    @GetMapping("/messages/sent")
    public ResponseEntity<Page<ContactMessageDto>> getSentMessages(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal Jwt jwt) {
        
        try {
            String userId = jwt.getSubject();
            // TODO: Extraire l'ID utilisateur depuis le JWT ou la base de données
            Long userIdLong = 1L; // Temporaire
            
            Pageable pageable = PageRequest.of(page, size);
            Page<ContactMessageDto> messages = contactService.getSentMessages(userIdLong, pageable);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * Récupérer un message par son ID
     */
    @GetMapping("/messages/{messageId}")
    public ResponseEntity<ContactMessageDto> getMessageById(@PathVariable Long messageId) {
        try {
            ContactMessageDto message = contactService.getMessageById(messageId);
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
    
    /**
     * Mettre à jour le statut d'un message
     */
    @PutMapping("/messages/{messageId}/status")
    public ResponseEntity<ContactMessageDto> updateMessageStatus(
            @PathVariable Long messageId,
            @RequestParam ContactStatus status) {
        
        try {
            ContactMessageDto updatedMessage = contactService.updateMessageStatus(messageId, status);
            return ResponseEntity.ok(updatedMessage);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * Compter les messages non lus pour l'utilisateur connecté
     */
    @GetMapping("/messages/unread/count")
    public ResponseEntity<Long> countUnreadMessages(@AuthenticationPrincipal Jwt jwt) {
        try {
            String userId = jwt.getSubject();
            // TODO: Extraire l'ID utilisateur depuis le JWT ou la base de données
            Long userIdLong = 1L; // Temporaire
            
            long count = contactService.countUnreadMessages(userIdLong);
            return ResponseEntity.ok(count);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * Récupérer les messages urgents pour l'utilisateur connecté
     */
    @GetMapping("/messages/urgent")
    public ResponseEntity<List<ContactMessageDto>> getUrgentMessages(@AuthenticationPrincipal Jwt jwt) {
        try {
            String userId = jwt.getSubject();
            // TODO: Extraire l'ID utilisateur depuis le JWT ou la base de données
            Long userIdLong = 1L; // Temporaire
            
            List<ContactMessageDto> urgentMessages = contactService.getUrgentMessages(userIdLong);
            return ResponseEntity.ok(urgentMessages);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * Récupérer les destinataires autorisés pour l'utilisateur connecté
     */
    @GetMapping("/recipients")
    public ResponseEntity<List<User>> getAuthorizedRecipients(@AuthenticationPrincipal Jwt jwt) {
        try {
            String userId = jwt.getSubject();
            // TODO: Extraire l'ID utilisateur depuis le JWT ou la base de données
            Long userIdLong = 1L; // Temporaire
            
            List<User> recipients = contactService.getAuthorizedRecipients(userIdLong);
            return ResponseEntity.ok(recipients);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * Valider si l'utilisateur peut envoyer un message à un destinataire
     */
    @GetMapping("/validate/{recipientId}")
    public ResponseEntity<Map<String, Boolean>> validateRecipient(
            @PathVariable Long recipientId,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            String userId = jwt.getSubject();
            // TODO: Extraire l'ID utilisateur depuis le JWT ou la base de données
            Long userIdLong = 1L; // Temporaire
            
            boolean canSend = contactService.canSendMessage(userIdLong, recipientId);
            Map<String, Boolean> response = new HashMap<>();
            response.put("canSend", canSend);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
