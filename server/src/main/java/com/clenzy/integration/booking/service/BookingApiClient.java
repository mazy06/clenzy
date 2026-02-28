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
import org.w3c.dom.*;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
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
    private final DocumentBuilderFactory xmlFactory;

    public BookingApiClient(BookingConfig config, RestTemplate restTemplate) {
        this.config = config;
        this.restTemplate = restTemplate;
        this.xmlFactory = DocumentBuilderFactory.newInstance();
        this.xmlFactory.setNamespaceAware(true);
        // Security: prevent XXE attacks
        try {
            this.xmlFactory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            this.xmlFactory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            this.xmlFactory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        } catch (Exception e) {
            log.warn("Could not configure XML parser security features: {}", e.getMessage());
        }
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
     * Parse la reponse XML OTA_HotelAvailRS pour extraire les disponibilites.
     *
     * Format attendu :
     * <OTA_HotelAvailRS>
     *   <RoomStays>
     *     <RoomStay>
     *       <RoomTypes>
     *         <RoomType RoomTypeCode="..."/>
     *       </RoomTypes>
     *       <RatePlans>
     *         <RatePlan>
     *           <Rates>
     *             <Rate EffectiveDate="..." ExpireDate="...">
     *               <Base AmountAfterTax="..." CurrencyCode="..."/>
     *             </Rate>
     *           </Rates>
     *         </RatePlan>
     *       </RatePlans>
     *       <RoomRates>
     *         <RoomRate>
     *           <Rates>
     *             <Rate>
     *               <Base AmountAfterTax="..." CurrencyCode="..."/>
     *             </Rate>
     *           </Rates>
     *         </RoomRate>
     *       </RoomRates>
     *     </RoomStay>
     *   </RoomStays>
     * </OTA_HotelAvailRS>
     */
    private List<BookingCalendarEventDto> parseAvailabilityResponse(String response, String hotelId) {
        if (response == null || response.isEmpty()) {
            log.warn("Reponse disponibilite vide pour hotel {}", hotelId);
            return List.of();
        }

        List<BookingCalendarEventDto> events = new ArrayList<>();

        try {
            Document doc = parseXmlDocument(response);
            if (doc == null) return List.of();

            // Check for errors first
            if (hasOtaError(doc)) {
                log.error("Booking.com API returned error for availability request (hotel={})", hotelId);
                return List.of();
            }

            // Parse AvailStatusMessages (from OTA_HotelAvailGetRS)
            NodeList statusMessages = doc.getElementsByTagNameNS("*", "AvailStatusMessage");
            if (statusMessages.getLength() > 0) {
                events.addAll(parseAvailStatusMessages(statusMessages, hotelId));
            }

            // Parse RoomStays (from OTA_HotelAvailRS)
            NodeList roomStays = doc.getElementsByTagNameNS("*", "RoomStay");
            if (roomStays.getLength() > 0) {
                events.addAll(parseRoomStays(roomStays, hotelId));
            }

            log.info("Parsed {} availability events for hotel {}", events.size(), hotelId);

        } catch (Exception e) {
            log.error("Erreur parsing disponibilite Booking.com pour hotel {}: {}", hotelId, e.getMessage());
        }

        return events;
    }

    private List<BookingCalendarEventDto> parseAvailStatusMessages(NodeList statusMessages, String hotelId) {
        List<BookingCalendarEventDto> events = new ArrayList<>();

        for (int i = 0; i < statusMessages.getLength(); i++) {
            Element msg = (Element) statusMessages.item(i);

            try {
                // StatusApplicationControl contains date and room info
                NodeList controls = msg.getElementsByTagNameNS("*", "StatusApplicationControl");
                if (controls.getLength() == 0) continue;

                Element control = (Element) controls.item(0);
                String start = control.getAttribute("Start");
                String roomId = control.getAttribute("InvTypeCode");

                if (start.isEmpty()) continue;
                LocalDate date = LocalDate.parse(start, OTA_DATE_FORMAT);

                // Parse LengthsOfStay
                int minStay = 1;
                int maxStay = 365;
                NodeList losNodes = msg.getElementsByTagNameNS("*", "LengthOfStay");
                for (int j = 0; j < losNodes.getLength(); j++) {
                    Element los = (Element) losNodes.item(j);
                    String type = los.getAttribute("MinMaxMessageType");
                    String time = los.getAttribute("Time");
                    if (!time.isEmpty()) {
                        if ("SetMinLOS".equals(type)) minStay = Integer.parseInt(time);
                        else if ("SetMaxLOS".equals(type)) maxStay = Integer.parseInt(time);
                    }
                }

                // Parse RestrictionStatus
                boolean closedOnArrival = false;
                boolean closedOnDeparture = false;
                NodeList restrictionNodes = msg.getElementsByTagNameNS("*", "RestrictionStatus");
                if (restrictionNodes.getLength() > 0) {
                    Element restriction = (Element) restrictionNodes.item(0);
                    closedOnArrival = "Close".equals(restriction.getAttribute("Status"));
                    closedOnDeparture = "Close".equals(restriction.getAttribute("Status2"));
                }

                // Determine availability (not closed = available)
                boolean available = !closedOnArrival;

                events.add(new BookingCalendarEventDto(
                    hotelId, roomId.isEmpty() ? "default" : roomId, date,
                    available, BigDecimal.ZERO, "EUR",
                    minStay, maxStay, closedOnArrival, closedOnDeparture
                ));

            } catch (Exception e) {
                log.warn("Skipping malformed AvailStatusMessage at index {}: {}", i, e.getMessage());
            }
        }

        return events;
    }

    private List<BookingCalendarEventDto> parseRoomStays(NodeList roomStays, String hotelId) {
        List<BookingCalendarEventDto> events = new ArrayList<>();

        for (int i = 0; i < roomStays.getLength(); i++) {
            Element roomStay = (Element) roomStays.item(i);

            try {
                // Get room type code
                String roomId = "default";
                NodeList roomTypes = roomStay.getElementsByTagNameNS("*", "RoomType");
                if (roomTypes.getLength() > 0) {
                    String code = ((Element) roomTypes.item(0)).getAttribute("RoomTypeCode");
                    if (!code.isEmpty()) roomId = code;
                }

                // Parse rates with dates
                NodeList rates = roomStay.getElementsByTagNameNS("*", "Rate");
                for (int j = 0; j < rates.getLength(); j++) {
                    Element rate = (Element) rates.item(j);
                    String effectiveDate = rate.getAttribute("EffectiveDate");
                    if (effectiveDate.isEmpty()) continue;

                    LocalDate date = LocalDate.parse(effectiveDate, OTA_DATE_FORMAT);

                    // Parse Base amount
                    BigDecimal price = BigDecimal.ZERO;
                    String currency = "EUR";
                    NodeList bases = rate.getElementsByTagNameNS("*", "Base");
                    if (bases.getLength() == 0) {
                        bases = rate.getElementsByTagNameNS("*", "BaseByGuestAmt");
                    }
                    if (bases.getLength() > 0) {
                        Element base = (Element) bases.item(0);
                        String amount = base.getAttribute("AmountAfterTax");
                        if (amount.isEmpty()) amount = base.getAttribute("AmountBeforeTax");
                        if (!amount.isEmpty()) price = new BigDecimal(amount);
                        String curr = base.getAttribute("CurrencyCode");
                        if (!curr.isEmpty()) currency = curr;
                    }

                    events.add(new BookingCalendarEventDto(
                        hotelId, roomId, date, true, price, currency,
                        1, 365, false, false
                    ));
                }

            } catch (Exception e) {
                log.warn("Skipping malformed RoomStay at index {}: {}", i, e.getMessage());
            }
        }

        return events;
    }

    /**
     * Parse la reponse XML OTA_ResRetrieveRS pour extraire les reservations.
     *
     * Format attendu :
     * <OTA_ResRetrieveRS>
     *   <ReservationsList>
     *     <HotelReservation ResStatus="Commit|Cancel|Modify">
     *       <UniqueID Type="14" ID="123456789"/>
     *       <RoomStays>
     *         <RoomStay>
     *           <TimeSpan Start="2025-01-15" End="2025-01-18"/>
     *           <RoomTypes><RoomType RoomTypeCode="..."/></RoomTypes>
     *           <Total AmountAfterTax="..." CurrencyCode="..."/>
     *         </RoomStay>
     *       </RoomStays>
     *       <ResGuests>
     *         <ResGuest>
     *           <Profiles>
     *             <ProfileInfo>
     *               <Profile>
     *                 <Customer>
     *                   <PersonName>
     *                     <GivenName>John</GivenName>
     *                     <Surname>Doe</Surname>
     *                   </PersonName>
     *                   <Email>john@example.com</Email>
     *                   <Telephone PhoneNumber="..."/>
     *                 </Customer>
     *               </Profile>
     *             </ProfileInfo>
     *           </Profiles>
     *         </ResGuest>
     *       </ResGuests>
     *       <ResGlobalInfo>
     *         <GuestCounts><GuestCount Count="2"/></GuestCounts>
     *         <SpecialRequests><SpecialRequest><Text>...</Text></SpecialRequest></SpecialRequests>
     *       </ResGlobalInfo>
     *     </HotelReservation>
     *   </ReservationsList>
     * </OTA_ResRetrieveRS>
     */
    private List<BookingReservationDto> parseReservationResponse(String response, String hotelId) {
        if (response == null || response.isEmpty()) {
            log.warn("Reponse reservations vide pour hotel {}", hotelId);
            return List.of();
        }

        List<BookingReservationDto> reservations = new ArrayList<>();

        try {
            Document doc = parseXmlDocument(response);
            if (doc == null) return List.of();

            if (hasOtaError(doc)) {
                log.error("Booking.com API returned error for reservation request (hotel={})", hotelId);
                return List.of();
            }

            NodeList hotelReservations = doc.getElementsByTagNameNS("*", "HotelReservation");
            for (int i = 0; i < hotelReservations.getLength(); i++) {
                Element resEl = (Element) hotelReservations.item(i);

                try {
                    BookingReservationDto reservation = parseHotelReservation(resEl, hotelId);
                    if (reservation != null) {
                        reservations.add(reservation);
                    }
                } catch (Exception e) {
                    log.warn("Skipping malformed reservation at index {}: {}", i, e.getMessage());
                }
            }

            log.info("Parsed {} reservations for hotel {}", reservations.size(), hotelId);

        } catch (Exception e) {
            log.error("Erreur parsing reservations Booking.com pour hotel {}: {}", hotelId, e.getMessage());
        }

        return reservations;
    }

    private BookingReservationDto parseHotelReservation(Element resEl, String hotelId) {
        // Reservation ID from UniqueID element
        String reservationId = "";
        NodeList uniqueIds = resEl.getElementsByTagNameNS("*", "UniqueID");
        for (int i = 0; i < uniqueIds.getLength(); i++) {
            Element uid = (Element) uniqueIds.item(i);
            String type = uid.getAttribute("Type");
            // Type 14 = confirmation number in OTA spec
            if ("14".equals(type) || type.isEmpty()) {
                reservationId = uid.getAttribute("ID");
                break;
            }
        }
        if (reservationId.isEmpty() && uniqueIds.getLength() > 0) {
            reservationId = ((Element) uniqueIds.item(0)).getAttribute("ID");
        }

        // Status
        String resStatus = resEl.getAttribute("ResStatus");
        String status = mapReservationStatus(resStatus);

        // Room stay: dates, room, price
        String roomId = "";
        LocalDate checkIn = null;
        LocalDate checkOut = null;
        BigDecimal totalPrice = BigDecimal.ZERO;
        String currency = "EUR";

        NodeList roomStays = resEl.getElementsByTagNameNS("*", "RoomStay");
        if (roomStays.getLength() > 0) {
            Element roomStay = (Element) roomStays.item(0);

            // TimeSpan
            NodeList timeSpans = roomStay.getElementsByTagNameNS("*", "TimeSpan");
            if (timeSpans.getLength() > 0) {
                Element ts = (Element) timeSpans.item(0);
                String start = ts.getAttribute("Start");
                String end = ts.getAttribute("End");
                if (!start.isEmpty()) checkIn = LocalDate.parse(start, OTA_DATE_FORMAT);
                if (!end.isEmpty()) checkOut = LocalDate.parse(end, OTA_DATE_FORMAT);
            }

            // Room type
            NodeList roomTypes = roomStay.getElementsByTagNameNS("*", "RoomType");
            if (roomTypes.getLength() > 0) {
                roomId = ((Element) roomTypes.item(0)).getAttribute("RoomTypeCode");
            }

            // Total price
            NodeList totals = roomStay.getElementsByTagNameNS("*", "Total");
            if (totals.getLength() > 0) {
                Element total = (Element) totals.item(0);
                String amount = total.getAttribute("AmountAfterTax");
                if (amount.isEmpty()) amount = total.getAttribute("AmountBeforeTax");
                if (!amount.isEmpty()) totalPrice = new BigDecimal(amount);
                String curr = total.getAttribute("CurrencyCode");
                if (!curr.isEmpty()) currency = curr;
            }
        }

        if (checkIn == null || checkOut == null) {
            log.warn("Reservation {} missing check-in/check-out dates, skipping", reservationId);
            return null;
        }

        // Guest info
        String guestName = "";
        String guestEmail = "";
        String guestPhone = "";
        String bookerCountry = "";

        NodeList customers = resEl.getElementsByTagNameNS("*", "Customer");
        if (customers.getLength() > 0) {
            Element customer = (Element) customers.item(0);

            // Name
            NodeList givenNames = customer.getElementsByTagNameNS("*", "GivenName");
            NodeList surnames = customer.getElementsByTagNameNS("*", "Surname");
            String firstName = givenNames.getLength() > 0 ? givenNames.item(0).getTextContent().trim() : "";
            String lastName = surnames.getLength() > 0 ? surnames.item(0).getTextContent().trim() : "";
            guestName = (firstName + " " + lastName).trim();

            // Email
            NodeList emails = customer.getElementsByTagNameNS("*", "Email");
            if (emails.getLength() > 0) {
                guestEmail = emails.item(0).getTextContent().trim();
            }

            // Phone
            NodeList phones = customer.getElementsByTagNameNS("*", "Telephone");
            if (phones.getLength() > 0) {
                guestPhone = ((Element) phones.item(0)).getAttribute("PhoneNumber");
            }

            // Country
            NodeList addresses = customer.getElementsByTagNameNS("*", "Address");
            if (addresses.getLength() > 0) {
                NodeList countries = ((Element) addresses.item(0)).getElementsByTagNameNS("*", "CountryName");
                if (countries.getLength() > 0) {
                    bookerCountry = ((Element) countries.item(0)).getAttribute("Code");
                    if (bookerCountry.isEmpty()) {
                        bookerCountry = countries.item(0).getTextContent().trim();
                    }
                }
            }
        }

        // Guest count
        int numberOfGuests = 1;
        NodeList guestCounts = resEl.getElementsByTagNameNS("*", "GuestCount");
        if (guestCounts.getLength() > 0) {
            String count = ((Element) guestCounts.item(0)).getAttribute("Count");
            if (!count.isEmpty()) {
                try { numberOfGuests = Integer.parseInt(count); } catch (NumberFormatException ignored) {}
            }
        }

        // Special requests
        String specialRequests = "";
        NodeList specialRequestTexts = resEl.getElementsByTagNameNS("*", "SpecialRequest");
        if (specialRequestTexts.getLength() > 0) {
            NodeList texts = ((Element) specialRequestTexts.item(0)).getElementsByTagNameNS("*", "Text");
            if (texts.getLength() > 0) {
                specialRequests = texts.item(0).getTextContent().trim();
            }
        }

        // Created at
        String createdAt = resEl.getAttribute("CreateDateTime");
        if (createdAt.isEmpty()) createdAt = resEl.getAttribute("LastModifyDateTime");

        return new BookingReservationDto(
            reservationId, hotelId, roomId,
            guestName, guestEmail, guestPhone,
            checkIn, checkOut, status,
            totalPrice, currency, numberOfGuests,
            specialRequests, reservationId, bookerCountry, createdAt
        );
    }

    // ================================================================
    // XML Helpers
    // ================================================================

    private Document parseXmlDocument(String xml) {
        try {
            DocumentBuilder builder = xmlFactory.newDocumentBuilder();
            return builder.parse(new InputSource(new StringReader(xml)));
        } catch (Exception e) {
            log.error("Failed to parse XML response: {}", e.getMessage());
            return null;
        }
    }

    private boolean hasOtaError(Document doc) {
        NodeList errors = doc.getElementsByTagNameNS("*", "Error");
        if (errors.getLength() > 0) {
            Element error = (Element) errors.item(0);
            String code = error.getAttribute("Code");
            String shortText = error.getAttribute("ShortText");
            String text = error.getTextContent().trim();
            log.error("OTA Error: code={}, shortText={}, text={}", code, shortText, text);
            return true;
        }
        return false;
    }

    private String mapReservationStatus(String otaStatus) {
        if (otaStatus == null || otaStatus.isEmpty()) return "CONFIRMED";
        return switch (otaStatus.toLowerCase()) {
            case "commit", "book" -> "CONFIRMED";
            case "cancel" -> "CANCELLED";
            case "modify" -> "MODIFIED";
            case "pending" -> "PENDING";
            default -> otaStatus.toUpperCase();
        };
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
