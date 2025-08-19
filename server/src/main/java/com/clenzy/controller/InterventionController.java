package com.clenzy.controller;

import com.clenzy.dto.InterventionDto;
import com.clenzy.service.InterventionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;

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
    
    private final InterventionService interventionService;
    
    public InterventionController(InterventionService interventionService) {
        this.interventionService = interventionService;
    }
    
    @PostMapping
    @Operation(summary = "Créer une intervention")
    public ResponseEntity<InterventionDto> create(@Validated(Create.class) @RequestBody InterventionDto dto, 
                                                 @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.status(HttpStatus.CREATED).body(interventionService.create(dto, jwt));
    }
    
    @PutMapping("/{id}")
    @Operation(summary = "Mettre à jour une intervention")
    public InterventionDto update(@PathVariable Long id, @RequestBody InterventionDto dto, 
                                 @AuthenticationPrincipal Jwt jwt) {
        return interventionService.update(id, dto, jwt);
    }
    
    @GetMapping("/{id}")
    @Operation(summary = "Obtenir une intervention par ID")
    public InterventionDto get(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return interventionService.getById(id, jwt);
    }
    
    @GetMapping
    @Operation(summary = "Lister les interventions avec contrôle d'accès basé sur les rôles")
    public Page<InterventionDto> list(@PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
                                      @RequestParam(required = false) Long propertyId,
                                      @RequestParam(required = false) String type,
                                      @RequestParam(required = false) String status,
                                      @RequestParam(required = false) String priority,
                                      @AuthenticationPrincipal Jwt jwt) {
        // Log pour diagnostiquer l'authentification
        if (jwt != null) {
            System.out.println("🔍 JWT reçu: " + jwt.getSubject());
            System.out.println("🔍 JWT claims: " + jwt.getClaims());
        } else {
            System.out.println("🔍 Aucun JWT reçu");
        }
        return interventionService.listWithRoleBasedAccess(pageable, propertyId, type, status, priority, jwt);
    }
    
    // Endpoint de test temporaire pour diagnostiquer
    @GetMapping("/test")
    @Operation(summary = "Test d'authentification")
    public ResponseEntity<String> testAuth(@AuthenticationPrincipal Jwt jwt) {
        if (jwt != null) {
            return ResponseEntity.ok("Authentifié: " + jwt.getSubject() + " - Claims: " + jwt.getClaims());
        } else {
            return ResponseEntity.status(401).body("Non authentifié");
        }
    }
    
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprimer une intervention")
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        interventionService.delete(id, jwt);
    }
    
    @PutMapping("/{id}/status")
    @Operation(summary = "Mettre à jour le statut d'une intervention")
    public InterventionDto updateStatus(@PathVariable Long id, @RequestParam String status, 
                                       @AuthenticationPrincipal Jwt jwt) {
        return interventionService.updateStatus(id, status, jwt);
    }
    
    @PutMapping("/{id}/assign")
    @Operation(summary = "Assigner une intervention à un utilisateur ou une équipe")
    public InterventionDto assign(@PathVariable Long id, @RequestParam(required = false) Long userId, 
                                  @RequestParam(required = false) Long teamId, @AuthenticationPrincipal Jwt jwt) {
        return interventionService.assign(id, userId, teamId, jwt);
    }
}
