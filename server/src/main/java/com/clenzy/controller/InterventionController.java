package com.clenzy.controller;

import com.clenzy.dto.InterventionDto;
import com.clenzy.service.InterventionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.validation.annotation.Validated;
import com.clenzy.dto.validation.Create;

@RestController
@RequestMapping("/api/interventions")
@Tag(name = "Interventions", description = "Gestion des interventions")
public class InterventionController {
    private final InterventionService service;

    public InterventionController(InterventionService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(summary = "Créer une intervention")
    public ResponseEntity<InterventionDto> create(@Validated(Create.class) @RequestBody InterventionDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(dto));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Mettre à jour une intervention")
    public InterventionDto update(@PathVariable Long id, @RequestBody InterventionDto dto) {
        return service.update(id, dto);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtenir une intervention par ID")
    public InterventionDto get(@PathVariable Long id) {
        return service.getById(id);
    }

    @GetMapping
    @Operation(summary = "Lister les interventions")
    public Page<InterventionDto> list(@PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
                                      @RequestParam(required = false) Long propertyId,
                                      @RequestParam(required = false) Long technicianId,
                                      @RequestParam(required = false) com.clenzy.model.InterventionStatus status,
                                      @RequestParam(required = false) com.clenzy.model.InterventionType type) {
        return service.search(pageable, propertyId, technicianId, status, type);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprimer une intervention")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}


