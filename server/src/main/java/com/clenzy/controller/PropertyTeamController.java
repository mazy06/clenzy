package com.clenzy.controller;

import com.clenzy.dto.PropertyTeamDto;
import com.clenzy.dto.PropertyTeamRequest;
import com.clenzy.service.PropertyTeamService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/property-teams")
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
    public ResponseEntity<PropertyTeamDto> assign(@RequestBody PropertyTeamRequest request) {
        PropertyTeamDto dto = propertyTeamService.assignTeamToProperty(request);
        return ResponseEntity.ok(dto);
    }

    /**
     * Retirer l'equipe d'une propriete
     */
    @DeleteMapping("/property/{propertyId}")
    public ResponseEntity<Void> remove(@PathVariable Long propertyId) {
        propertyTeamService.removeTeamFromProperty(propertyId);
        return ResponseEntity.noContent().build();
    }
}
