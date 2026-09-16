package com.clenzy.marketplace.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.marketplace.model.MarketplaceQuoteRequest;
import com.clenzy.marketplace.model.QuoteRequestStatus;
import com.clenzy.model.Intervention;
import com.clenzy.model.ServiceQuote;
import com.clenzy.repository.ServiceQuoteCancellationRepository;
import com.clenzy.service.ServiceQuoteAmendmentService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDate;

/** Le verrou de l'accord annulé sérialise la création de ses demandes de remplacement. */
@Service
@Transactional
public class MarketplaceReplacementService {
    private final EntityManager em;
    private final ServiceQuoteAmendmentService access;
    private final ServiceQuoteCancellationRepository cancellations;
    private final MarketplaceQuoteService requests;
    private final ProviderAccountResolver accounts;
    private final Clock clock;
    public MarketplaceReplacementService(EntityManager em, ServiceQuoteAmendmentService access,
            ServiceQuoteCancellationRepository cancellations, MarketplaceQuoteService requests,
            ProviderAccountResolver accounts, Clock clock) {
        this.em = em; this.access = access; this.cancellations = cancellations;
        this.requests = requests; this.accounts = accounts; this.clock = clock;
    }
    public record Context(Long quoteId, Long propertyId, String title, String categoryCode,
                          String serviceItemCode, LocalDate desiredDate, Long activeRequestId,
                          java.time.LocalTime startTime, Integer durationMinutes, boolean requiresServiceSelection) {}

    @Transactional(readOnly = true)
    public Context context(Long id, Long orgId, Jwt jwt) { return context(authorize(id, orgId, jwt)); }

    public MarketplaceQuoteRequest replace(Long id, Long orgId, Jwt jwt, Long providerId, LocalDate date) {
        return replace(id, orgId, jwt, providerId, date, null, null);
    }

    public MarketplaceQuoteRequest replace(Long id, Long orgId, Jwt jwt, Long providerId, LocalDate date,
                                           String categoryCode, String serviceItemCode) {
        var quote = authorize(id, orgId, jwt);
        em.refresh(quote, LockModeType.PESSIMISTIC_WRITE);
        authorize(id, orgId, jwt);
        var context = context(quote);
        if (context.activeRequestId() != null)
            throw new IllegalStateException("Une demande de remplacement existe déjà ; consultez-la avant de solliciter un autre prestataire");
        LocalDate desired = date == null ? context.desiredDate() : date;
        if (desired != null && desired.isBefore(LocalDate.now(clock)))
            throw new IllegalArgumentException("Choisissez une nouvelle date pour remplacer cette mission passée");
        if (context.requiresServiceSelection() && (serviceItemCode == null || serviceItemCode.isBlank()))
            throw new IllegalArgumentException("Sélectionnez la prestation du remplaçant pour cette ancienne mission sans référence de catalogue");
        var next = requests.request(providerId, orgId, accounts.userIdOf(jwt.getSubject()), context.title(),
                null, context.propertyId(), context.requiresServiceSelection() ? categoryCode : context.categoryCode(),
                context.requiresServiceSelection() ? serviceItemCode : context.serviceItemCode(), desired);
        next.setReplacesQuoteId(id);
        next.setRequestedStartTime(context.startTime());
        next.setRequestedDurationMinutes(context.durationMinutes());
        // La requête est gérée par la même transaction : lien et création sont indivisibles.
        em.flush();
        return next;
    }

    private ServiceQuote authorize(Long id, Long orgId, Jwt jwt) {
        if (!access.access(id, orgId, jwt).canDecide()) throw new AccessDeniedException("Remplacement réservé au gestionnaire de l'accord");
        var quote = em.find(ServiceQuote.class, id);
        if (quote == null) throw new NotFoundException("Accord introuvable");
        if (!java.util.Objects.equals(orgId, quote.getOrganizationId())) throw new AccessDeniedException("Organisation incorrecte");
        if (!cancellations.existsById(id)) throw new IllegalStateException("Annulez d'abord l'accord avec un motif");
        return quote;
    }

    private Context context(ServiceQuote quote) {
        var original = quote.getMarketplaceRequestId() == null ? null : em.find(MarketplaceQuoteRequest.class, quote.getMarketplaceRequestId());
        var mission = quote.getInterventionId() == null ? null : em.find(Intervention.class, quote.getInterventionId());
        String title = original != null ? original.getTitle() : mission != null ? mission.getTitle() : "Nouvelle prestation";
        if (title == null || title.isBlank()) title = "Nouvelle prestation";
        if (title.length() > 150) title = title.substring(0, 150);
        var candidates = em.createQuery("SELECT r FROM MarketplaceQuoteRequest r WHERE r.replacesQuoteId = :id ORDER BY r.id DESC", MarketplaceQuoteRequest.class)
                .setParameter("id", quote.getId()).getResultList();
        Long active = candidates.stream().filter(r -> r.getStatus() == QuoteRequestStatus.SENT
                || r.getStatus() == QuoteRequestStatus.ACCEPTED
                || (r.getStatus() == QuoteRequestStatus.QUOTED && !r.isExpiredOn(LocalDate.now(clock))))
                .map(MarketplaceQuoteRequest::getId).findFirst().orElse(null);
        Long propertyId = quote.getPropertyId() != null ? quote.getPropertyId()
                : mission != null && mission.getProperty() != null ? mission.getProperty().getId() : null;
        java.time.LocalDateTime start = mission == null ? null : mission.getStartTime() != null ? mission.getStartTime() : mission.getScheduledDate();
        LocalDate desiredDate = start != null ? start.toLocalDate()
                : original == null ? quote.getEarliestStartDate() : original.getDesiredDate();
        Integer minutes = original == null ? null : original.getRequestedDurationMinutes();
        if (start != null && mission.getEndTime() != null && mission.getEndTime().isAfter(start))
            minutes = Math.toIntExact(java.time.Duration.between(start, mission.getEndTime()).toMinutes());
        else if (mission != null && mission.getEstimatedDurationHours() != null && mission.getEstimatedDurationHours() > 0)
            minutes = Math.multiplyExact(mission.getEstimatedDurationHours(), 60);
        return new Context(quote.getId(), propertyId, title,
                original == null ? null : original.getCategoryCode(), original == null ? null : original.getServiceItemCode(),
                desiredDate, active, start == null ? original == null ? null : original.getRequestedStartTime() : start.toLocalTime(), minutes,
                mission != null && (original == null || (original.getCategoryCode() == null && original.getServiceItemCode() == null)));
    }
}
