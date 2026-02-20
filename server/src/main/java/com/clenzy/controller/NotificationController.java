package com.clenzy.controller;

import com.clenzy.dto.NotificationDto;
import com.clenzy.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/notifications")
@Tag(name = "Notifications", description = "Gestion des notifications utilisateur")
@PreAuthorize("isAuthenticated()")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    @Operation(summary = "Lister les notifications de l'utilisateur connecte",
            description = "Retourne toutes les notifications de l'utilisateur, triees par date descendante.")
    public ResponseEntity<List<NotificationDto>> getAll(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        List<NotificationDto> notifications = notificationService.getAllForUser(userId);
        return ResponseEntity.ok(notifications);
    }

    @GetMapping("/unread-count")
    @Operation(summary = "Obtenir le nombre de notifications non lues",
            description = "Retourne le compteur de notifications non lues pour l'utilisateur connecte.")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        long count = notificationService.getUnreadCount(userId);
        return ResponseEntity.ok(Map.of("count", count));
    }

    @PatchMapping("/{id}/read")
    @Operation(summary = "Marquer une notification comme lue",
            description = "Marque la notification specifiee comme lue. L'utilisateur doit etre le destinataire.")
    public ResponseEntity<NotificationDto> markAsRead(@PathVariable Long id,
                                                       @AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        NotificationDto notification = notificationService.markAsRead(id, userId);
        return ResponseEntity.ok(notification);
    }

    @PatchMapping("/read-all")
    @Operation(summary = "Marquer toutes les notifications comme lues",
            description = "Marque toutes les notifications non lues de l'utilisateur connecte comme lues.")
    public ResponseEntity<Void> markAllAsRead(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprimer une notification",
            description = "Supprime la notification specifiee. L'utilisateur doit etre le destinataire.")
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        notificationService.delete(id, userId);
    }
}
