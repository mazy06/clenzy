package com.clenzy.controller;

import com.clenzy.dto.BackupInfoDto;
import com.clenzy.service.DatabaseAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/database")
@Tag(name = "Database Administration", description = "Gestion des backups PostgreSQL")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class DatabaseAdminController {

    private final DatabaseAdminService databaseAdminService;

    public DatabaseAdminController(DatabaseAdminService databaseAdminService) {
        this.databaseAdminService = databaseAdminService;
    }

    @GetMapping("/backups")
    @Operation(summary = "Liste des backups disponibles")
    public ResponseEntity<?> listBackups() {
        try {
            List<BackupInfoDto> backups = databaseAdminService.listBackups();
            return ResponseEntity.ok(backups);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation des backups: " + e.getMessage()));
        }
    }

    @PostMapping("/backups")
    @Operation(summary = "Creer un nouveau dump de la base de donnees")
    public ResponseEntity<?> createBackup() {
        try {
            BackupInfoDto backup = databaseAdminService.createBackup();
            return ResponseEntity.ok(backup);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la creation du backup: " + e.getMessage()));
        }
    }

    @GetMapping("/backups/{filename}")
    @Operation(summary = "Telecharger un backup")
    public ResponseEntity<?> downloadBackup(@PathVariable String filename) {
        try {
            Resource resource = databaseAdminService.downloadBackup(filename);
            final String contentType = filename.endsWith(".gz")
                    ? "application/gzip"
                    : "application/sql";

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .body(resource);
        } catch (SecurityException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors du telechargement: " + e.getMessage()));
        }
    }

    @DeleteMapping("/backups/{filename}")
    @Operation(summary = "Supprimer un backup")
    public ResponseEntity<?> deleteBackup(@PathVariable String filename) {
        try {
            databaseAdminService.deleteBackup(filename);
            return ResponseEntity.ok(Map.of("message", "Backup supprime: " + filename));
        } catch (SecurityException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la suppression: " + e.getMessage()));
        }
    }
}
