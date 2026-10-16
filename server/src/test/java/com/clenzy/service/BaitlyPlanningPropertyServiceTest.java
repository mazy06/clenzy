package com.clenzy.service;

import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class BaitlyPlanningPropertyServiceTest {
    @Test void onlyTheCurrentPageLoadsPhotoAddressesAndPreservesPortfolioTotal() {
        var properties = mock(PropertyRepository.class);
        var photos = mock(PropertyPhotoRepository.class);
        var users = mock(UserRepository.class);
        var tenant = new TenantContext(); tenant.setOrganizationId(1L);
        var row = mock(PropertyRepository.BaitlyPlanningProperty.class);
        when(row.getId()).thenReturn(1001L);
        when(row.getOwnerId()).thenReturn(7L);
        when(users.findBaitlyPlanningPropertyOwners(List.of(1001L), 1L))
                .thenReturn(List.of(new com.clenzy.dto.BaitlyPlanningPersonName(7L, "Alice", "Martin")));
        when(properties.findBaitlyPlanningProperties(1L, "host", PageRequest.of(0, 200)))
                .thenReturn(new PageImpl<>(List.of(row), PageRequest.of(0, 200), 1101));
        var manual = mock(PropertyPhotoRepository.BaitlyPlanningPhoto.class);
        when(manual.getId()).thenReturn(10L); when(manual.getPropertyId()).thenReturn(1001L);
        var external = mock(PropertyPhotoRepository.BaitlyPlanningPhoto.class);
        when(external.getPropertyId()).thenReturn(1001L);
        when(external.getExternalUrl()).thenReturn("https://example.test/photo.jpg");
        when(photos.findBaitlyPlanningPhotos(List.of(1001L), 1L)).thenReturn(List.of(manual, external));
        var result = new BaitlyPlanningPropertyService(properties, photos, users, tenant).page("host", 0, 200);
        assertThat(result.getTotalElements()).isEqualTo(1101);
        assertThat(result.getContent()).singleElement().satisfies(p -> {
            assertThat(p.ownerName()).isEqualTo("Alice Martin");
            assertThat(p.photoUrls()).containsExactly("/api/properties/1001/photos/10/data", "https://example.test/photo.jpg");
        });
        verify(properties).findBaitlyPlanningProperties(1L, "host", PageRequest.of(0, 200));
        verify(photos).findBaitlyPlanningPhotos(List.of(1001L), 1L);
        verify(users).findBaitlyPlanningPropertyOwners(List.of(1001L), 1L);
        verifyNoMoreInteractions(properties, photos, users);
    }
}
