package com.clenzy.controller;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/contact")
@Tag(name = "Contact", description = "Gestion des messages de contact")
public class ContactController {

    @GetMapping("/messages/received")
    @Operation(summary = "Récupérer les messages reçus")
    public ResponseEntity<Page<Map<String, Object>>> getReceivedMessages(
            @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        // Pour l'instant, retourner une page vide
        // TODO: Implémenter la vraie logique avec le service et le repository
        Page<Map<String, Object>> emptyPage = new PageImpl<>(new ArrayList<>(), pageable, 0);
        return ResponseEntity.ok(emptyPage);
    }

    @GetMapping("/messages/sent")
    @Operation(summary = "Récupérer les messages envoyés")
    public ResponseEntity<Page<Map<String, Object>>> getSentMessages(
            @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        // Pour l'instant, retourner une page vide
        // TODO: Implémenter la vraie logique avec le service et le repository
        Page<Map<String, Object>> emptyPage = new PageImpl<>(new ArrayList<>(), pageable, 0);
        return ResponseEntity.ok(emptyPage);
    }

    @GetMapping("/recipients")
    @Operation(summary = "Récupérer la liste des destinataires autorisés")
    public ResponseEntity<List<Map<String, Object>>> getRecipients() {
        // Pour l'instant, retourner une liste vide
        // TODO: Implémenter la vraie logique pour récupérer les utilisateurs autorisés
        return ResponseEntity.ok(new ArrayList<>());
    }

    @PostMapping("/messages")
    @Operation(summary = "Envoyer un message de contact")
    public ResponseEntity<Map<String, Object>> sendMessage(@RequestBody Map<String, Object> messageData) {
        // Pour l'instant, retourner un succès
        // TODO: Implémenter la vraie logique pour sauvegarder le message
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Message envoyé avec succès");
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/messages/{id}/status")
    @Operation(summary = "Mettre à jour le statut d'un message")
    public ResponseEntity<Map<String, Object>> updateMessageStatus(
            @PathVariable String id,
            @RequestParam String status) {
        // Pour l'instant, retourner un succès
        // TODO: Implémenter la vraie logique pour mettre à jour le statut
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Statut mis à jour avec succès");
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/messages/{id}")
    @Operation(summary = "Supprimer un message")
    public ResponseEntity<Void> deleteMessage(@PathVariable String id) {
        // Pour l'instant, retourner un succès
        // TODO: Implémenter la vraie logique pour supprimer le message
        return ResponseEntity.noContent().build();
    }
}
