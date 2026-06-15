package com.clenzy.booking.service;

import com.clenzy.booking.model.BookingGuestProfile;
import com.clenzy.booking.model.GuestWishlistItem;
import com.clenzy.booking.repository.BookingGuestProfileRepository;
import com.clenzy.booking.repository.GuestWishlistItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Wishlist guest (2.11) : identité validée via le token (BookingGuestAuthService), ownership org
 * (profil rattaché), add idempotent, list/remove.
 */
@ExtendWith(MockitoExtension.class)
class GuestWishlistServiceTest {

    @Mock private GuestWishlistItemRepository repository;
    @Mock private BookingGuestAuthService authService;
    @Mock private BookingGuestProfileRepository profileRepository;

    private GuestWishlistService service;

    private static final String TOKEN = "tok";
    private static final String KC = "kc-123";
    private static final Long ORG = 1L;

    @BeforeEach
    void setUp() {
        service = new GuestWishlistService(repository, authService, profileRepository);
    }

    private void authOk() {
        when(authService.resolveGuestKeycloakId(TOKEN)).thenReturn(KC);
        when(profileRepository.findByKeycloakIdAndOrganizationId(KC, ORG)).thenReturn(Optional.of(new BookingGuestProfile()));
    }

    private GuestWishlistItem item(Long propertyId) {
        GuestWishlistItem i = new GuestWishlistItem();
        i.setKeycloakId(KC);
        i.setOrganizationId(ORG);
        i.setPropertyId(propertyId);
        return i;
    }

    @Test
    void add_whenNew_savesAndReturnsUpdatedList() {
        authOk();
        when(repository.existsByKeycloakIdAndOrganizationIdAndPropertyId(KC, ORG, 7L)).thenReturn(false);
        when(repository.findByKeycloakIdAndOrganizationIdOrderByCreatedAtDesc(KC, ORG)).thenReturn(List.of(item(7L)));

        List<Long> result = service.add(TOKEN, ORG, 7L);

        verify(repository).save(any(GuestWishlistItem.class));
        assertThat(result).containsExactly(7L);
    }

    @Test
    void add_whenAlreadyPresent_doesNotDuplicate() {
        authOk();
        when(repository.existsByKeycloakIdAndOrganizationIdAndPropertyId(KC, ORG, 7L)).thenReturn(true);
        when(repository.findByKeycloakIdAndOrganizationIdOrderByCreatedAtDesc(KC, ORG)).thenReturn(List.of(item(7L)));

        service.add(TOKEN, ORG, 7L);

        verify(repository, never()).save(any());
    }

    @Test
    void list_returnsPropertyIds() {
        authOk();
        when(repository.findByKeycloakIdAndOrganizationIdOrderByCreatedAtDesc(KC, ORG)).thenReturn(List.of(item(7L), item(9L)));

        assertThat(service.list(TOKEN, ORG)).containsExactly(7L, 9L);
    }

    @Test
    void authenticate_whenGuestNotInOrg_throwsAccessDenied() {
        when(authService.resolveGuestKeycloakId(TOKEN)).thenReturn(KC);
        when(profileRepository.findByKeycloakIdAndOrganizationId(KC, ORG)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.list(TOKEN, ORG)).isInstanceOf(AccessDeniedException.class);
    }
}
