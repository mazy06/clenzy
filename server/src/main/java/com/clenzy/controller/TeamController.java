package com.clenzy.controller;

import com.clenzy.dto.TeamDto;
import com.clenzy.service.TeamService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;

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
@RequestMapping("/api/teams")
@Tag(name = "Teams", description = "Gestion des équipes")
public class TeamController {
    private final TeamService teamService;

    public TeamController(TeamService teamService) {
        this.teamService = teamService;
    }

    @PostMapping
    @Operation(summary = "Créer une équipe")
    public ResponseEntity<TeamDto> create(@Validated(Create.class) @RequestBody TeamDto dto, 
                                         @AuthenticationPrincipal Jwt jwt) {
        // Vérifier les permissions
        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        
        // Log pour debug
        System.out.println("🔍 TeamController.create - JWT reçu: " + jwt.getSubject());
        
        return ResponseEntity.status(HttpStatus.CREATED).body(teamService.create(dto, jwt));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Mettre à jour une équipe")
    public TeamDto update(@PathVariable Long id, @RequestBody TeamDto dto) {
        return teamService.update(id, dto);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtenir une équipe par ID")
    public TeamDto get(@PathVariable Long id) {
        return teamService.getById(id);
    }

    @GetMapping
    @Operation(summary = "Lister les équipes")
    public Page<TeamDto> list(@PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
                               @AuthenticationPrincipal Jwt jwt) {
        // Vérifier les permissions
        if (jwt == null) {
            throw new RuntimeException("Non authentifié");
        }
        
        // Log pour debug
        System.out.println("🔍 TeamController.list - JWT reçu: " + jwt.getSubject());
        
        return teamService.list(pageable, jwt);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprimer une équipe")
    public void delete(@PathVariable Long id) {
        teamService.delete(id);
    }
}
