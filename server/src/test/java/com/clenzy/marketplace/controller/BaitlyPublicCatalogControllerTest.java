package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.dto.*;
import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class BaitlyPublicCatalogControllerTest {
    @Mock MarketplaceCatalogService catalog;
    @Mock MarketplaceExposureService exposure;
    @Mock ProviderDocumentaryService documentary;
    @Mock BaitlyPublicProfiles profiles;
    @InjectMocks BaitlyPublicCatalogController controller;

    @Test void publicSearchExcludesHiddenAndUnpublishableProfilesBeforePagination() {
        when(exposure.publicHiddenProviderIds()).thenReturn(List.of(7L,9L));
        controller.search("cleaning",null,null,0,500);
        var criteria=ArgumentCaptor.forClass(ProviderSearchCriteria.class);
        verify(catalog).searchCatalog(criteria.capture(),isNull(),argThat(ids -> ids.containsAll(List.of(7L,9L))));
        assertThat(criteria.getValue().size()).isEqualTo(20);
    }

    @Test void globallyHiddenProfileCannotBeEnumeratedEvenWithNamedAccess() {
        var provider=new MarketplaceProvider();
        when(catalog.getProvider(7L)).thenReturn(Optional.of(provider));
        when(exposure.visibilityOf(provider)).thenReturn(new MarketplaceExposureService.Visibility(
                1L,true,Map.of(2L,ExposureEffect.ALLOW),ExposureEffect.DENY));
        assertThat(controller.detail(7L).getStatusCode().value()).isEqualTo(404);
        verify(catalog,never()).getCatalogEntry(anyLong(),any());
    }

    @Test void reviewsCannotRevealHiddenProvider() {
        when(catalog.getProvider(77L)).thenReturn(Optional.empty());
        assertThat(controller.reviews(77L).getStatusCode().value()).isEqualTo(404);
        verifyNoInteractions(profiles);
    }

    @Test void documentaryBlockedProviderCannotExposeDetailOrReviews() {
        when(documentary.unpublishableIds()).thenReturn(List.of(9L));
        assertThat(controller.detail(9L).getStatusCode().value()).isEqualTo(404);
        assertThat(controller.reviews(9L).getStatusCode().value()).isEqualTo(404);
        verifyNoInteractions(catalog, profiles);
    }

    @Test void withdrawnProfileAndPhotosAreUnavailable() {
        var id=UUID.randomUUID();
        when(profiles.detail(id)).thenReturn(Optional.empty());
        when(profiles.photo(id,8L)).thenReturn(Optional.empty());
        assertThat(controller.profile(id).getStatusCode().value()).isEqualTo(404);
        assertThat(controller.photo(id,8L).getStatusCode().value()).isEqualTo(404);
    }

    @Test void privateOrInactiveProfileCannotBeEnumerated() {
        var provider=new MarketplaceProvider();
        when(catalog.getProvider(7L)).thenReturn(Optional.of(provider));
        when(exposure.visibilityOf(provider)).thenReturn(MarketplaceExposureService.Visibility.NONE);
        assertThat(controller.detail(7L).getStatusCode().value()).isEqualTo(404);
        verify(catalog,never()).getCatalogEntry(anyLong(),any());
        assertThat(Arrays.stream(CatalogProviderDto.class.getRecordComponents()).map(c -> c.getName()))
                .doesNotContain("email","phone","homeOrganizationId","userId","reviewNote");
    }
}
