package com.clenzy.controller;

import com.clenzy.dto.ProspectDto;
import com.clenzy.model.Prospect.ProspectCategory;
import com.clenzy.service.ProspectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/prospects")
@PreAuthorize("isAuthenticated()")
@Tag(name = "Prospects", description = "Gestion des prospects B2B")
public class ProspectController {

    private static final Logger log = LoggerFactory.getLogger(ProspectController.class);

    private final ProspectService prospectService;

    public ProspectController(ProspectService prospectService) {
        this.prospectService = prospectService;
    }

    @GetMapping
    @Operation(summary = "Liste tous les prospects de l'organisation")
    public ResponseEntity<List<ProspectDto>> getAll() {
        return ResponseEntity.ok(prospectService.getAll());
    }

    @GetMapping("/category/{category}")
    @Operation(summary = "Liste les prospects par categorie")
    public ResponseEntity<List<ProspectDto>> getByCategory(@PathVariable String category) {
        ProspectCategory cat = ProspectCategory.valueOf(category.toUpperCase());
        return ResponseEntity.ok(prospectService.getByCategory(cat));
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Importe des prospects depuis un fichier CSV")
    public ResponseEntity<Map<String, Object>> importCsv(
            @RequestParam("file") MultipartFile file,
            @RequestParam("category") String category) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", "Fichier vide"));
        }

        ProspectCategory cat;
        try {
            cat = ProspectCategory.valueOf(category.toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", "Categorie invalide: " + category));
        }

        int imported = prospectService.importFromCsv(file, cat);
        log.info("CSV import: {} prospects imported in category {}", imported, cat);

        return ResponseEntity.status(HttpStatus.CREATED)
            .body(Map.of("imported", imported, "category", cat.name()));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Met a jour un prospect")
    public ResponseEntity<ProspectDto> update(@PathVariable Long id, @RequestBody ProspectDto dto) {
        return ResponseEntity.ok(prospectService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprime un prospect")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        prospectService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
