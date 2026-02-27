package com.clenzy.integration.booking.service;

import com.clenzy.integration.booking.config.BookingConfig;
import com.clenzy.integration.booking.dto.BookingCalendarEventDto;
import com.clenzy.integration.booking.dto.BookingRateDto;
import com.clenzy.integration.booking.dto.BookingReservationDto;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Client API pour Booking.com (OTA XML standard).
 *
 * Booking.com utilise une API XML avec authentification HTTP Basic.
 * Les requetes suivent le format OTA (Open Travel Alliance).
 *
 * Toutes les methodes publiques sont protegees par un circuit breaker
 * pour eviter de surcharger l'API Booking.com en cas de panne.
 */
@Service
public class BookingApiClient {

    private static final Logger log = LoggerFactory.getLogger(BookingApiClient.class);
    private static final DateTimeFormatter OTA_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final BookingConfig config;
    private final RestTemplate restTemplate;

    public BookingApiClient(BookingConfig config, RestTemplate restTemplate) {
        this.config = config;
        this.restTemplate = restTemplate;
    }

    /**
     * Recupere les disponibilites d'un hotel pour une plage de dates.
     *
     * @param hotelId identifiant Booking.com de l'hotel
     * @param from    debut de la plage (inclus)
     * @param to      fin de la plage (exclus)
     * @return liste des evenements calendrier
     */
    @CircuitBreaker(name = "booking-api")
    public List<BookingCalendarEventDto> getAvailability(String hotelId, LocalDate from, LocalDate to) {
        log.debug("Requete disponibilite Booking.com hotel={} [{}, {})", hotelId, from, to);

        String xmlRequest = buildAvailabilityRequest(hotelId, from, to);
        String response = sendXmlRequest(xmlRequest);

        return parseAvailabilityResponse(response, hotelId);
    }

    /**
     * Met a jour les disponibilites d'un hotel sur Booking.com.
     *
     * @param events liste des evenements calendrier a pousser
     * @return true si la mise a jour a reussi
     */
    @CircuitBreaker(name = "booking-api")
    public boolean updateAvailability(List<BookingCalendarEventDto> events) {
        if (events.isEmpty()) {
            log.debug("Aucun evenement calendrier a pousser vers Booking.com");
            return true;
        }

        String hotelId = events.getFirst().hotelId();
        log.debug("Mise a jour disponibilite Booking.com hotel={} ({} jours)", hotelId, events.size());

        String xmlRequest = buildAvailabilityUpdateRequest(events);
        String response = sendXmlRequest(xmlRequest);

        return isSuccessResponse(response);
    }

    /**
     * Met a jour les tarifs d'un hotel sur Booking.com.
     *
     * @param rates liste des tarifs a pousser
     * @return true si la mise a jour a reussi
     */
    @CircuitBreaker(name = "booking-api")
    public boolean updateRates(List<BookingRateDto> rates) {
        if (rates.isEmpty()) {
            log.debug("Aucun tarif a pousser vers Booking.com");
            return true;
        }

        String roomId = rates.getFirst().roomId();
        log.debug("Mise a jour tarifs Booking.com room={} ({} jours)", roomId, rates.size());

        String xmlRequest = buildRateUpdateRequest(rates);
        String response = sendXmlRequest(xmlRequest);

        return isSuccessResponse(response);
    }

    /**
     * Recupere les reservations recentes d'un hotel.
     *
     * @param hotelId identifiant Booking.com de l'hotel
     * @param since   date a partir de laquelle recuperer les reservations
     * @return liste des reservations
     */
    @CircuitBreaker(name = "booking-api")
    public List<BookingReservationDto> getReservations(String hotelId, LocalDate since) {
        log.debug("Requete reservations Booking.com hotel={} depuis {}", hotelId, since);

        String xmlRequest = buildReservationRequest(hotelId, since);
        String response = sendXmlRequest(xmlRequest);

        return parseReservationResponse(response, hotelId);
    }

    /**
     * Acquitte une reservation aupres de Booking.com.
     * Booking.com requiert un acquittement pour confirmer la reception.
     *
     * @param reservationId identifiant de la reservation
     * @return true si l'acquittement a reussi
     */
    @CircuitBreaker(name = "booking-api")
    public boolean acknowledgeReservation(String reservationId) {
        log.debug("Acquittement reservation Booking.com: {}", reservationId);

        String xmlRequest = buildAcknowledgeRequest(reservationId);
        String response = sendXmlRequest(xmlRequest);

        return isSuccessResponse(response);
    }

    // ================================================================
    // XML Request Builders (OTA standard)
    // ================================================================

    private String buildAvailabilityRequest(String hotelId, LocalDate from, LocalDate to) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <OTA_HotelAvailRQ xmlns="http://www.opentravel.org/OTA/2003/05" Version="1.0">
                    <AvailRequestSegments>
                        <AvailRequestSegment>
                            <HotelSearchCriteria>
                                <Criterion>
                                    <HotelRef HotelCode="%s"/>
                                    <StayDateRange Start="%s" End="%s"/>
                                </Criterion>
                            </HotelSearchCriteria>
                        </AvailRequestSegment>
                    </AvailRequestSegments>
                </OTA_HotelAvailRQ>
                """.formatted(hotelId, from.format(OTA_DATE_FORMAT), to.format(OTA_DATE_FORMAT));
    }

    private String buildAvailabilityUpdateRequest(List<BookingCalendarEventDto> events) {
        var sb = new StringBuilder();
        sb.append("""
                <?xml version="1.0" encoding="UTF-8"?>
                <OTA_HotelAvailNotifRQ xmlns="http://www.opentravel.org/OTA/2003/05" Version="1.0">
                    <AvailStatusMessages HotelCode="%s">
                """.formatted(events.getFirst().hotelId()));

        for (BookingCalendarEventDto event : events) {
            sb.append("""
                        <AvailStatusMessage>
                            <StatusApplicationControl Start="%s" End="%s" InvTypeCode="%s"/>
                            <LengthsOfStay>
                                <LengthOfStay MinMaxMessageType="SetMinLOS" Time="%d"/>
                                <LengthOfStay MinMaxMessageType="SetMaxLOS" Time="%d"/>
                            </LengthsOfStay>
                            <RestrictionStatus Status="%s"
                                Restriction="Arrival" Status2="%s"
                            />
                        </AvailStatusMessage>
                    """.formatted(
                    event.date().format(OTA_DATE_FORMAT),
                    event.date().plusDays(1).format(OTA_DATE_FORMAT),
                    event.roomId(),
                    event.minStay(),
                    event.maxStay(),
                    event.closedOnArrival() ? "Close" : "Open",
                    event.closedOnDeparture() ? "Close" : "Open"
            ));
        }

        sb.append("""
                    </AvailStatusMessages>
                </OTA_HotelAvailNotifRQ>
                """);
        return sb.toString();
    }

    private String buildRateUpdateRequest(List<BookingRateDto> rates) {
        var sb = new StringBuilder();
        sb.append("""
                <?xml version="1.0" encoding="UTF-8"?>
                <OTA_HotelRatePlanNotifRQ xmlns="http://www.opentravel.org/OTA/2003/05" Version="1.0">
                    <RatePlans>
                """);

        for (BookingRateDto rate : rates) {
            sb.append("""
                        <RatePlan RatePlanCode="%s">
                            <Rates>
                                <Rate InvTypeCode="%s" Start="%s" End="%s">
                                    <BaseByGuestAmts>
                                        <BaseByGuestAmt AmountAfterTax="%s" CurrencyCode="%s"/>
                                    </BaseByGuestAmts>
                                </Rate>
                            </Rates>
                        </RatePlan>
                    """.formatted(
                    rate.ratePlanCode(),
                    rate.roomId(),
                    rate.date().format(OTA_DATE_FORMAT),
                    rate.date().plusDays(1).format(OTA_DATE_FORMAT),
                    rate.price().toPlainString(),
                    rate.currency()
            ));
        }

        sb.append("""
                    </RatePlans>
                </OTA_HotelRatePlanNotifRQ>
                """);
        return sb.toString();
    }

    private String buildReservationRequest(String hotelId, LocalDate since) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <OTA_ReadRQ xmlns="http://www.opentravel.org/OTA/2003/05" Version="1.0">
                    <ReadRequests>
                        <HotelReadRequest HotelCode="%s">
                            <SelectionCriteria Start="%s" End="%s"/>
                        </HotelReadRequest>
                    </ReadRequests>
                </OTA_ReadRQ>
                """.formatted(hotelId, since.format(OTA_DATE_FORMAT), LocalDate.now().format(OTA_DATE_FORMAT));
    }

    private String buildAcknowledgeRequest(String reservationId) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <OTA_NotifReportRQ xmlns="http://www.opentravel.org/OTA/2003/05" Version="1.0">
                    <NotifDetails>
                        <HotelNotifReport>
                            <HotelReservations>
                                <HotelReservation ResStatus="Commit" UniqueID="%s"/>
                            </HotelReservations>
                        </HotelNotifReport>
                    </NotifDetails>
                </OTA_NotifReportRQ>
                """.formatted(reservationId);
    }

    // ================================================================
    // HTTP Client
    // ================================================================

    /**
     * Envoie une requete XML a l'API Booking.com avec authentification HTTP Basic.
     */
    private String sendXmlRequest(String xmlBody) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_XML);
        headers.setAccept(List.of(MediaType.APPLICATION_XML));
        headers.setBasicAuth(config.getUsername(), config.getPassword(), StandardCharsets.UTF_8);

        HttpEntity<String> request = new HttpEntity<>(xmlBody, headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    config.getApiBaseUrl(),
                    HttpMethod.POST,
                    request,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                log.debug("Reponse Booking.com recue ({} caracteres)",
                        response.getBody() != null ? response.getBody().length() : 0);
                return response.getBody();
            }

            log.error("Reponse HTTP Booking.com non-2xx: {}", response.getStatusCode());
            return null;

        } catch (RestClientException e) {
            log.error("Erreur communication API Booking.com: {}", e.getMessage());
            throw e;
        }
    }

    // ================================================================
    // XML Response Parsers
    // ================================================================

    /**
     * Parse la reponse XML de disponibilite.
     * TODO : implementer le parsing XML complet avec JAXB ou DOM parser.
     */
    private List<BookingCalendarEventDto> parseAvailabilityResponse(String response, String hotelId) {
        if (response == null || response.isEmpty()) {
            log.warn("Reponse disponibilite vide pour hotel {}", hotelId);
            return List.of();
        }

        // TODO : parser le XML OTA_HotelAvailRS
        // Pour l'instant, retourne une liste vide — le parsing sera implemente
        // une fois les tests d'integration avec l'API Booking.com en place
        log.debug("Parsing disponibilite Booking.com pour hotel {} (a implementer)", hotelId);
        return List.of();
    }

    /**
     * Parse la reponse XML des reservations.
     * TODO : implementer le parsing XML complet avec JAXB ou DOM parser.
     */
    private List<BookingReservationDto> parseReservationResponse(String response, String hotelId) {
        if (response == null || response.isEmpty()) {
            log.warn("Reponse reservations vide pour hotel {}", hotelId);
            return List.of();
        }

        // TODO : parser le XML OTA_HotelResRS / OTA_ResRetrieveRS
        // Pour l'instant, retourne une liste vide — le parsing sera implemente
        // une fois les tests d'integration avec l'API Booking.com en place
        log.debug("Parsing reservations Booking.com pour hotel {} (a implementer)", hotelId);
        return List.of();
    }

    /**
     * Verifie si la reponse XML indique un succes.
     */
    private boolean isSuccessResponse(String response) {
        if (response == null) {
            return false;
        }
        // Les reponses OTA utilisent Success element pour indiquer le succes
        return response.contains("<Success") || response.contains("<Success/>");
    }
}
