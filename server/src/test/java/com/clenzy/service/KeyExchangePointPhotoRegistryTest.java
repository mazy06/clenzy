package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.KeyExchangePoint;
import com.clenzy.model.KeyExchangePointPhoto;
import com.clenzy.repository.KeyExchangePointPhotoRepository;
import com.clenzy.repository.KeyExchangePointRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.KeyExchangePointPhotoRegistry.PhotoCandidate;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.service.storage.StoredObject;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.access.AccessDeniedException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("KeyExchangePointPhotoRegistry — photos d'emplacement des points de remise")
class KeyExchangePointPhotoRegistryTest {

    private static final Long ORG = 1L;
    private static final Long OTHER_ORG = 2L;
    private static final Long POINT_ID = 10L;

    @Mock private KeyExchangePointRepository pointRepository;
    @Mock private KeyExchangePointPhotoRepository photoRepository;
    @Mock private UserRepository userRepository;
    @Mock private TenantContext tenantContext;

    private KeyExchangePointPhotoRegistry registry;

    @BeforeEach
    void setUp() {
        when(tenantContext.getOrganizationId()).thenReturn(ORG);
        when(tenantContext.isSuperAdmin()).thenReturn(false);
        when(tenantContext.isSystemOrg()).thenReturn(false);
        registry = new KeyExchangePointPhotoRegistry(pointRepository, photoRepository, userRepository,
                new OrganizationAccessGuard(tenantContext));
    }

    private static KeyExchangePoint point(Long orgId) {
        KeyExchangePoint point = new KeyExchangePoint();
        point.setId(POINT_ID);
        point.setOrganizationId(orgId);
        return point;
    }

    private static KeyExchangePointPhoto photo(Long pointId, Long orgId, String key) {
        KeyExchangePointPhoto photo = new KeyExchangePointPhoto();
        photo.setPointId(pointId);
        photo.setOrganizationId(orgId);
        photo.setStorageKey(key);
        return photo;
    }

    @Test
    void whenPointBelongsToAnotherOrganization_thenUploadIsDenied() {
        when(pointRepository.findById(POINT_ID)).thenReturn(Optional.of(point(OTHER_ORG)));

        assertThatThrownBy(() -> registry.checkUpload(POINT_ID, List.of(new PhotoCandidate(1_000, "image/jpeg"))))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void whenPointAlreadyHasMaxPhotos_thenUploadIsRefused() {
        when(pointRepository.findById(POINT_ID)).thenReturn(Optional.of(point(ORG)));
        when(photoRepository.countByPointId(POINT_ID)).thenReturn((long) KeyExchangePointPhotoRegistry.MAX_PHOTOS_PER_POINT);

        assertThatThrownBy(() -> registry.checkUpload(POINT_ID, List.of(new PhotoCandidate(1_000, "image/jpeg"))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Maximum");
    }

    @Test
    void whenFormatIsNotAnImage_thenUploadIsRefused() {
        when(pointRepository.findById(POINT_ID)).thenReturn(Optional.of(point(ORG)));

        assertThatThrownBy(() -> registry.checkUpload(POINT_ID, List.of(new PhotoCandidate(1_000, "application/pdf"))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Formats");
    }

    @Test
    void whenPhotosAttached_thenEachKeyIsSavedWithThePointOrganization() {
        when(pointRepository.findById(POINT_ID)).thenReturn(Optional.of(point(ORG)));
        List<KeyExchangePointPhoto> saved = new ArrayList<>();
        when(photoRepository.save(any())).thenAnswer(invocation -> {
            saved.add(invocation.getArgument(0));
            return invocation.getArgument(0);
        });

        registry.attach(POINT_ID, List.of(new StoredObject("org/1/photos/a", "image/png", 42, "boite.png")), "kc-1");

        assertThat(saved).singleElement().satisfies(photo -> {
            assertThat(photo.getPointId()).isEqualTo(POINT_ID);
            assertThat(photo.getOrganizationId()).isEqualTo(ORG);
            assertThat(photo.getStorageKey()).isEqualTo("org/1/photos/a");
        });
    }

    @Test
    void whenPhotoBelongsToAnotherPoint_thenItIsNotFound() {
        when(photoRepository.findById(5L)).thenReturn(Optional.of(photo(99L, ORG, "k")));

        assertThatThrownBy(() -> registry.findContent(POINT_ID, 5L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void whenPhotoBelongsToAnotherOrganization_thenReadIsDenied() {
        when(photoRepository.findById(5L)).thenReturn(Optional.of(photo(POINT_ID, OTHER_ORG, "k")));

        assertThatThrownBy(() -> registry.findContent(POINT_ID, 5L)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void whenPhotoRemovedOutsideTransaction_thenStoredObjectIsDeleted() {
        KeyExchangePointPhoto photo = photo(POINT_ID, ORG, "org/1/photos/a");
        when(photoRepository.findById(5L)).thenReturn(Optional.of(photo));
        List<String> deleted = new ArrayList<>();

        registry.remove(POINT_ID, 5L, deleted::add);

        verify(photoRepository).delete(photo);
        assertThat(deleted).containsExactly("org/1/photos/a");
    }

    @Test
    void whenRemovalIsDenied_thenNothingIsDeleted() {
        when(photoRepository.findById(5L)).thenReturn(Optional.of(photo(POINT_ID, OTHER_ORG, "k")));
        List<String> deleted = new ArrayList<>();

        assertThatThrownBy(() -> registry.remove(POINT_ID, 5L, deleted::add)).isInstanceOf(AccessDeniedException.class);
        verify(photoRepository, never()).delete(any());
        assertThat(deleted).isEmpty();
    }
}
