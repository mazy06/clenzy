package com.clenzy.controller;

import com.clenzy.dto.PropertyDto;
import com.clenzy.service.PropertyService;
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
@RequestMapping("/api/properties")
@Tag(name = "Properties", description = "Gestion des logements")
public class PropertyController {
    private final PropertyService propertyService;

    public PropertyController(PropertyService propertyService) {
        this.propertyService = propertyService;
    }

    @PostMapping
    @Operation(summary = "Créer un logement")
    public ResponseEntity<PropertyDto> create(@Validated(Create.class) @RequestBody PropertyDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(propertyService.create(dto));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Mettre à jour un logement")
    public PropertyDto update(@PathVariable Long id, @RequestBody PropertyDto dto) {
        return propertyService.update(id, dto);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtenir un logement par ID")
    public PropertyDto get(@PathVariable Long id) {
        return propertyService.getById(id);
    }

    @GetMapping
    @Operation(summary = "Lister les logements")
    public Page<PropertyDto> list(@PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
                                  @RequestParam(required = false) Long ownerId,
                                  @RequestParam(required = false) com.clenzy.model.PropertyStatus status,
                                  @RequestParam(required = false) com.clenzy.model.PropertyType type,
                                  @RequestParam(required = false) String city) {
        return propertyService.search(pageable, ownerId, status, type, city);
    }

    @GetMapping("/with-managers")
    @Operation(summary = "Lister les logements avec leurs managers associés")
    public Page<PropertyDto> listWithManagers(@PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
                                             @RequestParam(required = false) String ownerKeycloakId) {
        return propertyService.searchWithManagers(pageable, ownerKeycloakId);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprimer un logement")
    public void delete(@PathVariable Long id) {
        propertyService.delete(id);
    }
}


