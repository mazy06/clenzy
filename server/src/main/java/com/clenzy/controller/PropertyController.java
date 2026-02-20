package com.clenzy.controller;

import com.clenzy.dto.PropertyDto;
import com.clenzy.service.PropertyService;
import com.clenzy.service.UserService;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.exception.UnauthorizedException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.validation.annotation.Validated;
import com.clenzy.dto.validation.Create;
import org.springframework.security.access.prepost.PreAuthorize;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api/properties")
@Tag(name = "Properties", description = "Gestion des logements")
@PreAuthorize("isAuthenticated()")
public class PropertyController {

    private static final Logger log = LoggerFactory.getLogger(PropertyController.class);

    private final PropertyService propertyService;
    private final UserService userService;

    public PropertyController(PropertyService propertyService, UserService userService) {
        this.propertyService = propertyService;
        this.userService = userService;
    }

    /**
     * Extrait le rôle de l'utilisateur depuis le JWT
     */
    private UserRole extractUserRole(Jwt jwt) {
        if (jwt == null) {
            return null;
        }

        try {
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            if (realmAccess != null) {
                Object roles = realmAccess.get("roles");
                if (roles instanceof List<?>) {
                    List<?> roleList = (List<?>) roles;
                    for (Object role : roleList) {
                        if (role instanceof String) {
                            String roleStr = (String) role;
                            // Ignorer les rôles techniques Keycloak
                            if (roleStr.equals("offline_access") ||
                                roleStr.equals("uma_authorization") ||
                                roleStr.equals("default-roles-clenzy")) {
                                continue;
                            }
                            try {
                                return UserRole.valueOf(roleStr.toUpperCase());
                            } catch (IllegalArgumentException e) {
                                continue;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Error extracting role from JWT: {}", e.getMessage());
        }

        return null;
    }

    /**
     * Vérifie si un HOST a accès à une propriété (doit être le propriétaire)
     */
    private void checkHostAccess(Long propertyId, Jwt jwt) {
        UserRole userRole = extractUserRole(jwt);
        if (userRole == UserRole.HOST && jwt != null) {
            // Récupérer l'utilisateur depuis la base de données
            String keycloakId = jwt.getSubject();
            User user = userService.findByKeycloakId(keycloakId);

            if (user != null) {
                // Vérifier directement dans le repository pour éviter la récursion
                com.clenzy.model.Property property = propertyService.getPropertyEntityById(propertyId);
                if (property == null) {
                    throw new com.clenzy.exception.NotFoundException("Property not found");
                }

                if (property.getOwner() == null || !property.getOwner().getId().equals(user.getId())) {
                    log.warn("HOST attempted access to unowned property: {}", propertyId);
                    throw new UnauthorizedException("Vous n'avez pas accès à cette propriété");
                }
            }
        }
    }

    @PostMapping
    @Operation(summary = "Créer un logement")
    public ResponseEntity<PropertyDto> create(@Validated(Create.class) @RequestBody PropertyDto dto, @AuthenticationPrincipal Jwt jwt) {
        // Si l'utilisateur est un HOST, forcer le ownerId à son propre ID
        UserRole userRole = extractUserRole(jwt);
        if (userRole == UserRole.HOST && jwt != null) {
            String keycloakId = jwt.getSubject();
            User user = userService.findByKeycloakId(keycloakId);

            if (user != null) {
                // Forcer le ownerId à l'ID de l'utilisateur HOST connecté
                dto.ownerId = user.getId();
                log.debug("HOST creating property, ownerId forced to: {}", dto.ownerId);
            } else {
                log.warn("HOST not found in database for keycloakId: {}", keycloakId);
                throw new UnauthorizedException("Utilisateur non trouvé");
            }
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(propertyService.create(dto));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Mettre à jour un logement")
    public PropertyDto update(@PathVariable Long id, @RequestBody PropertyDto dto, @AuthenticationPrincipal Jwt jwt) {
        // Vérifier l'accès pour les HOST
        checkHostAccess(id, jwt);
        return propertyService.update(id, dto);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtenir un logement par ID")
    public PropertyDto get(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        // Vérifier l'accès pour les HOST
        checkHostAccess(id, jwt);
        return propertyService.getById(id);
    }

    @GetMapping
    @Operation(summary = "Lister les logements")
    public Page<PropertyDto> list(@PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
                                  @RequestParam(required = false) Long ownerId,
                                  @RequestParam(required = false) com.clenzy.model.PropertyStatus status,
                                  @RequestParam(required = false) com.clenzy.model.PropertyType type,
                                  @RequestParam(required = false) String city,
                                  @AuthenticationPrincipal Jwt jwt) {
        // Si l'utilisateur est un HOST, filtrer automatiquement par ses propriétés
        UserRole userRole = extractUserRole(jwt);
        if (userRole == UserRole.HOST && jwt != null) {
            // Récupérer l'utilisateur depuis la base de données
            String keycloakId = jwt.getSubject();
            User user = userService.findByKeycloakId(keycloakId);

            if (user != null) {
                // Forcer le filtrage par l'ID du propriétaire HOST
                Long hostOwnerId = user.getId();
                log.debug("HOST detected, filtering by ownerId: {}", hostOwnerId);
                return propertyService.search(pageable, hostOwnerId, status, type, city);
            } else {
                log.warn("HOST not found in database for keycloakId: {}", keycloakId);
            }
        }

        // Pour ADMIN, MANAGER et autres rôles, utiliser le ownerId fourni en paramètre (ou null pour toutes)
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
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        // Vérifier l'accès pour les HOST
        checkHostAccess(id, jwt);
        propertyService.delete(id);
    }

    @GetMapping("/{propertyId}/can-assign")
    @Operation(summary = "Vérifier si l'utilisateur connecté peut assigner une demande pour cette propriété")
    public ResponseEntity<Map<String, Boolean>> canAssignForProperty(@PathVariable Long propertyId, @AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) {
            return ResponseEntity.ok(Map.of("canAssign", false));
        }

        String keycloakId = jwt.getSubject();
        User user = userService.findByKeycloakId(keycloakId);

        if (user == null) {
            return ResponseEntity.ok(Map.of("canAssign", false));
        }

        boolean canAssign = propertyService.canUserAssignForProperty(user.getId(), propertyId);
        return ResponseEntity.ok(Map.of("canAssign", canAssign));
    }
}
