package com.clenzy.controller;

import com.clenzy.service.storage.offload.InlineBinaryOffloadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Déclenchement immédiat de la reprise des fichiers vers le stockage objet OVH (sinon lancée
 * automatiquement par {@code StorageOffloadScheduler}).
 *
 * <p>Réservé au {@code SUPER_ADMIN} plateforme (opération d'infrastructure, non org-scopée).
 * Contrôleur mince : délègue au service et renvoie le bilan par famille (règle audit n°4).</p>
 */
@RestController
@RequestMapping("/api/admin/storage")
@Tag(name = "Storage Offload", description = "Reprise des fichiers vers le stockage objet")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class StorageMigrationAdminController {

    private final InlineBinaryOffloadService offloadService;

    public StorageMigrationAdminController(InlineBinaryOffloadService offloadService) {
        this.offloadService = offloadService;
    }

    @PostMapping("/offload")
    @Operation(summary = "Déplace vers le stockage objet les fichiers encore en base ou sur le disque",
            description = "Pour chaque famille basculée sur le stockage objet : copie, vérification (taille + "
                    + "SHA-256), enregistrement de la clé puis effacement de l'ancienne copie. Idempotent.")
    public ResponseEntity<List<InlineBinaryOffloadService.OffloadResult>> offload() {
        return ResponseEntity.ok(offloadService.offloadAll());
    }
}
