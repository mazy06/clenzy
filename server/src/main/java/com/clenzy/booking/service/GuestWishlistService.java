package com.clenzy.booking.service;

import com.clenzy.booking.model.GuestWishlistItem;
import com.clenzy.booking.repository.BookingGuestProfileRepository;
import com.clenzy.booking.repository.GuestWishlistItemRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Wishlist (favoris) du voyageur (compte guest 2.11, Phase 1). Scopée par (guest Keycloak, org).
 * L'identité guest est validée via le token Keycloak (realm clenzy-guests) par
 * {@link BookingGuestAuthService#resolveGuestKeycloakId}, puis on exige que le guest soit rattaché
 * à l'org (profil existant). Endpoints publics (cf. {@code PublicGuestWishlistController}) — la
 * sécurité repose sur la validation du token, pas sur SecurityConfig.
 */
@Service
public class GuestWishlistService {

    private final GuestWishlistItemRepository repository;
    private final BookingGuestAuthService authService;
    private final BookingGuestProfileRepository profileRepository;

    public GuestWishlistService(GuestWishlistItemRepository repository,
                                BookingGuestAuthService authService,
                                BookingGuestProfileRepository profileRepository) {
        this.repository = repository;
        this.authService = authService;
        this.profileRepository = profileRepository;
    }

    @Transactional(readOnly = true)
    public List<Long> list(String token, Long orgId) {
        return propertyIds(authenticate(token, orgId), orgId);
    }

    @Transactional
    public List<Long> add(String token, Long orgId, Long propertyId) {
        String keycloakId = authenticate(token, orgId);
        if (propertyId != null
                && !repository.existsByKeycloakIdAndOrganizationIdAndPropertyId(keycloakId, orgId, propertyId)) {
            GuestWishlistItem item = new GuestWishlistItem();
            item.setKeycloakId(keycloakId);
            item.setOrganizationId(orgId);
            item.setPropertyId(propertyId);
            repository.save(item);
        }
        return propertyIds(keycloakId, orgId);
    }

    @Transactional
    public List<Long> remove(String token, Long orgId, Long propertyId) {
        String keycloakId = authenticate(token, orgId);
        repository.findByKeycloakIdAndOrganizationIdAndPropertyId(keycloakId, orgId, propertyId)
            .ifPresent(repository::delete);
        return propertyIds(keycloakId, orgId);
    }

    private List<Long> propertyIds(String keycloakId, Long orgId) {
        return repository.findByKeycloakIdAndOrganizationIdOrderByCreatedAtDesc(keycloakId, orgId)
            .stream().map(GuestWishlistItem::getPropertyId).toList();
    }

    /** Valide le token guest → keycloakId, puis exige que le guest soit rattaché à l'org. */
    private String authenticate(String token, Long orgId) {
        if (orgId == null) {
            throw new IllegalArgumentException("organizationId requis");
        }
        String keycloakId = authService.resolveGuestKeycloakId(token);
        profileRepository.findByKeycloakIdAndOrganizationId(keycloakId, orgId)
            .orElseThrow(() -> new AccessDeniedException("Guest non rattaché à cette organisation"));
        return keycloakId;
    }
}
