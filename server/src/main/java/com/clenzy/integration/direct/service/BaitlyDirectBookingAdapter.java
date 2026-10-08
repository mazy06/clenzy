package com.clenzy.integration.direct.service;

import com.clenzy.booking.dto.*;
import com.clenzy.booking.service.PublicBookingService;
import com.clenzy.integration.direct.dto.*;
import com.clenzy.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import java.math.*;
import java.util.*;

/** Compatibilité du widget historique : prix, retenue, taxes et paiement passent par le moteur commun. */
@Service
public class BaitlyDirectBookingAdapter {
    private final PublicBookingService booking;
    private final ReservationRepository reservations;
    public BaitlyDirectBookingAdapter(PublicBookingService booking,ReservationRepository reservations) {
        this.booking=booking;this.reservations=reservations;
    }
    public DirectAvailabilityResponse availability(DirectAvailabilityRequest request,Long org) {
        var quote=booking.checkAvailability(booking.resolveOrgById(org),new AvailabilityRequestDto(request.propertyId(),request.checkIn(),request.checkOut(),request.numberOfGuests()));
        return new DirectAvailabilityResponse(quote.available(),quote.propertyId(),quote.total(),quote.nights()>0
                ?quote.subtotal().divide(BigDecimal.valueOf(quote.nights()),2,RoundingMode.HALF_UP):BigDecimal.ZERO,
                quote.currency(),quote.nights(),quote.minStay()==null?1:quote.minStay(),365,List.of());
    }
    public DirectBookingResponse create(DirectBookingRequest request,Long org) {
        var ctx=booking.resolveOrgById(org);
        var preview=booking.checkAvailability(ctx,new AvailabilityRequestDto(request.propertyId(),request.checkIn(),request.checkOut(),request.numberOfGuests(),request.numberOfChildren()));
        if(request.currency()!=null && !request.currency().isBlank() && !request.currency().equalsIgnoreCase(preview.currency()))
            throw new IllegalArgumentException("La devise ne correspond pas à celle du logement");
        var hold=booking.reserve(ctx,new BookingReserveRequestDto(request.propertyId(),request.checkIn(),request.checkOut(),request.numberOfGuests(),
                new BookingReserveRequestDto.GuestInfo(request.guestFirstName()+" "+request.guestLastName(),request.guestEmail(),request.guestPhone()),
                request.specialRequests(),request.promoCode(),request.numberOfChildren()));
        // Un échec PSP conserve la retenue et le code permettant sa reprise ; il ne libère pas des dates potentiellement payées.
        if(hold.requiresPayment()) {
            com.clenzy.booking.dto.BookingCheckoutResponseDto checkout;
            try {checkout=booking.checkout(ctx,new BookingCheckoutRequestDto(hold.reservationCode(),null));}
            catch(RuntimeException pending) {
                return new DirectBookingResponse(hold.reservationCode(),DirectBookingResponse.STATUS_PAYMENT_REQUIRED,hold.propertyName(),
                        hold.checkIn(),hold.checkOut(),hold.total(),hold.currency(),null,null,"Paiement à reprendre avec ce code de réservation",null);
            }
            return new DirectBookingResponse(hold.reservationCode(),DirectBookingResponse.STATUS_PAYMENT_REQUIRED,hold.propertyName(),
                    hold.checkIn(),hold.checkOut(),hold.total(),hold.currency(),null,null,"Poursuivez le paiement sécurisé",checkout.checkoutUrl());
        }
        return new DirectBookingResponse(hold.reservationCode(),hold.status(),hold.propertyName(),hold.checkIn(),hold.checkOut(),hold.total(),hold.currency(),null,null,
                "CONFIRMED".equals(hold.status())?"Réservation confirmée":"Réservation en attente",null);
    }
    public DirectPromoCodeDto preview(BaitlyDirectPromoPreview request,Long org){
        var ctx=booking.resolveOrgById(org);
        var quote=booking.checkAvailability(ctx,new AvailabilityRequestDto(request.propertyId(),request.checkIn(),request.checkOut(),request.guests(),request.children()));
        if(!quote.available())throw new IllegalArgumentException("Le séjour n'est pas disponible à ces dates");
        var result=booking.previewVoucher(ctx,request.code(),request.email(),quote);
        // Compatibilité du widget : montant calculé pour CE séjour ; aucun compteur global exposé.
        return new DirectPromoCodeDto(request.code(),DirectPromoCodeDto.DISCOUNT_FIXED,result.discountApplied(),null,null,0,0,0);
    }
    public BookingCheckoutResponseDto resume(String code,Long org){
        return booking.checkout(booking.resolveOrgById(org),new BookingCheckoutRequestDto(code,null));
    }
    @org.springframework.transaction.annotation.Transactional(readOnly=true)
    public DirectBookingResponse confirm(String code,Long org) {
        var reservation=reservations.findByConfirmationCodeAndOrganizationId(code,org).orElseThrow(()->new IllegalArgumentException("Réservation introuvable"));
        // Le retour navigateur lit l'état ; seuls le parcours sans paiement et une preuve PSP peuvent le confirmer.
        return new DirectBookingResponse(code,reservation.getStatus().toUpperCase(Locale.ROOT),reservation.getProperty().getName(),reservation.getCheckIn(),
                reservation.getCheckOut(),reservation.getTotalPrice(),reservation.getCurrency(),null,null,
                "confirmed".equalsIgnoreCase(reservation.getStatus())?"Réservation confirmée":"Confirmation du paiement en attente",null);
    }
}
