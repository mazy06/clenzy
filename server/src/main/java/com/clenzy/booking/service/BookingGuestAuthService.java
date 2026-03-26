package com.clenzy.booking.service;

import com.clenzy.booking.dto.*;
import com.clenzy.booking.model.BookingGuestProfile;
import com.clenzy.booking.repository.BookingGuestProfileRepository;
import org.keycloak.admin.client.CreatedResponseUtil;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.KeycloakBuilder;
import org.keycloak.admin.client.resource.UsersResource;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.keycloak.representations.idm.RoleRepresentation;
import org.keycloak.representations.idm.UserRepresentation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import jakarta.ws.rs.core.Response;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class BookingGuestAuthService {

    private static final Logger log = LoggerFactory.getLogger(BookingGuestAuthService.class);

    private static final String GUEST_REALM = "clenzy-guests";
    private static final String GUEST_CLIENT_ID = "booking-engine-client";
    private static final String GUEST_ROLE = "BOOKING_GUEST";
    private static final String ATTR_ORG_IDS = "org_ids";

    private final Keycloak keycloakAdmin;
    private final BookingGuestProfileRepository profileRepository;
    private final RestTemplate restTemplate;

    @Value("${keycloak.auth-server-url:http://clenzy-keycloak:8080}")
    private String keycloakUrl;

    @Value("${keycloak.guest-client-secret:}")
    private String guestClientSecret;

    public BookingGuestAuthService(Keycloak keycloakAdmin,
                                   BookingGuestProfileRepository profileRepository,
                                   RestTemplate restTemplate) {
        this.keycloakAdmin = keycloakAdmin;
        this.profileRepository = profileRepository;
        this.restTemplate = restTemplate;
    }

    /**
     * Inscrit un guest : crée (ou met à jour) le user Keycloak dans le realm clenzy-guests,
     * puis crée un profil local lié à l'organisation.
     */
    @Transactional
    public GuestAuthResponse register(GuestRegisterRequest req) {
        final Long orgId = req.organizationId();

        // Vérifier si un profil existe déjà pour cet email + org
        if (profileRepository.existsByEmailAndOrganizationId(req.email(), orgId)) {
            throw new IllegalArgumentException("Un compte existe déjà pour cet email dans cette organisation");
        }

        UsersResource usersResource = keycloakAdmin.realm(GUEST_REALM).users();

        // Chercher si le user existe déjà dans Keycloak (même email, autre org)
        List<UserRepresentation> existing = usersResource.searchByEmail(req.email(), true);
        String keycloakId;

        if (!existing.isEmpty()) {
            // User existe déjà — ajouter l'org à ses attributs
            UserRepresentation user = existing.get(0);
            keycloakId = user.getId();
            addOrgToUser(user, orgId);
            usersResource.get(keycloakId).update(user);
            log.info("Guest Keycloak existant {}, ajout org={}", keycloakId, orgId);
        } else {
            // Créer le user dans Keycloak
            keycloakId = createKeycloakGuest(usersResource, req, orgId);
            log.info("Guest Keycloak créé {}, org={}", keycloakId, orgId);
        }

        // Créer le profil local
        BookingGuestProfile profile = new BookingGuestProfile();
        profile.setKeycloakId(keycloakId);
        profile.setEmail(req.email());
        profile.setFirstName(req.firstName());
        profile.setLastName(req.lastName());
        profile.setPhone(req.phone());
        profile.setOrganizationId(orgId);
        profile.setEmailVerified(false);
        profileRepository.save(profile);

        // Obtenir les tokens via password grant
        return authenticateAndBuildResponse(req.email(), req.password(), profile);
    }

    /**
     * Connecte un guest existant via Keycloak token endpoint.
     */
    @Transactional
    public GuestAuthResponse login(GuestLoginRequest req) {
        final Long orgId = req.organizationId();

        // Vérifier que le profil existe pour cet email + org
        BookingGuestProfile profile = profileRepository
            .findByEmailAndOrganizationId(req.email(), orgId)
            .orElseThrow(() -> new IllegalArgumentException("Compte introuvable pour cet email dans cette organisation"));

        // Authentifier via Keycloak
        GuestAuthResponse response = authenticateAndBuildResponse(req.email(), req.password(), profile);

        // Mettre à jour last login
        profile.setLastLoginAt(LocalDateTime.now());
        profileRepository.save(profile);

        return response;
    }

    /**
     * Envoie un email de réinitialisation de mot de passe via Keycloak.
     * Ne révèle pas si le compte existe (sécurité).
     */
    public void sendPasswordResetEmail(String email, Long orgId) {
        // Vérifier que le profil existe pour cet email + org
        if (!profileRepository.existsByEmailAndOrganizationId(email, orgId)) {
            log.debug("Forgot password: aucun profil pour email={}, org={}", email, orgId);
            return; // Silencieux pour ne pas révéler l'existence du compte
        }

        UsersResource usersResource = keycloakAdmin.realm(GUEST_REALM).users();
        List<UserRepresentation> users = usersResource.searchByEmail(email, true);
        if (users.isEmpty()) {
            log.warn("Forgot password: user Keycloak introuvable pour email={}", email);
            return;
        }

        String keycloakId = users.get(0).getId();
        try {
            usersResource.get(keycloakId).executeActionsEmail(List.of("UPDATE_PASSWORD"));
            log.info("Email de reset envoyé via Keycloak pour guest {}", keycloakId);
        } catch (Exception e) {
            log.error("Erreur envoi email reset pour guest {}: {}", keycloakId, e.getMessage());
            throw new RuntimeException("Erreur lors de l'envoi de l'email de réinitialisation");
        }
    }

    /**
     * Rafraîchit un token guest via refresh_token grant.
     */
    public GuestAuthResponse refreshToken(String refreshToken, Long orgId, String keycloakId) {
        BookingGuestProfile profile = profileRepository
            .findByKeycloakIdAndOrganizationId(keycloakId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Profil guest introuvable"));

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "refresh_token");
        form.add("client_id", GUEST_CLIENT_ID);
        if (guestClientSecret != null && !guestClientSecret.isBlank()) {
            form.add("client_secret", guestClientSecret);
        }
        form.add("refresh_token", refreshToken);

        Map<String, Object> tokenResponse = requestToken(form);
        return buildAuthResponse(tokenResponse, profile);
    }

    // ── Private helpers ──

    private String createKeycloakGuest(UsersResource usersResource, GuestRegisterRequest req, Long orgId) {
        UserRepresentation user = new UserRepresentation();
        user.setUsername(req.email());
        user.setEmail(req.email());
        user.setFirstName(req.firstName());
        user.setLastName(req.lastName());
        user.setEnabled(true);
        user.setEmailVerified(false);
        user.setAttributes(Map.of(ATTR_ORG_IDS, List.of(String.valueOf(orgId))));

        // Credential
        CredentialRepresentation cred = new CredentialRepresentation();
        cred.setType(CredentialRepresentation.PASSWORD);
        cred.setValue(req.password());
        cred.setTemporary(false);
        user.setCredentials(List.of(cred));

        try (Response response = usersResource.create(user)) {
            if (response.getStatus() == 201) {
                String keycloakId = CreatedResponseUtil.getCreatedId(response);
                // Assigner le rôle BOOKING_GUEST
                assignGuestRole(keycloakId);
                return keycloakId;
            } else if (response.getStatus() == 409) {
                throw new IllegalArgumentException("Un compte avec cet email existe déjà");
            } else {
                throw new RuntimeException("Erreur Keycloak: " + response.getStatus() + " - " + response.readEntity(String.class));
            }
        }
    }

    private void assignGuestRole(String keycloakId) {
        try {
            List<RoleRepresentation> roles = keycloakAdmin.realm(GUEST_REALM)
                .roles().list().stream()
                .filter(r -> GUEST_ROLE.equals(r.getName()))
                .toList();
            if (!roles.isEmpty()) {
                keycloakAdmin.realm(GUEST_REALM).users().get(keycloakId)
                    .roles().realmLevel().add(roles);
            }
        } catch (Exception e) {
            log.warn("Impossible d'assigner le rôle {} au guest {}: {}", GUEST_ROLE, keycloakId, e.getMessage());
        }
    }

    private void addOrgToUser(UserRepresentation user, Long orgId) {
        Map<String, List<String>> attrs = user.getAttributes();
        if (attrs == null) {
            user.setAttributes(Map.of(ATTR_ORG_IDS, List.of(String.valueOf(orgId))));
            return;
        }
        List<String> orgIds = attrs.getOrDefault(ATTR_ORG_IDS, List.of());
        String orgStr = String.valueOf(orgId);
        if (!orgIds.contains(orgStr)) {
            List<String> updated = new java.util.ArrayList<>(orgIds);
            updated.add(orgStr);
            attrs.put(ATTR_ORG_IDS, updated);
            user.setAttributes(attrs);
        }
    }

    private GuestAuthResponse authenticateAndBuildResponse(String email, String password, BookingGuestProfile profile) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "password");
        form.add("client_id", GUEST_CLIENT_ID);
        if (guestClientSecret != null && !guestClientSecret.isBlank()) {
            form.add("client_secret", guestClientSecret);
        }
        form.add("username", email);
        form.add("password", password);

        Map<String, Object> tokenResponse = requestToken(form);
        return buildAuthResponse(tokenResponse, profile);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> requestToken(MultiValueMap<String, String> form) {
        String tokenUrl = keycloakUrl + "/realms/" + GUEST_REALM + "/protocol/openid-connect/token";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(form, headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(tokenUrl, HttpMethod.POST, request, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            }
            throw new RuntimeException("Erreur d'authentification Keycloak");
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                throw new IllegalArgumentException("Email ou mot de passe incorrect");
            }
            throw new RuntimeException("Erreur Keycloak: " + e.getMessage());
        }
    }

    private GuestAuthResponse buildAuthResponse(Map<String, Object> tokenResponse, BookingGuestProfile profile) {
        String accessToken = (String) tokenResponse.get("access_token");
        String refreshToken = (String) tokenResponse.get("refresh_token");
        int expiresIn = tokenResponse.get("expires_in") instanceof Number n ? n.intValue() : 300;

        GuestProfileDto profileDto = new GuestProfileDto(
            profile.getId(),
            profile.getEmail(),
            profile.getFirstName(),
            profile.getLastName(),
            profile.getPhone(),
            profile.getOrganizationId(),
            profile.isEmailVerified()
        );

        return new GuestAuthResponse(accessToken, refreshToken, expiresIn, profileDto);
    }
}
