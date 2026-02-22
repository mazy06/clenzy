package com.clenzy.service;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests d'integration du CalendarEngine avec une vraie base PostgreSQL (Testcontainers).
 *
 * Verifie le comportement complet : advisory lock, upsert des CalendarDays,
 * detection de conflits, log des commandes, publication outbox.
 */
@Transactional
@Rollback
class CalendarEngineIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private CalendarEngine calendarEngine;

    @Autowired
    private CalendarDayRepository calendarDayRepository;

    @Autowired
    private CalendarCommandRepository calendarCommandRepository;

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    private Organization org;
    private User owner;
    private Property property;
    private Long orgId;

    @BeforeEach
    void createTestData() {
        org = new Organization("Test Org", OrganizationType.INDIVIDUAL, "test-org-calendar");
        organizationRepository.save(org);
        orgId = org.getId();

        owner = new User("Jean", "Dupont", "jean.dupont.cal@test.com", "password123");
        owner.setOrganizationId(orgId);
        owner.setKeycloakId("kc-cal-test-user");
        userRepository.save(owner);

        property = new Property("Appart Test", "10 rue de la Paix", 2, 1, owner);
        property.setOrganizationId(orgId);
        property.setNightlyPrice(new BigDecimal("100.00"));
        propertyRepository.save(property);

        setupTenantContext(orgId, true);
    }

    // ----------------------------------------------------------------
    // 1. book() persiste les CalendarDays en BOOKED
    // ----------------------------------------------------------------

    @Test
    void book_persistsDaysInDb() {
        LocalDate checkIn = LocalDate.of(2026, 7, 1);
        LocalDate checkOut = LocalDate.of(2026, 7, 4); // 3 nuits [1,2,3)

        List<CalendarDay> booked = calendarEngine.book(
                property.getId(), checkIn, checkOut, null, orgId, "MANUAL", "test-actor");

        assertEquals(3, booked.size());

        // Verifier via le repository (bornes incluses : 1er au 3 juillet)
        List<CalendarDay> fromDb = calendarDayRepository.findByPropertyAndDateRange(
                property.getId(), checkIn, checkOut.minusDays(1), orgId);

        assertEquals(3, fromDb.size());
        for (CalendarDay day : fromDb) {
            assertEquals(CalendarDayStatus.BOOKED, day.getStatus());
            assertEquals("MANUAL", day.getSource());
        }
    }

    // ----------------------------------------------------------------
    // 2. book() upsert des jours AVAILABLE existants en BOOKED
    // ----------------------------------------------------------------

    @Test
    void book_upsertExistingDays() {
        LocalDate checkIn = LocalDate.of(2026, 8, 1);
        LocalDate checkOut = LocalDate.of(2026, 8, 3);

        // Pre-creer des jours AVAILABLE
        CalendarDay day1 = new CalendarDay(property, LocalDate.of(2026, 8, 1), CalendarDayStatus.AVAILABLE, orgId);
        CalendarDay day2 = new CalendarDay(property, LocalDate.of(2026, 8, 2), CalendarDayStatus.AVAILABLE, orgId);
        calendarDayRepository.save(day1);
        calendarDayRepository.save(day2);
        calendarDayRepository.flush();

        // book() doit upsert les jours existants
        List<CalendarDay> booked = calendarEngine.book(
                property.getId(), checkIn, checkOut, null, orgId, "MANUAL", "test-actor");

        assertEquals(2, booked.size());
        for (CalendarDay day : booked) {
            assertEquals(CalendarDayStatus.BOOKED, day.getStatus());
        }
    }

    // ----------------------------------------------------------------
    // 3. cancel() libere les jours reserves
    // ----------------------------------------------------------------

    @Test
    void cancel_releasesBookedDays() {
        LocalDate checkIn = LocalDate.of(2026, 9, 10);
        LocalDate checkOut = LocalDate.of(2026, 9, 13); // 3 nuits

        // Sauvegarder une reservation d'abord
        Reservation reservation = new Reservation(property, "Guest Cancel", checkIn, checkOut, "confirmed", "MANUAL");
        reservation.setOrganizationId(orgId);
        reservation = reservationRepository.save(reservation);
        reservationRepository.flush();

        // Reserver avec le reservationId pour que les jours soient lies
        calendarEngine.book(property.getId(), checkIn, checkOut, reservation.getId(), orgId, "MANUAL", "test-actor");

        // Verifier que les jours sont BOOKED
        List<CalendarDay> bookedDays = calendarDayRepository.findByPropertyAndDateRange(
                property.getId(), checkIn, checkOut.minusDays(1), orgId);
        assertEquals(3, bookedDays.size());
        bookedDays.forEach(d -> assertEquals(CalendarDayStatus.BOOKED, d.getStatus()));

        // Annuler — releaseByReservation est un native UPDATE
        int released = calendarEngine.cancel(reservation.getId(), orgId, "test-actor");

        assertEquals(3, released);
    }

    // ----------------------------------------------------------------
    // 4. block() puis book() sur les memes dates → CalendarConflictException
    // ----------------------------------------------------------------

    @Test
    void block_thenBook_throwsConflict() {
        LocalDate from = LocalDate.of(2026, 10, 1);
        LocalDate to = LocalDate.of(2026, 10, 4);

        calendarEngine.block(property.getId(), from, to, orgId, "MANUAL", null, "test-actor");

        // book() sur les memes dates doit lever une exception
        CalendarConflictException ex = assertThrows(CalendarConflictException.class, () ->
                calendarEngine.book(property.getId(), from, to, null, orgId, "MANUAL", "test-actor"));

        assertEquals(property.getId(), ex.getPropertyId());
    }

    // ----------------------------------------------------------------
    // 5. book() puis block() → CalendarConflictException
    // ----------------------------------------------------------------

    @Test
    void book_thenBlock_throwsConflict() {
        LocalDate from = LocalDate.of(2026, 11, 1);
        LocalDate to = LocalDate.of(2026, 11, 4);

        calendarEngine.book(property.getId(), from, to, null, orgId, "MANUAL", "test-actor");

        // block() echoue car des jours sont BOOKED
        CalendarConflictException ex = assertThrows(CalendarConflictException.class, () ->
                calendarEngine.block(property.getId(), from, to, orgId, "MANUAL", null, "test-actor"));

        assertEquals(property.getId(), ex.getPropertyId());
    }

    // ----------------------------------------------------------------
    // 6. unblock() ne touche que les jours BLOCKED (pas les BOOKED)
    // ----------------------------------------------------------------

    @Test
    void unblock_onlyBlockedDays() {
        // Bloquer du 1 au 5 decembre [1, 5) → 4 jours
        LocalDate blockFrom = LocalDate.of(2026, 12, 1);
        LocalDate blockTo = LocalDate.of(2026, 12, 5);
        calendarEngine.block(property.getId(), blockFrom, blockTo, orgId, "MANUAL", null, "test-actor");

        // Reserver du 5 au 8 decembre [5, 8) → 3 jours, pas de chevauchement
        LocalDate bookFrom = LocalDate.of(2026, 12, 5);
        LocalDate bookTo = LocalDate.of(2026, 12, 8);
        calendarEngine.book(property.getId(), bookFrom, bookTo, null, orgId, "MANUAL", "test-actor");

        // unblock sur la plage entiere [1, 8) — seuls les BLOCKED doivent etre remis AVAILABLE
        int unblocked = calendarEngine.unblock(property.getId(), blockFrom, bookTo, orgId, "test-actor");

        assertEquals(4, unblocked); // 4 jours bloques debloques (1,2,3,4)

        // Verifier que les jours reserves sont toujours BOOKED
        List<CalendarDay> bookedDays = calendarDayRepository.findByPropertyAndDateRange(
                property.getId(), bookFrom, bookTo.minusDays(1), orgId);
        assertEquals(3, bookedDays.size());
        bookedDays.forEach(d -> assertEquals(CalendarDayStatus.BOOKED, d.getStatus()));
    }

    // ----------------------------------------------------------------
    // 7. book() cree une CalendarCommand dans la table calendar_commands
    // ----------------------------------------------------------------

    @Test
    void book_createsCalendarCommand() {
        LocalDate checkIn = LocalDate.of(2027, 1, 10);
        LocalDate checkOut = LocalDate.of(2027, 1, 13);

        calendarEngine.book(property.getId(), checkIn, checkOut, null, orgId, "MANUAL", "test-actor");

        List<CalendarCommand> commands = calendarCommandRepository
                .findByPropertyIdOrderByExecutedAtDesc(property.getId());

        assertFalse(commands.isEmpty(), "Au moins une commande attendue");
        CalendarCommand cmd = commands.get(0);
        assertEquals(CalendarCommandType.BOOK, cmd.getCommandType());
        assertEquals(property.getId(), cmd.getPropertyId());
        assertEquals(checkIn, cmd.getDateFrom());
        assertEquals(checkOut, cmd.getDateTo());
        assertEquals("EXECUTED", cmd.getStatus());
        assertEquals("test-actor", cmd.getActorId());
    }

    // ----------------------------------------------------------------
    // 8. book() cree un OutboxEvent PENDING
    // ----------------------------------------------------------------

    @Test
    void book_createsOutboxEvent() {
        LocalDate checkIn = LocalDate.of(2027, 2, 1);
        LocalDate checkOut = LocalDate.of(2027, 2, 3);

        calendarEngine.book(property.getId(), checkIn, checkOut, null, orgId, "MANUAL", "test-actor");

        List<OutboxEvent> events = outboxEventRepository.findPendingEvents();

        assertFalse(events.isEmpty(), "Au moins un event outbox attendu");

        OutboxEvent event = events.stream()
                .filter(e -> "CALENDAR_BOOKED".equals(e.getEventType()))
                .filter(e -> String.valueOf(property.getId()).equals(e.getAggregateId()))
                .findFirst()
                .orElse(null);

        assertNotNull(event, "Outbox event CALENDAR_BOOKED attendu");
        assertEquals("CALENDAR", event.getAggregateType());
        assertEquals("PENDING", event.getStatus());
        assertEquals("calendar.updates", event.getTopic());
        assertEquals(String.valueOf(property.getId()), event.getPartitionKey());
        assertEquals(orgId, event.getOrganizationId());
        assertTrue(event.getPayload().contains("\"action\":\"BOOKED\""));
    }
}
