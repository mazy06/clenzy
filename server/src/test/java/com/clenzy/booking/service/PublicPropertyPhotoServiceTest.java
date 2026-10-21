package com.clenzy.booking.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.model.PropertyPhoto;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.service.PhotoStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Garde marketing de l'endpoint photos public : bookingEngineVisible OU mappee
 * Channex (les photos partent alors sur les OTAs publics — Channex les
 * re-telecharge via cette URL stable).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("PublicPropertyPhotoService")
class PublicPropertyPhotoServiceTest {

    @Mock private PropertyRepository propertyRepository;
    @Mock private PropertyPhotoRepository photoRepository;
    @Mock private PhotoStorageService storageService;
    @Mock private ChannexPropertyMappingRepository channexMappingRepository;

    private PublicPropertyPhotoService service;
    private Property property;

    @BeforeEach
    void setUp() {
        service = new PublicPropertyPhotoService(propertyRepository, photoRepository, storageService,
            channexMappingRepository);
        property = new Property();
        property.setId(100L);
    }

    @Test
    @DisplayName("bien visible booking engine -> photo servie")
    void bookingEngineVisibleServes() {
        property.setBookingEngineVisible(true);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        stubPhoto();

        var photo = service.getVisiblePhoto(100L, 7L);

        assertThat(photo.contentType()).isEqualTo("image/jpeg");
    }

    @Test
    @DisplayName("bien NON visible mais mappe Channex -> photo servie (distribution OTA publique)")
    void channexMappedServes() {
        property.setBookingEngineVisible(false);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(channexMappingRepository.existsByClenzyPropertyIdAnyOrg(100L)).thenReturn(true);
        stubPhoto();

        var photo = service.getVisiblePhoto(100L, 7L);

        assertThat(photo.data()).isNotEmpty();
    }

    @Test
    @DisplayName("bien ni visible ni mappe -> 404 (contenu non destine au public)")
    void privatePropertyRejected() {
        property.setBookingEngineVisible(false);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(channexMappingRepository.existsByClenzyPropertyIdAnyOrg(100L)).thenReturn(false);

        assertThatThrownBy(() -> service.getVisiblePhoto(100L, 7L))
            .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(photoRepository, storageService);
    }

    @Test
    void unrelatedPhotoRejected() {
        property.setBookingEngineVisible(true);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(photoRepository.findByIdAndPropertyId(7L, 100L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getVisiblePhoto(100L, 7L)).isInstanceOf(NotFoundException.class);
        verifyNoInteractions(storageService);
    }

    @Test
    void publicObjectStoragePhotoServed() {
        property.setBookingEngineVisible(true);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        var stored = new PropertyPhoto();
        stored.setStorageKey("public-marketing-photo");
        stored.setContentType("image/webp");
        when(photoRepository.findByIdAndPropertyId(7L, 100L)).thenReturn(Optional.of(stored));
        when(storageService.retrieve("public-marketing-photo")).thenReturn(new byte[]{2});
        assertThat(service.getVisiblePhoto(100L, 7L).data()).containsExactly((byte) 2);
    }

    private void stubPhoto() {
        var photo = new PropertyPhoto();
        photo.setData(new byte[]{1});
        photo.setContentType("image/jpeg");
        when(photoRepository.findByIdAndPropertyId(7L, 100L)).thenReturn(Optional.of(photo));
    }
}
