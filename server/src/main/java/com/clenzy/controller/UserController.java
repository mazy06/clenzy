package com.clenzy.controller;

import com.clenzy.dto.UserDto;
import com.clenzy.model.User;
import com.clenzy.service.DeviceTokenService;
import com.clenzy.service.LoginProtectionService;
import com.clenzy.service.LoginProtectionService.LoginStatus;
import com.clenzy.service.UserService;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.concurrent.TimeUnit;

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

@RestController
@RequestMapping("/api/users")
@Tag(name = "Users", description = "Gestion des utilisateurs")
@PreAuthorize("isAuthenticated()")
public class UserController {
    private final UserService userService;
    private final LoginProtectionService loginProtectionService;
    private final DeviceTokenService deviceTokenService;
    private final com.clenzy.service.MediaTicketService mediaTicketService;

    public UserController(UserService userService,
                          LoginProtectionService loginProtectionService, DeviceTokenService deviceTokenService,
                          com.clenzy.service.MediaTicketService mediaTicketService) {
        this.userService = userService;
        this.loginProtectionService = loginProtectionService;
        this.deviceTokenService = deviceTokenService;
        this.mediaTicketService = mediaTicketService;
    }

    /**
     * Mise a jour partielle du profil de l'utilisateur connecte (telephone, etc.)
     */
    @PatchMapping("/me/profile")
    @Operation(summary = "Mettre a jour son propre profil (telephone, etc.)")
    public ResponseEntity<?> updateMyProfile(@RequestBody Map<String, String> body,
                                              @AuthenticationPrincipal Jwt jwt) {
        userService.updateOwnProfile(jwt.getSubject(), body);
        return ResponseEntity.ok(Map.of("success", true));
    }

    /**
     * Lecture des preferences marketing de l'utilisateur connecte.
     *
     * <p>RGPD article 7-3 : le retrait du consentement doit etre aussi simple
     * que son octroi. Cet endpoint et son pendant {@link #updateMyMarketingPreferences}
     * permettent a l'utilisateur de consulter et modifier son opt-in newsletter
     * sans support technique.</p>
     */
    @GetMapping("/me/marketing-preferences")
    @Operation(summary = "Obtenir ses preferences marketing (newsletter)")
    public ResponseEntity<Map<String, Object>> getMyMarketingPreferences(@AuthenticationPrincipal Jwt jwt) {
        boolean newsletterOptIn = userService.getNewsletterOptIn(jwt.getSubject());
        return ResponseEntity.ok(Map.of("newsletterOptIn", newsletterOptIn));
    }

    /**
     * Mise a jour des preferences marketing (newsletter opt-in).
     */
    @PutMapping("/me/marketing-preferences")
    @Operation(summary = "Mettre a jour ses preferences marketing")
    public ResponseEntity<Map<String, Object>> updateMyMarketingPreferences(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {
        Boolean newsletterOptIn = null;
        if (body.containsKey("newsletterOptIn")) {
            Object raw = body.get("newsletterOptIn");
            if (!(raw instanceof Boolean)) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", true,
                        "message", "newsletterOptIn doit etre un booleen"
                ));
            }
            newsletterOptIn = (Boolean) raw;
        }
        boolean current = userService.updateNewsletterOptIn(jwt.getSubject(), newsletterOptIn);
        return ResponseEntity.ok(Map.of("newsletterOptIn", current));
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Créer un utilisateur")
    public ResponseEntity<UserDto> create(@Validated(Create.class) @RequestBody UserDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.create(dto));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Mettre à jour un utilisateur")
    public UserDto update(@PathVariable Long id, @RequestBody UserDto dto, @AuthenticationPrincipal Jwt jwt) {
        validateOwnershipOrAdmin(id, jwt);
        return userService.update(id, dto);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtenir un utilisateur par ID")
    public UserDto get(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        validateOwnershipOrAdmin(id, jwt);
        return userService.getById(id);
    }

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Lister les utilisateurs")
    public Page<UserDto> list(@PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return userService.list(pageable);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprimer un utilisateur")
    public void delete(@PathVariable Long id) {
        userService.delete(id);
    }

    // ─── Self-delete (exigence Apple App Store) ─────────────────

    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprimer son propre compte",
            description = "Permet a l'utilisateur connecte de supprimer son propre compte. " +
                    "Supprime les tokens push, l'utilisateur Keycloak et les donnees metier. " +
                    "Exigence Apple App Store pour la suppression de compte in-app.")
    public void deleteSelf(@AuthenticationPrincipal Jwt jwt) {
        String keycloakId = jwt.getSubject();
        User user = userService.findByKeycloakId(keycloakId);
        if (user == null) {
            throw new IllegalArgumentException("Utilisateur introuvable");
        }

        // Supprimer les tokens push
        deviceTokenService.removeAllForUser(keycloakId);

        // Supprimer l'utilisateur (Keycloak + base metier)
        userService.delete(user.getId());
    }

    // ─── Login lockout management (admin only) ──────────────────

    @GetMapping("/{id}/lockout-status")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Consulter le statut de verrouillage d'un utilisateur")
    public ResponseEntity<?> getLockoutStatus(@PathVariable Long id) {
        User user = userService.findById(id).orElse(null);
        if (user == null || user.getEmail() == null) {
            return ResponseEntity.ok(Map.of("isLocked", false, "failedAttempts", 0, "remainingSeconds", 0));
        }

        LoginStatus status = loginProtectionService.checkLoginAllowed(user.getEmail());
        int failedAttempts = loginProtectionService.getFailedAttempts(user.getEmail());

        return ResponseEntity.ok(Map.of(
                "isLocked", status.isLocked(),
                "remainingSeconds", status.remainingSeconds(),
                "captchaRequired", status.captchaRequired(),
                "failedAttempts", failedAttempts
        ));
    }

    @PostMapping("/{id}/unlock")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Debloquer manuellement un utilisateur verrouille")
    public ResponseEntity<?> unlockUser(@PathVariable Long id) {
        User user = userService.findById(id).orElse(null);
        if (user == null || user.getEmail() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Utilisateur introuvable"));
        }

        loginProtectionService.forceUnlock(user.getEmail());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Utilisateur " + user.getFirstName() + " " + user.getLastName() + " debloque avec succes"
        ));
    }

    // ─── Profile picture ────────────────────────────────────────────────────

    /**
     * Upload (or replace) a user's profile picture. Self-service OR admin.
     */
    @PostMapping(value = "/{id}/profile-picture", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Uploader ou remplacer la photo de profil")
    public UserDto uploadProfilePicture(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Jwt jwt) {
        validateOwnershipOrAdmin(id, jwt);
        try {
            return userService.uploadProfilePicture(id, file);
        } catch (IllegalArgumentException e) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    /** Remove a user's profile picture. */
    @DeleteMapping("/{id}/profile-picture")
    @Operation(summary = "Supprimer la photo de profil")
    public UserDto deleteProfilePicture(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        validateOwnershipOrAdmin(id, jwt);
        return userService.deleteProfilePicture(id);
    }

    /**
     * Stream the stored profile picture. Authenticated only — the photo is not public
     * (the URL is stable per user so it caches well on the client).
     *
     * <p>Z2-SEC-06 : l'acces est borne a la meme organisation (avatars internes :
     * membres, chat, interventions), au proprietaire ou au platform staff — plus
     * d'enumeration cross-org des photos par id.</p>
     */
    @GetMapping("/{id}/profile-picture")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Recuperer la photo de profil")
    public ResponseEntity<Resource> getProfilePicture(@PathVariable Long id,
                                                      @RequestParam(value = "ticket", required = false) String ticket,
                                                      @AuthenticationPrincipal Jwt jwt) {
        // Acces (fail-closed) : soit un ticket HMAC valide scope avatar:{id} — pour la
        // consommation en <img src> ou le navigateur n'envoie pas le header Authorization —,
        // soit, a defaut, un utilisateur authentifie de la meme organisation (Z2-SEC-06).
        if (!mediaTicketService.verify("avatar:" + id, ticket)) {
            if (jwt == null) {
                return ResponseEntity.status(401).build();
            }
            validateSameOrganizationOrPlatformStaff(id, jwt);
        }
        Object[] payload = userService.streamProfilePicture(id);
        if (payload == null) {
            return ResponseEntity.notFound().build();
        }
        Resource resource = (Resource) payload[0];
        String contentType = (String) payload[1];
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePrivate())
                .body(resource);
    }

    /**
     * Verifie que l'utilisateur authentifie est le proprietaire de la ressource ou un ADMIN.
     * Le chargement de la ressource + la comparaison vivent dans UserService (T-ARCH-01) ;
     * le controller ne fait qu'extraire le role plateforme du JWT.
     */
    private void validateOwnershipOrAdmin(Long resourceUserId, Jwt jwt) {
        userService.requireOwnershipOrAdmin(resourceUserId, jwt.getSubject(), isSuperAdmin(jwt));
    }

    /**
     * Acces en lecture a la photo de profil (Z2-SEC-06) : proprietaire de la
     * ressource, membre de la meme organisation ou platform staff
     * (SUPER_ADMIN / SUPER_MANAGER, acces cross-org par design).
     */
    private void validateSameOrganizationOrPlatformStaff(Long resourceUserId, Jwt jwt) {
        userService.requireSameOrganizationOrSelf(resourceUserId, jwt.getSubject(), isPlatformStaff(jwt));
    }

    /** Admin plateforme (SUPER_ADMIN) depuis le JWT Keycloak. */
    private boolean isSuperAdmin(Jwt jwt) {
        Object realmAccess = jwt.getClaim("realm_access");
        if (realmAccess instanceof Map<?,?> ra && ra.get("roles") instanceof List<?> roles) {
            return roles.contains("SUPER_ADMIN");
        }
        return false;
    }

    /** Platform staff = acces cross-org en lecture (SUPER_ADMIN, SUPER_MANAGER). */
    private boolean isPlatformStaff(Jwt jwt) {
        Object realmAccess = jwt.getClaim("realm_access");
        if (realmAccess instanceof Map<?, ?> ra && ra.get("roles") instanceof List<?> roles) {
            return roles.contains("SUPER_ADMIN") || roles.contains("SUPER_MANAGER");
        }
        return false;
    }
}
