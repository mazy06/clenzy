package com.clenzy.controller;

import com.clenzy.service.storage.BinaryAssetMigrationService;
import com.clenzy.service.storage.InterventionPhotoMigrationService;
import com.clenzy.service.storage.PhotoStorageMigrationService;
import com.clenzy.service.storage.PhotoStorageMigrationService.MigrationResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Declencheur <b>MANUEL</b> des migrations de binaires BYTEA -> stockage objet OVH.
 *
 * <p>Reserve au {@code SUPER_ADMIN} plateforme (operations d'infrastructure, scope global,
 * non org-scopees). Controller mince : valide l'entree, delegue au service, mappe le resultat.
 * Aucune logique ni transaction ici (regle audit #4).</p>
 *
 * <p>Aucune migration ne s'execute automatiquement : c'est un appel explicite qui la declenche.
 * Toutes sont idempotentes (relancer est sans danger) et NON destructives (le BYTEA n'est jamais
 * efface). Couvre : photos de propriete, photos d'intervention, assets binaires (avatars).</p>
 */
@RestController
@RequestMapping("/api/admin/storage")
@Tag(name = "Storage Migration", description = "Migration manuelle des binaires BYTEA -> stockage objet")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class StorageMigrationAdminController {

    private final PhotoStorageMigrationService photoMigrationService;
    private final InterventionPhotoMigrationService interventionPhotoMigrationService;
    private final BinaryAssetMigrationService binaryAssetMigrationService;

    public StorageMigrationAdminController(PhotoStorageMigrationService photoMigrationService,
                                           InterventionPhotoMigrationService interventionPhotoMigrationService,
                                           BinaryAssetMigrationService binaryAssetMigrationService) {
        this.photoMigrationService = photoMigrationService;
        this.interventionPhotoMigrationService = interventionPhotoMigrationService;
        this.binaryAssetMigrationService = binaryAssetMigrationService;
    }

    @PostMapping("/migrate-photos")
    @Operation(summary = "Migre les photos de propriete BYTEA -> stockage objet (idempotent, non destructif)",
            description = "Parcourt les property_photos par batch, copie les bytes vers OVH Object Storage, "
                    + "verifie la copie (taille + checksum) puis ecrit la cle objet dans storage_key. "
                    + "Le BYTEA n'est PAS supprime (purge ulterieure apres validation humaine). "
                    + "Reserve SUPER_ADMIN. Declenche manuellement uniquement.")
    public ResponseEntity<Map<String, Object>> migratePhotos(
            @RequestParam(value = "batchSize", required = false, defaultValue = "0") int batchSize) {
        return ResponseEntity.ok(toBody(photoMigrationService.migrate(batchSize)));
    }

    @PostMapping("/migrate-intervention-photos")
    @Operation(summary = "Migre les photos d'intervention BYTEA -> stockage objet (idempotent, non destructif)",
            description = "Parcourt les intervention_photos par batch, copie les bytes vers OVH Object Storage "
                    + "(cle org/{orgId}/intervention-photos/{uuid}), verifie la copie (taille + checksum) puis "
                    + "ecrit la cle objet dans storage_key. Le BYTEA n'est PAS supprime. "
                    + "Reserve SUPER_ADMIN. Declenche manuellement uniquement.")
    public ResponseEntity<Map<String, Object>> migrateInterventionPhotos(
            @RequestParam(value = "batchSize", required = false, defaultValue = "0") int batchSize) {
        return ResponseEntity.ok(toBody(interventionPhotoMigrationService.migrate(batchSize)));
    }

    @PostMapping("/migrate-binary-assets")
    @Operation(summary = "Migre les binary_asset (avatars) BYTEA -> stockage objet (idempotent, non destructif)",
            description = "Parcourt les binary_asset par batch, copie les bytes vers OVH Object Storage sous "
                    + "leur cle logique verbatim (ex users/{userId}/{uuid}.png), verifie la copie "
                    + "(taille + checksum). Idempotent (saute si l'objet existe deja). La ligne binary_asset "
                    + "n'est PAS supprimee. Reserve SUPER_ADMIN. Declenche manuellement uniquement.")
    public ResponseEntity<Map<String, Object>> migrateBinaryAssets(
            @RequestParam(value = "batchSize", required = false, defaultValue = "0") int batchSize) {
        final BinaryAssetMigrationService.MigrationResult result =
                binaryAssetMigrationService.migrate(batchSize);
        return ResponseEntity.ok(toBody(
                result.scanned(), result.migrated(), result.skipped(), result.failed()));
    }

    private static Map<String, Object> toBody(MigrationResult result) {
        return toBody(result.scanned(), result.migrated(), result.skipped(), result.failed());
    }

    private static Map<String, Object> toBody(InterventionPhotoMigrationService.MigrationResult result) {
        return toBody(result.scanned(), result.migrated(), result.skipped(), result.failed());
    }

    private static Map<String, Object> toBody(int scanned, int migrated, int skipped, int failed) {
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("scanned", scanned);
        body.put("migrated", migrated);
        body.put("skipped", skipped);
        body.put("failed", failed);
        return body;
    }
}
