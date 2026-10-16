package com.clenzy.controller;

import com.clenzy.service.PropertyMapStateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** État du jour des logements (arrivée, départ, rotation, occupé) pour les épingles de la carte. */
@RestController
@RequestMapping("/api/properties/map-states")
@Tag(name = "Properties", description = "Etat du jour des logements pour la carte")
@PreAuthorize("isAuthenticated()")
public class PropertyMapStateController {

    private final PropertyMapStateService service;

    public PropertyMapStateController(PropertyMapStateService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Etat du jour de chaque logement occupe ou en mouvement (les libres sont absents)")
    public List<PropertyMapStateService.PropertyMapState> todayStates() {
        return service.todayStates();
    }
}
