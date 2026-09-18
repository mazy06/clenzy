package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceQuoteRequest;
import com.clenzy.service.ServiceQuoteService;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** L'écran marketplace utilise les mêmes décisions commerciales que le PMS. */
@Service
public class MarketplaceQuoteInterventionService {
    private final MarketplaceQuoteService requests;
    private final MarketplaceQuoteMissionFactory missions;
    private final ServiceQuoteService quotes;

    public MarketplaceQuoteInterventionService(MarketplaceQuoteService requests,
            MarketplaceQuoteMissionFactory missions, ServiceQuoteService quotes) {
        this.requests = requests; this.missions = missions; this.quotes = quotes;
    }

    @Transactional
    public MarketplaceQuoteRequest accept(Long id, Long orgId, Jwt jwt) {
        var request = requests.getFor(id, orgId, null);
        missions.assertCanDecide(request, orgId, jwt);
        var quote = quotes.ensureMarketplaceQuote(request);
        quotes.approve(quote.getId(), orgId, "user:" + jwt.getSubject(), jwt);
        return requests.getFor(id, orgId, null);
    }

    @Transactional
    public MarketplaceQuoteRequest decline(Long id, Long orgId, String reason, Jwt jwt) {
        var request = requests.getFor(id, orgId, null);
        missions.assertCanDecide(request, orgId, jwt);
        var quote = quotes.ensureMarketplaceQuote(request);
        quotes.rejectMarketplace(quote.getId(), orgId, jwt, reason);
        return requests.getFor(id, orgId, null);
    }
}
