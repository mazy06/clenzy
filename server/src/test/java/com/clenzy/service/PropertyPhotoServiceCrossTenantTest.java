package com.clenzy.service;

import com.clenzy.model.Property;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
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

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Isolation multi-tenant des photos de logement — audit sécurité 2026-07-26, constat P1-07.
 *
 * <p>Les cinq opérations sont ancrées sur un {@code propertyId} pris dans l'URL, et
 * {@code PropertyPhotoRepository} ne filtre que sur ce {@code propertyId} : rien ne bornait
 * la portée au tenant. {@code PropertyPhoto} porte pourtant un {@code organizationId},
 * simplement jamais relu.
 *
 * <p>La suppression est la plus grave : elle détruit aussi le binaire via
 * {@code PhotoStorageService.delete}, donc de façon irréversible.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("PropertyPhotoService — isolation multi-tenant (P1-07)")
class PropertyPhotoServiceCrossTenantTest {

    private static final Long ORG_COURANTE = 1L;
    private static final Long ORG_VICTIME = 2L;
    private static final Long PROPERTY_ID = 100L;
    private static final Long PHOTO_ID = 7L;

    @Mock private PropertyPhotoRepository photoRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private PhotoStorageService storageService;

    private PropertyPhotoService service;

    @BeforeEach
    void setUp() {
        TenantContext tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_COURANTE);
        service = new PropertyPhotoService(photoRepository, propertyRepository, storageService,
                tenantContext, new OrganizationAccessGuard(tenantContext));

        Property logementVictime = new Property();
        logementVictime.setId(PROPERTY_ID);
        logementVictime.setOrganizationId(ORG_VICTIME);
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(logementVictime));
    }

    @Test
    @DisplayName("lister les photos d'un logement d'une autre organisation est refusé")
    void listPhotos_refuse() {
        assertThatThrownBy(() -> service.listPhotos(PROPERTY_ID))
                .isInstanceOf(AccessDeniedException.class);
        verify(photoRepository, never()).findByPropertyIdOrderBySortOrderAsc(any());
    }

    @Test
    @DisplayName("lire le binaire d'une photo d'une autre organisation est refusé")
    void getPhotoData_refuse() {
        assertThatThrownBy(() -> service.getPhotoData(PROPERTY_ID, PHOTO_ID))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("supprimer une photo d'une autre organisation est refusé, binaire intact")
    void deletePhoto_refuseEtNeDetruitRien() {
        assertThatThrownBy(() -> service.deletePhoto(PROPERTY_ID, PHOTO_ID))
                .isInstanceOf(AccessDeniedException.class);

        // Le refus doit précéder toute destruction : le binaire du tiers n'est pas touché.
        verify(storageService, never()).delete(any());
        verify(photoRepository, never()).deleteByIdAndPropertyId(any(), any());
    }

    @Test
    @DisplayName("réordonner les photos d'une autre organisation est refusé")
    void reorderPhotos_refuse() {
        assertThatThrownBy(() -> service.reorderPhotos(PROPERTY_ID, List.of(PHOTO_ID)))
                .isInstanceOf(AccessDeniedException.class);
        verify(photoRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("un logement sans organisation est refusé — fail-closed")
    void logementSansOrganisation_refuse() {
        Property sansOrg = new Property();
        sansOrg.setId(PROPERTY_ID);
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(sansOrg));

        assertThatThrownBy(() -> service.listPhotos(PROPERTY_ID))
                .isInstanceOf(AccessDeniedException.class);
    }
}
