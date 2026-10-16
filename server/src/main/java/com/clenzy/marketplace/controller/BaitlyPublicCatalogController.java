package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.dto.*;
import com.clenzy.marketplace.model.ExposureEffect;
import com.clenzy.marketplace.service.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/** Annuaire Baitly public : fiches exposables, DTO sans coordonnees ni donnees internes. */
@RestController
@RequestMapping("/api/public/baitly-catalog")
@PreAuthorize("permitAll()")
public class BaitlyPublicCatalogController {
    private final MarketplaceCatalogService catalog;
    private final MarketplaceExposureService exposure;
    private final ProviderDocumentaryService documentary;
    private final BaitlyPublicProfiles profiles;
    private final com.clenzy.integration.openmeteo.OpenMeteoClient geocoding;

    public BaitlyPublicCatalogController(MarketplaceCatalogService catalog, MarketplaceExposureService exposure,
            ProviderDocumentaryService documentary, BaitlyPublicProfiles profiles,com.clenzy.integration.openmeteo.OpenMeteoClient geocoding) {
        this.catalog=catalog; this.exposure=exposure; this.documentary=documentary;
        this.profiles=profiles;
        this.geocoding=geocoding;
    }
    @GetMapping("/city-position") public ResponseEntity<com.clenzy.integration.openmeteo.OpenMeteoClient.GeoCoord> city(
        @RequestParam String city,@RequestParam(required=false) String country) {
        if(city.isBlank()||city.length()>80||country!=null&&!country.matches("[A-Za-z]{2}"))return ResponseEntity.badRequest().build();
        return geocoding.geocode(city,country).map(ResponseEntity::ok).orElseGet(()->ResponseEntity.noContent().build());
    }

    @GetMapping
    public CatalogPageDto search(@RequestParam(defaultValue="") String query,
            @RequestParam(required=false) List<String> category, @RequestParam(required=false) String city,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        var criteria = new ProviderSearchCriteria(query.substring(0, Math.min(query.length(), 200)),
                null, null, category, null, null, null, city, null, false, null, false,
                null, null, null, "recent", page, Math.min(size, 20));
        return catalog.searchCatalog(criteria, null, exposure.publicHiddenProviderIds());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CatalogProviderDto> detail(@PathVariable Long id) {
        if (documentary.unpublishableIds().contains(id)) return ResponseEntity.notFound().build();
        return catalog.getProvider(id).filter(p -> {
            var visibility = exposure.visibilityOf(p);
            return visibility.exposable() && visibility.global() != ExposureEffect.DENY;
        }).flatMap(p -> catalog.getCatalogEntry(id, null)).map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/profiles") public List<java.util.Map<String,Object>> profiles(
        @RequestParam(defaultValue="CONCIERGE") String role, @RequestParam(defaultValue="") String query) {
        return profiles.list(role,query.substring(0,Math.min(query.length(),200)));
    }
    @GetMapping("/{id}/reviews") public ResponseEntity<List<java.util.Map<String,Object>>> reviews(@PathVariable Long id) {
        if(!detail(id).getStatusCode().is2xxSuccessful()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(profiles.reviews(id));
    }
    @GetMapping("/profiles/{id}") public ResponseEntity<java.util.Map<String,Object>> profile(@PathVariable java.util.UUID id) {
        return profiles.detail(id).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }
    @GetMapping("/profiles/{id}/photos/{photoId}") public ResponseEntity<byte[]> photo(@PathVariable java.util.UUID id, @PathVariable Long photoId) {
        return profiles.photo(id,photoId).map(photo -> ResponseEntity.ok()
            .contentType(org.springframework.http.MediaType.parseMediaType(photo.contentType())).body(photo.data()))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
