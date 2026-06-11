package com.clenzy.booking.service;

import com.clenzy.booking.dto.AvailabilityRequestDto;
import com.clenzy.booking.dto.AvailabilityResponseDto;
import com.clenzy.booking.dto.BookingCheckoutRequest;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * Devis 100% serveur pour l'Embedded Checkout du Booking Engine.
 *
 * <p>Z4A-SEC-01 / Z4A-BUGS-01 : le montant facture est TOUJOURS recalcule cote
 * serveur (PriceEngine via {@link PublicBookingService#checkAvailability} + service
 * options). Le montant fourni par le client n'est qu'un cross-check : toute
 * divergence au-dela de la tolerance d'arrondi est rejetee (IllegalArgumentException
 * → 400 cote controller).</p>
 */
@Service
public class BookingCheckoutQuoteService {

    private static final Logger log = LoggerFactory.getLogger(BookingCheckoutQuoteService.class);

    private final PropertyRepository propertyRepository;
    private final BookingServiceOptionsService serviceOptionsService;
    private final PublicBookingService publicBookingService;

    public BookingCheckoutQuoteService(PropertyRepository propertyRepository,
                                       BookingServiceOptionsService serviceOptionsService,
                                       PublicBookingService publicBookingService) {
        this.propertyRepository = propertyRepository;
        this.serviceOptionsService = serviceOptionsService;
        this.publicBookingService = publicBookingService;
    }

    /** Devis 100% serveur : le montant client n'est qu'un cross-check (Z4A-SEC-01). */
    public record CheckoutQuote(Property property, PublicBookingService.OrgContext ctx,
                                AvailabilityResponseDto availability, BigDecimal serviceOptionsTotal,
                                BigDecimal totalAmount, LocalDate checkIn, LocalDate checkOut) {}

    @Transactional(readOnly = true)
    public CheckoutQuote quote(BookingCheckoutRequest request) {
        Property property = propertyRepository.findById(request.propertyId())
            .orElseThrow(() -> new IllegalArgumentException("Propriété introuvable"));
        Long orgId = property.getOrganizationId();
        // Validate cross-tenant: property must belong to the requested organization
        if (!orgId.equals(request.organizationId())) {
            throw new IllegalArgumentException("Propriété introuvable pour cette organisation");
        }

        LocalDate checkIn = LocalDate.parse(request.checkIn());
        LocalDate checkOut = LocalDate.parse(request.checkOut());

        PublicBookingService.OrgContext ctx = publicBookingService.resolveOrgById(orgId);
        AvailabilityResponseDto availability = publicBookingService.checkAvailability(
            ctx, new AvailabilityRequestDto(request.propertyId(), checkIn, checkOut, request.guests()));
        if (!availability.available()) {
            throw new IllegalStateException("Dates non disponibles");
        }

        BigDecimal serviceOptionsTotal = computeServiceOptionsTotal(request, orgId, checkIn, checkOut);
        // Cross-check du montant client contre le devis serveur. Deux references
        // acceptees car le widget historique envoie le total HORS taxe de sejour
        // (« calculee cote serveur ») : total complet OU subtotal + menage.
        BigDecimal serverTotal = availability.total();
        BigDecimal serverTotalExclTax = availability.subtotal().add(availability.cleaningFee());
        if (!isWithinTolerance(request.amount(), serverTotal)
            && !isWithinTolerance(request.amount(), serverTotalExclTax)) {
            log.warn("Booking engine checkout: montant client divergent du devis serveur (property={})",
                request.propertyId());
            throw new IllegalArgumentException("Le montant ne correspond pas au prix calculé");
        }

        // Le montant facture est TOUJOURS le total serveur complet (taxe incluse)
        return new CheckoutQuote(property, ctx, availability, serviceOptionsTotal,
            serverTotal.add(serviceOptionsTotal), checkIn, checkOut);
    }

    private static boolean isWithinTolerance(BigDecimal clientAmount, BigDecimal serverAmount) {
        return clientAmount.subtract(serverAmount).abs()
            .compareTo(PublicBookingService.AMOUNT_TOLERANCE) <= 0;
    }

    private BigDecimal computeServiceOptionsTotal(BookingCheckoutRequest request, Long orgId,
                                                  LocalDate checkIn, LocalDate checkOut) {
        if (request.serviceOptions() == null || request.serviceOptions().isEmpty()) {
            return BigDecimal.ZERO;
        }
        int nights = Math.max(1, (int) ChronoUnit.DAYS.between(checkIn, checkOut));
        return serviceOptionsService.computeServiceOptionsTotal(
            request.serviceOptions(), request.guests(), nights, orgId);
    }
}
