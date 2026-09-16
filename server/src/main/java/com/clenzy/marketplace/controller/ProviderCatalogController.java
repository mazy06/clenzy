package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.dto.CatalogPageDto;
import com.clenzy.marketplace.dto.CatalogProviderDto;
import com.clenzy.marketplace.dto.ProviderSearchCriteria;
import com.clenzy.marketplace.dto.ServiceCategoryDto;
import com.clenzy.marketplace.service.MarketplaceCatalogService;
import com.clenzy.marketplace.service.MarketplaceExposureService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Le catalogue des prestataires, vu par une ORGANISATION.
 *
 * <h2>Chemin</h2>
 * <p>{@code /api/provider-catalog}, et non {@code /api/marketplace} — deja pris
 * par le catalogue des partenaires d'integration — ni
 * {@code /api/admin/marketplace}, qui est la console de la plateforme et montre
 * tout.</p>
 *
 * <h2>Ce que cette surface ne montre pas</h2>
 * <p>Aucune coordonnee : ni adresse electronique, ni telephone. Un catalogue
 * ouvert a toutes les organisations qui les exposerait serait un annuaire de
 * prospection, alors que le prestataire s'est inscrit pour recevoir des
 * missions. La mise en relation passera par une demande de devis tracee.</p>
 *
 * <h2>Portee</h2>
 * <p>{@code isAuthenticated()} et non un role : un technicien comme un
 * gestionnaire ont des raisons legitimes de consulter le catalogue de leur
 * organisation. Ce qui borne la vue, c'est l'ORGANISATION — resolue du contexte
 * tenant, jamais d'un parametre.</p>
 */
@RestController
@RequestMapping("/api/provider-catalog")
@PreAuthorize("isAuthenticated()")
public class ProviderCatalogController {

    private final MarketplaceCatalogService catalogService;
    private final MarketplaceExposureService exposureService;
    private final TenantContext tenantContext;
    private final com.clenzy.marketplace.service.MarketplacePropertyContext properties;

    public ProviderCatalogController(MarketplaceCatalogService catalogService,
                                     MarketplaceExposureService exposureService,
                                     TenantContext tenantContext, com.clenzy.marketplace.service.MarketplacePropertyContext properties) {
        this.properties = properties;
        this.catalogService = catalogService;
        this.exposureService = exposureService;
        this.tenantContext = tenantContext;
    }

    /** Metiers du referentiel, pour les filtres. */
    @GetMapping("/categories")
    public List<ServiceCategoryDto> categories() {
        return catalogService.getCategories();
    }

    @GetMapping
    public CatalogPageDto search(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) List<String> category,
            @RequestParam(required = false) List<String> service,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String department,
            @RequestParam(required = false, defaultValue = "false") boolean verifiedOnly,
            @RequestParam(required = false, defaultValue = "false") boolean acceptsUrgent,
            @RequestParam(required = false) Short availableOnDay,
            @RequestParam(required = false, defaultValue = "recent") String sort,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "24") int size,
            @RequestParam(required = false) Long propertyId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt) {

        Long orgId = tenantContext.getRequiredOrganizationId();

        // Les dimensions reservees a la plateforme — statut, mode d'engagement,
        // alerte de conformite, organisation porteuse — ne sont pas acceptees en
        // parametre : les exposer laisserait une organisation interroger l'etat
        // de moderation du catalogue entier.
        var criteria = new ProviderSearchCriteria(
            query, null, null, category, service,
            null, department, city,
            // Pas de filtre sur la note : rien ne la calcule encore. Filtrer sur
            // une donnee inexistante ne renverrait jamais rien, et donnerait a
            // penser que le catalogue est vide. Meme raison que le tri « mieux
            // notes », retire de la console.
            null, verifiedOnly, null, acceptsUrgent,
            null, null, availableOnDay, sort, page, size);

        var property = properties.require(propertyId, orgId, jwt);
        return catalogService.searchCatalog(criteria, orgId, exposureService.hiddenProviderIdsFor(orgId), property);
    }

    /**
     * Fiche detaillee.
     *
     * <p>404 et non 403 lorsqu'une fiche est masquee : repondre « interdit »
     * confirmerait son existence, et permettrait de reconstituer le catalogue
     * cache en enumerant les identifiants.</p>
     */
    @GetMapping("/{id}")
    public ResponseEntity<CatalogProviderDto> detail(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        return catalogService.getProvider(id)
            .filter(provider -> exposureService.isVisibleTo(provider, orgId))
            .flatMap(provider -> catalogService.getCatalogEntry(id, orgId))
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
