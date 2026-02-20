package com.clenzy.controller;

import com.clenzy.dto.PropertyTeamDto;
import com.clenzy.dto.PropertyTeamRequest;
import com.clenzy.service.PropertyTeamService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * Gestion des equipes assignees aux proprietes.
 * Restreint aux ADMIN et MANAGER — les HOST n'ont pas besoin de gerer les equipes directement.
 */
@RestController
@RequestMapping("/api/property-teams")
@PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
public class PropertyTeamController {

    @Autowired
    private PropertyTeamService propertyTeamService;

    /**
     * Recuperer l'equipe assignee a une propriete
     */
    @GetMapping("/property/{propertyId}")
    public ResponseEntity<PropertyTeamDto> getByProperty(@PathVariable Long propertyId) {
        return propertyTeamService.getByProperty(propertyId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.noContent().build());
    }

    /**
     * Recuperer les equipes de plusieurs proprietes (batch)
     */
    @PostMapping("/by-properties")
    public ResponseEntity<List<PropertyTeamDto>> getByProperties(@RequestBody List<Long> propertyIds) {
        List<PropertyTeamDto> mappings = propertyTeamService.getByProperties(propertyIds);
        return ResponseEntity.ok(mappings);
    }

    /**
     * Assigner une equipe a une propriete (upsert)
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PropertyTeamDto> assign(@RequestBody PropertyTeamRequest request) {
        PropertyTeamDto dto = propertyTeamService.assignTeamToProperty(request);
        return ResponseEntity.ok(dto);
    }

    /**
     * Retirer l'equipe d'une propriete
     */
    @DeleteMapping("/property/{propertyId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> remove(@PathVariable Long propertyId) {
        propertyTeamService.removeTeamFromProperty(propertyId);
        return ResponseEntity.noContent().build();
    }
}
