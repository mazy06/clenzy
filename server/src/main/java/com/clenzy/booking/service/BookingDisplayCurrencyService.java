package com.clenzy.booking.service;

import com.clenzy.booking.dto.AvailabilityResponseDto;
import com.clenzy.booking.dto.AvailabilityResponseDto.NightBreakdown;
import com.clenzy.booking.dto.PropertyCalendarDto;
import com.clenzy.booking.dto.PropertyCalendarDto.CalendarDayDto;
import com.clenzy.booking.dto.PublicPropertyDetailDto;
import com.clenzy.booking.dto.PublicPropertyDto;
import com.clenzy.service.CurrencyConverterService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Conversion des prix du Booking Engine vers une devise d'affichage choisie par le voyageur
 * (CLZ Domaine 2 — multi-devise).
 *
 * <p><b>Conversion d'AFFICHAGE uniquement</b> : le prix faisant foi (réservation / checkout) reste
 * dans la devise de la propriété. Le front indique « prix indicatifs, débité en {devise propriété} ».
 * Repli gracieux : devise non supportée, même devise, ou taux indisponible → montants d'origine
 * inchangés (jamais d'échec d'affichage).</p>
 */
@Service
public class BookingDisplayCurrencyService {

    private static final Logger log = LoggerFactory.getLogger(BookingDisplayCurrencyService.class);

    /** Devises d'affichage proposées (taux EUR/MAD/SAR alimentés quotidiennement). */
    private static final Set<String> SUPPORTED = Set.of("EUR", "MAD", "SAR");

    private final CurrencyConverterService currencyConverter;

    public BookingDisplayCurrencyService(CurrencyConverterService currencyConverter) {
        this.currencyConverter = currencyConverter;
    }

    public Set<String> supportedCurrencies() {
        return SUPPORTED;
    }

    /** Devise cible normalisée si une conversion est demandée ET possible, sinon {@code null}. */
    private String resolveTarget(String requested, String base) {
        if (requested == null || requested.isBlank()) {
            return null;
        }
        String target = requested.trim().toUpperCase(Locale.ROOT);
        if (!SUPPORTED.contains(target)) {
            return null;
        }
        if (base == null || target.equalsIgnoreCase(base)) {
            return null; // même devise → pas de conversion
        }
        return target;
    }

    private BigDecimal conv(BigDecimal amount, String from, String to, LocalDate date) {
        return amount == null ? null : currencyConverter.convert(amount, from, to, date);
    }

    public List<PublicPropertyDto> convertProperties(List<PublicPropertyDto> list, String requested, LocalDate date) {
        if (list == null || list.isEmpty()) {
            return list;
        }
        return list.stream().map(p -> convertProperty(p, requested, date)).toList();
    }

    public PublicPropertyDto convertProperty(PublicPropertyDto dto, String requested, LocalDate date) {
        if (dto == null) {
            return null;
        }
        String to = resolveTarget(requested, dto.currency());
        if (to == null) {
            return dto;
        }
        String from = dto.currency();
        try {
            return dto.withDisplayCurrency(conv(dto.priceFrom(), from, to, date), conv(dto.cleaningFee(), from, to, date), to);
        } catch (Exception e) {
            // Conversion tout-ou-rien : taux indisponible → on garde le DTO d'origine (affichage cohérent).
            log.warn("Conversion d'affichage {}->{} indisponible: {}", from, to, e.getMessage());
            return dto;
        }
    }

    public PublicPropertyDetailDto convertDetail(PublicPropertyDetailDto dto, String requested, LocalDate date) {
        if (dto == null) {
            return null;
        }
        String to = resolveTarget(requested, dto.currency());
        if (to == null) {
            return dto;
        }
        String from = dto.currency();
        try {
            return dto.withDisplayCurrency(conv(dto.nightlyPrice(), from, to, date), to);
        } catch (Exception e) {
            log.warn("Conversion d'affichage {}->{} indisponible: {}", from, to, e.getMessage());
            return dto;
        }
    }

    public PropertyCalendarDto convertCalendar(PropertyCalendarDto dto, String requested, LocalDate date) {
        if (dto == null) {
            return null;
        }
        String to = resolveTarget(requested, dto.currency());
        if (to == null) {
            return dto;
        }
        String from = dto.currency();
        try {
            List<CalendarDayDto> days = dto.days() == null ? null : dto.days().stream()
                .map(d -> new CalendarDayDto(d.date(), d.available(), conv(d.price(), from, to, date),
                    d.minNights(), d.checkInOnly(), d.checkOutOnly()))
                .toList();
            return dto.withDisplayCurrency(days, to);
        } catch (Exception e) {
            log.warn("Conversion d'affichage {}->{} indisponible: {}", from, to, e.getMessage());
            return dto;
        }
    }

    public AvailabilityResponseDto convertAvailability(AvailabilityResponseDto dto, String requested, LocalDate date) {
        if (dto == null) {
            return null;
        }
        String to = resolveTarget(requested, dto.currency());
        if (to == null) {
            return dto;
        }
        String from = dto.currency();
        try {
            List<NightBreakdown> breakdown = dto.breakdown() == null ? null : dto.breakdown().stream()
                .map(b -> new NightBreakdown(b.date(), conv(b.price(), from, to, date), b.rateType()))
                .toList();
            return dto.withDisplayCurrency(
                conv(dto.subtotal(), from, to, date),
                conv(dto.cleaningFee(), from, to, date),
                conv(dto.touristTax(), from, to, date),
                conv(dto.total(), from, to, date),
                conv(dto.directDiscount(), from, to, date),
                breakdown, to);
        } catch (Exception e) {
            log.warn("Conversion d'affichage {}->{} indisponible: {}", from, to, e.getMessage());
            return dto;
        }
    }
}
