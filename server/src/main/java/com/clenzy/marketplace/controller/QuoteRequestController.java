package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.dto.QuotePageDto;
import com.clenzy.marketplace.dto.QuoteRequestDto;
import com.clenzy.marketplace.model.MarketplaceQuoteRequest;
import com.clenzy.marketplace.model.QuoteRequestStatus;
import com.clenzy.marketplace.service.MarketplaceQuoteInterventionService;
import com.clenzy.marketplace.service.MarketplaceQuoteService;
import com.clenzy.marketplace.service.ProviderAccountResolver;
import com.clenzy.marketplace.service.QuoteRequestAssembler;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Demandes de devis — les deux cotes.
 *
 * <h2>Deux chemins, pas un</h2>
 * <p>{@code /sent} pour ce que mon organisation a envoye, {@code /received}
 * pour ce qui est adresse a ma fiche de prestataire. Un seul chemin avec un
 * parametre « cote » aurait laisse une organisation lire l'autre colonne en
 * changeant un mot dans l'URL ; ici, chaque chemin resout lui-meme a quoi il
 * donne droit.</p>
 *
 * <h2>Le prestataire est reconnu par son compte</h2>
 * <p>Un prestataire accepte est un utilisateur comme un autre. C'est
 * {@code MarketplaceProvider.userId} qui fait le lien — jamais un identifiant
 * passe en parametre.</p>
 */
@RestController
@RequestMapping("/api/quote-requests")
@PreAuthorize("isAuthenticated()")
public class QuoteRequestController {

    private final MarketplaceQuoteService quoteService;
    private final MarketplaceQuoteInterventionService interventionService;
    private final QuoteRequestAssembler assembler;
    private final ProviderAccountResolver accountResolver;
    private final TenantContext tenantContext;
    private final com.clenzy.marketplace.service.MarketplacePropertyContext properties;

    public QuoteRequestController(MarketplaceQuoteService quoteService,
                                  MarketplaceQuoteInterventionService interventionService,
                                  QuoteRequestAssembler assembler,
                                  ProviderAccountResolver accountResolver,
                                  TenantContext tenantContext, com.clenzy.marketplace.service.MarketplacePropertyContext properties) {
        this.properties = properties;
        this.quoteService = quoteService;
        this.interventionService = interventionService;
        this.assembler = assembler;
        this.accountResolver = accountResolver;
        this.tenantContext = tenantContext;
    }

    // ─── Cote demandeur ──────────────────────────────────────────────────────

    /** Solliciter un prestataire depuis sa fiche. */
    @PostMapping
    public ResponseEntity<QuoteRequestDto> request(@Valid @RequestBody CreateQuoteRequest body,
                                                   @AuthenticationPrincipal Jwt jwt) {
        properties.require(body.propertyId(), tenantContext.getRequiredOrganizationId(), jwt);
        MarketplaceQuoteRequest quote = quoteService.request(
            body.providerId(),
            tenantContext.getRequiredOrganizationId(),
            currentUserId(jwt),
            body.title(), body.message(), body.propertyId(),
            body.categoryCode(), body.serviceItemCode(), body.desiredDate());

        return ResponseEntity.status(HttpStatus.CREATED).body(assembler.toDto(quote));
    }

    @GetMapping("/sent")
    public QuotePageDto sent(@RequestParam(required = false) List<QuoteRequestStatus> status,
                             @RequestParam(defaultValue = "0") int page,
                             @RequestParam(defaultValue = "20") int size, @AuthenticationPrincipal Jwt jwt) {
        return assembler.toPage(quoteService.listForRequester(
            tenantContext.getRequiredOrganizationId(), status, page, size, jwt, currentUserId(jwt)));
    }

    /**
     * Accepter un devis.
     *
     * <p>L'intervention est creee DANS LA FOULEE, mais seulement si la demande
     * portait sur un logement : une demande generale — « quels sont vos
     * tarifs ? » — vaut accord commercial, sans travail planifie.</p>
     */
    @PostMapping("/{id}/accept")
    public QuoteRequestDto accept(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return assembler.toDto(interventionService.accept(id, tenantContext.getRequiredOrganizationId(), jwt));
    }

    @PostMapping("/{id}/decline")
    public QuoteRequestDto decline(@PathVariable Long id, @RequestBody(required = false) ReasonBody body,
                                  @AuthenticationPrincipal Jwt jwt) {
        return assembler.toDto(interventionService.decline(
            id, tenantContext.getRequiredOrganizationId(), body == null ? null : body.reason(), jwt));
    }

    @PostMapping("/{id}/withdraw")
    public QuoteRequestDto withdraw(@PathVariable Long id, @RequestBody(required = false) ReasonBody body,
                                   @AuthenticationPrincipal Jwt jwt) {
        return assembler.toDto(quoteService.withdraw(
            id, tenantContext.getRequiredOrganizationId(), body == null ? null : body.reason(), jwt));
    }

    // ─── Cote prestataire ────────────────────────────────────────────────────

    @GetMapping("/received")
    public QuotePageDto received(@RequestParam(required = false) List<QuoteRequestStatus> status,
                                 @RequestParam(defaultValue = "0") int page,
                                 @RequestParam(defaultValue = "20") int size,
                                 @AuthenticationPrincipal Jwt jwt) {
        return assembler.toPage(quoteService.listForProvider(currentProviderId(jwt), status, page, size));
    }

    /** Combien de demandes attendent une reponse. Sert la pastille de navigation. */
    @GetMapping("/received/pending-count")
    public Map<String, Long> pendingCount(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("count", quoteService.countPendingForProvider(currentProviderId(jwt)));
    }

    @PostMapping("/{id}/quote")
    public QuoteRequestDto quote(@PathVariable Long id,
                                 @Valid @RequestBody QuoteBody body,
                                 @AuthenticationPrincipal Jwt jwt) {
        return assembler.toDto(quoteService.quote(id, currentProviderId(jwt),
            body.amount(), body.currency(), body.message(), body.validUntil(), body.providerTeamId()));
    }

    public record TeamOption(Long id, String name) {}
    public record TeamChoices(Long selectedTeamId, List<TeamOption> options) {}

    @GetMapping("/{id}/teams")
    public TeamChoices teams(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        Long providerId = currentProviderId(jwt);
        var request = quoteService.getFor(id, null, providerId);
        return new TeamChoices(request.getProviderTeamId(), quoteService.teamOptions(id, providerId).stream()
                .map(team -> new TeamOption(team.getId(), team.getName())).toList());
    }

    @PostMapping("/{id}/turn-down")
    public QuoteRequestDto turnDown(@PathVariable Long id,
                                    @RequestBody(required = false) ReasonBody body,
                                    @AuthenticationPrincipal Jwt jwt) {
        return assembler.toDto(quoteService.turnDown(id, currentProviderId(jwt),
            body == null ? null : body.reason()));
    }

    // ─── Lecture commune ─────────────────────────────────────────────────────

    /** Une demande, si l'appelant est l'un des deux cotes. */
    @GetMapping("/{id}")
    public QuoteRequestDto detail(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return assembler.toDto(quoteService.getFor(
            id, tenantContext.getOrganizationId(), providerIdOrNull(jwt), currentUserId(jwt), jwt));
    }

    @GetMapping("/{id}/commercial")
    public com.clenzy.controller.ServiceQuoteController.ServiceQuoteDto commercial(@PathVariable Long id,
                                                                                 @AuthenticationPrincipal Jwt jwt) {
        return assembler.commercial(quoteService.getFor(id, tenantContext.getOrganizationId(),
                providerIdOrNull(jwt), currentUserId(jwt), jwt));
    }

    // ─── Corps de requete ────────────────────────────────────────────────────

    public record CreateQuoteRequest(
        @NotNull Long providerId,
        @NotBlank(message = "Indiquez ce que vous demandez.") @Size(max = 150) String title,
        @Size(max = 4000) String message,
        Long propertyId,
        @Size(max = 40) String categoryCode,
        @Size(max = 60) String serviceItemCode,
        LocalDate desiredDate
    ) {}

    /** @param amount fixe par le PRESTATAIRE, jamais par le demandeur. */
    public record QuoteBody(
        @NotNull @Positive(message = "Indiquez un montant supérieur à zéro.") BigDecimal amount,
        @Size(max = 3) String currency,
        @Size(max = 4000) String message,
        LocalDate validUntil,
        Long providerTeamId
    ) {}

    public record ReasonBody(@Size(max = 500) String reason) {}

    // ─── Rouages ─────────────────────────────────────────────────────────────
    //
    // La resolution vit dans ProviderAccountResolver : un controller ne touche
    // pas un repository (regle ArchUnit gelee), et c'est ici que se decide un
    // droit d'acces — raison de plus pour qu'elle soit dans la couche service.

    private Long currentUserId(Jwt jwt) {
        return accountResolver.userIdOf(jwt.getSubject());
    }

    private Long currentProviderId(Jwt jwt) {
        return accountResolver.requireProviderId(jwt.getSubject());
    }

    private Long providerIdOrNull(Jwt jwt) {
        return accountResolver.providerIdOrNull(jwt.getSubject());
    }
}
