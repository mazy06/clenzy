package com.clenzy.marketplace.service;

import com.clenzy.marketplace.dto.QuotePageDto;
import com.clenzy.marketplace.dto.QuoteRequestDto;
import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.MarketplaceQuoteRequest;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Habille une demande de devis des noms que les ecrans affichent.
 *
 * <p>Extrait parce que les deux cotes — demandeur et prestataire — ont besoin
 * des MEMES deux noms, et que les resoudre demande par demande ferait une
 * requete par ligne de liste. Ici, une fois pour toute la page.</p>
 */
@Component
public class QuoteRequestAssembler {

    private final MarketplaceProviderRepository providerRepository;
    private final OrganizationNameResolver organizationNameResolver;
    private final Clock clock;
    private final com.clenzy.repository.ServiceQuoteRepository commercialQuotes;

    public QuoteRequestAssembler(MarketplaceProviderRepository providerRepository,
                                 OrganizationNameResolver organizationNameResolver,
                                 Clock clock, com.clenzy.repository.ServiceQuoteRepository commercialQuotes) {
        this.commercialQuotes = commercialQuotes;
        this.providerRepository = providerRepository;
        this.organizationNameResolver = organizationNameResolver;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public com.clenzy.controller.ServiceQuoteController.ServiceQuoteDto commercial(MarketplaceQuoteRequest request) {
        var quote = commercialQuotes.findMarketplaceQuote(request.getId(), request.getRequesterOrganizationId())
                .orElseThrow(() -> new com.clenzy.exception.NotFoundException("Devis commercial introuvable"));
        return com.clenzy.controller.ServiceQuoteController.ServiceQuoteDto.from(quote);
    }

    @Transactional(readOnly = true)
    public QuoteRequestDto toDto(MarketplaceQuoteRequest quote) {
        return QuoteRequestDto.from(quote,
            providerName(quote.getProviderId()),
            organizationNameResolver.nameOf(quote.getRequesterOrganizationId()),
            LocalDate.now(clock));
    }

    @Transactional(readOnly = true)
    public QuotePageDto toPage(Page<MarketplaceQuoteRequest> page) {
        LocalDate today = LocalDate.now(clock);

        // Resolution groupee : une requete par ligne de liste serait un N+1
        // parfaitement evitable.
        Map<Long, String> providerNames = new HashMap<>();
        providerRepository.findAllById(
                page.getContent().stream().map(MarketplaceQuoteRequest::getProviderId).distinct().toList())
            .forEach(provider -> providerNames.put(provider.getId(), provider.getDisplayName()));

        Map<Long, String> organizationNames = new HashMap<>();
        page.getContent().stream()
            .map(MarketplaceQuoteRequest::getRequesterOrganizationId)
            .distinct()
            .forEach(id -> organizationNames.put(id, organizationNameResolver.nameOf(id)));

        List<QuoteRequestDto> items = page.getContent().stream()
            .map(quote -> QuoteRequestDto.from(quote,
                providerNames.get(quote.getProviderId()),
                organizationNames.get(quote.getRequesterOrganizationId()),
                today))
            .toList();

        return new QuotePageDto(items, page.getNumber(), page.getSize(),
            page.getTotalElements(), page.getTotalPages());
    }

    private String providerName(Long providerId) {
        return providerRepository.findById(providerId)
            .map(MarketplaceProvider::getDisplayName)
            .orElse(null);
    }
}
