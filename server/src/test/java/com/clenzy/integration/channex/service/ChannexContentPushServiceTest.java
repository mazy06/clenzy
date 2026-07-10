package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.ChannexPhotoDto;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyPhoto;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * B4 — push contenu Clenzy → Channex : description + photos publiques
 * (additif, idempotent par URL ; jamais de suppression de l'existant).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexContentPushService")
class ChannexContentPushServiceTest {

    @Mock private ChannexClient channexClient;
    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private PropertyPhotoRepository photoRepository;

    private ChannexContentPushService service;
    private ChannexPropertyMapping mapping;
    private Property property;
    private com.clenzy.integration.channex.config.ChannexProperties channexProps;

    @BeforeEach
    void setUp() {
        channexProps = new com.clenzy.integration.channex.config.ChannexProperties();
        service = new ChannexContentPushService(channexClient, mappingRepository,
            propertyRepository, photoRepository, channexProps);

        mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setOrganizationId(42L);
        mapping.setClenzyPropertyId(100L);
        mapping.setChannexPropertyId("chx-1");

        property = new Property();
        property.setId(100L);
        property.setOrganizationId(42L);
        property.setDescription("Bel appartement au coeur de Marrakech.");
    }

    private PropertyPhoto photo(String externalUrl, int sortOrder) {
        PropertyPhoto p = new PropertyPhoto();
        p.setOrganizationId(42L);
        p.setExternalUrl(externalUrl);
        p.setSortOrder(sortOrder);
        return p;
    }

    @Test
    @DisplayName("cas nominal : description poussee + photos publiques creees (diff par URL)")
    void pushesDescriptionAndNewPhotos() {
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(photoRepository.findByPropertyIdOrderBySortOrderAsc(100L)).thenReturn(List.of(
            photo("https://cdn.example.com/a.jpg", 0),      // deja presente cote Channex
            photo("https://cdn.example.com/b.jpg", 1),      // nouvelle -> creee
            photo(null, 2)                                   // stockage interne -> skip
        ));
        when(channexClient.fetchPhotosForProperty("chx-1")).thenReturn(List.of(
            new ChannexPhotoDto("ph-1", "https://cdn.example.com/a.jpg", 1, null, "photo", "chx-1", null)
        ));

        var result = service.pushContent(100L, 42L);

        assertThat(result.descriptionPushed()).isTrue();
        assertThat(result.photosCreated()).isEqualTo(1);
        assertThat(result.photosAlreadyPresent()).isEqualTo(1);
        assertThat(result.photosSkippedNoPublicUrl()).isEqualTo(1);
        verify(channexClient).updatePropertyDescription("chx-1",
            "Bel appartement au coeur de Marrakech.");
        verify(channexClient).createPhoto(eq("chx-1"), eq("https://cdn.example.com/b.jpg"),
            eq(2), any());
        // Additif : jamais de suppression de l'existant
        verify(channexClient, never()).deleteProperty(anyString());
    }

    @Test
    @DisplayName("description vide -> non poussee, note explicite")
    void emptyDescriptionSkipped() {
        property.setDescription("  ");
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(photoRepository.findByPropertyIdOrderBySortOrderAsc(100L)).thenReturn(List.of());

        var result = service.pushContent(100L, 42L);

        assertThat(result.descriptionPushed()).isFalse();
        verify(channexClient, never()).updatePropertyDescription(anyString(), anyString());
        assertThat(result.notes()).anyMatch(n -> n.contains("Description"));
    }

    @Test
    @DisplayName("photo interne (sans external_url) + base publique configuree -> servie via l'endpoint public stable")
    void internalPhotoServedViaPublicEndpoint() {
        channexProps.setPublicMediaBaseUrl("https://app.clenzy.fr/");
        PropertyPhoto internal = photo(null, 0);
        internal.setId(777L);
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(photoRepository.findByPropertyIdOrderBySortOrderAsc(100L)).thenReturn(List.of(internal));
        when(channexClient.fetchPhotosForProperty("chx-1")).thenReturn(List.of());

        var result = service.pushContent(100L, 42L);

        assertThat(result.photosCreated()).isEqualTo(1);
        assertThat(result.photosSkippedNoPublicUrl()).isZero();
        // Les octets restent en stockage interne : l'URL poussee est l'endpoint
        // public STABLE du PMS (ids, pas de token expirable), slash final normalise.
        verify(channexClient).createPhoto(eq("chx-1"),
            eq("https://app.clenzy.fr/api/public/property-photos/100/777"), eq(1), any());
    }

    @Test
    @DisplayName("photo interne SANS base publique configuree -> skip avec note de config")
    void internalPhotoWithoutBaseUrlSkipped() {
        PropertyPhoto internal = photo(null, 0);
        internal.setId(778L);
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(photoRepository.findByPropertyIdOrderBySortOrderAsc(100L)).thenReturn(List.of(internal));
        when(channexClient.fetchPhotosForProperty("chx-1")).thenReturn(List.of());

        var result = service.pushContent(100L, 42L);

        assertThat(result.photosSkippedNoPublicUrl()).isEqualTo(1);
        assertThat(result.notes()).anyMatch(n -> n.contains("public-media-base-url"));
        verify(channexClient, never()).createPhoto(anyString(), anyString(), anyInt(), any());
    }

    @Test
    @DisplayName("URL http non-securisee -> skip (Channex exige des URLs publiques https)")
    void httpUrlSkipped() {
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(photoRepository.findByPropertyIdOrderBySortOrderAsc(100L)).thenReturn(List.of(
            photo("http://insecure.example.com/a.jpg", 0)
        ));
        when(channexClient.fetchPhotosForProperty("chx-1")).thenReturn(List.of());

        var result = service.pushContent(100L, 42L);

        assertThat(result.photosSkippedNoPublicUrl()).isEqualTo(1);
        verify(channexClient, never()).createPhoto(anyString(), anyString(), anyInt(), any());
    }

    @Test
    @DisplayName("echec unitaire d'une photo -> comptabilise, les suivantes continuent")
    void photoErrorDoesNotBlockOthers() {
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(photoRepository.findByPropertyIdOrderBySortOrderAsc(100L)).thenReturn(List.of(
            photo("https://cdn.example.com/bad.jpg", 0),
            photo("https://cdn.example.com/good.jpg", 1)
        ));
        when(channexClient.fetchPhotosForProperty("chx-1")).thenReturn(List.of());
        when(channexClient.createPhoto(eq("chx-1"), eq("https://cdn.example.com/bad.jpg"), anyInt(), any()))
            .thenThrow(new RuntimeException("422"));
        when(channexClient.createPhoto(eq("chx-1"), eq("https://cdn.example.com/good.jpg"), anyInt(), any()))
            .thenReturn("ph-ok");

        var result = service.pushContent(100L, 42L);

        assertThat(result.photoErrors()).isEqualTo(1);
        assertThat(result.photosCreated()).isEqualTo(1);
    }

    @Test
    @DisplayName("propriete d'une autre org -> AccessDeniedException (audit n°3)")
    void crossOrgPropertyDenied() {
        property.setOrganizationId(999L);
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

        assertThatThrownBy(() -> service.pushContent(100L, 42L))
            .isInstanceOf(AccessDeniedException.class);
        verify(channexClient, never()).updatePropertyDescription(anyString(), anyString());
    }

    @Test
    @DisplayName("pas de mapping -> IllegalStateException")
    void noMappingThrows() {
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.pushContent(100L, 42L))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("mapping");
    }
}
