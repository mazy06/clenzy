package com.clenzy.booking.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.PropertyPhotoService;
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

/**
 * Garde marketing de l'endpoint photos public : bookingEngineVisible OU mappee
 * Channex (les photos partent alors sur les OTAs publics — Channex les
 * re-telecharge via cette URL stable).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("PublicPropertyPhotoService")
class PublicPropertyPhotoServiceTest {

    @Mock private PropertyRepository propertyRepository;
    @Mock private PropertyPhotoService photoService;
    @Mock private ChannexPropertyMappingRepository channexMappingRepository;

    private PublicPropertyPhotoService service;
    private Property property;

    @BeforeEach
    void setUp() {
        service = new PublicPropertyPhotoService(propertyRepository, photoService,
            channexMappingRepository);
        property = new Property();
        property.setId(100L);
    }

    @Test
    @DisplayName("bien visible booking engine -> photo servie")
    void bookingEngineVisibleServes() {
        property.setBookingEngineVisible(true);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(photoService.getPhotoData(100L, 7L)).thenReturn(new byte[]{1});
        when(photoService.getPhotoContentType(100L, 7L)).thenReturn("image/jpeg");

        var photo = service.getVisiblePhoto(100L, 7L);

        assertThat(photo.contentType()).isEqualTo("image/jpeg");
    }

    @Test
    @DisplayName("bien NON visible mais mappe Channex -> photo servie (distribution OTA publique)")
    void channexMappedServes() {
        property.setBookingEngineVisible(false);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(channexMappingRepository.existsByClenzyPropertyIdAnyOrg(100L)).thenReturn(true);
        when(photoService.getPhotoData(100L, 7L)).thenReturn(new byte[]{1});
        when(photoService.getPhotoContentType(100L, 7L)).thenReturn("image/jpeg");

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
    }
}
