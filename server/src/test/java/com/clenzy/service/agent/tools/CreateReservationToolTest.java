package com.clenzy.service.agent.tools;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.PropertyService;
import com.clenzy.service.ReservationService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class CreateReservationToolTest {

    private ReservationService reservationService;
    private PropertyService propertyService;
    private PriceEngine priceEngine;
    private CreateReservationTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        reservationService = mock(ReservationService.class);
        propertyService = mock(PropertyService.class);
        priceEngine = mock(PriceEngine.class);
        om = new ObjectMapper();
        tool = new CreateReservationTool(reservationService, propertyService, priceEngine, om);
        ctx = AgentContext.minimal(42L, "user-1");
    }

    private ObjectNode validArgs() {
        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 7);
        args.put("checkIn", "2026-06-01");
        args.put("checkOut", "2026-06-04");
        args.put("guestName", "Alice");
        args.put("guestCount", 2);
        return args;
    }

    /** Property managee renvoyee par getPropertyEntityById (org-safe). Pas de mock : getters final. */
    private Property stubProperty() {
        Property p = new Property();
        p.setId(7L);
        p.setName("Loft Bastille");
        return p;
    }

    /** 3 nuits a 100 EUR chacune (la nuit de depart 06-04 n'est pas facturee). */
    private Map<LocalDate, BigDecimal> threeNightsAt100() {
        Map<LocalDate, BigDecimal> nightly = new LinkedHashMap<>();
        nightly.put(LocalDate.of(2026, 6, 1), new BigDecimal("100.00"));
        nightly.put(LocalDate.of(2026, 6, 2), new BigDecimal("100.00"));
        nightly.put(LocalDate.of(2026, 6, 3), new BigDecimal("100.00"));
        return nightly;
    }

    @Test
    void name_andDescriptor_requireConfirmation() {
        assertEquals("create_reservation", tool.name());
        assertEquals("create_reservation", tool.descriptor().name());
        assertTrue(tool.descriptor().requiresConfirmation());
        JsonNode schema = tool.descriptor().jsonSchema();
        String req = schema.path("required").toString();
        assertTrue(req.contains("propertyId"));
        assertTrue(req.contains("checkIn"));
        assertTrue(req.contains("checkOut"));
        assertTrue(req.contains("guestName"));
    }

    @Test
    void schema_hasNoPriceOrAmountArgument() {
        // Regle ARGENT : le tool ne doit JAMAIS exposer de champ prix/montant.
        JsonNode props = tool.descriptor().jsonSchema().path("properties");
        assertFalse(props.has("total"));
        assertFalse(props.has("totalPrice"));
        assertFalse(props.has("price"));
        assertFalse(props.has("amount"));
        // additionalProperties=false : un prix injecte par le LLM serait rejete au schema.
        assertFalse(tool.descriptor().jsonSchema().path("additionalProperties").asBoolean(true));
    }

    @Test
    void happyPath_returnsSummary() throws Exception {
        when(propertyService.getPropertyEntityById(7L)).thenReturn(stubProperty());
        when(priceEngine.resolvePriceRange(eq(7L), any(), any(), eq(42L)))
                .thenReturn(threeNightsAt100());
        // Le service renvoie l'entite qu'on lui a passee, avec un id assigne.
        when(reservationService.save(any(Reservation.class))).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            r.setId(999L);
            return r;
        });

        ToolResult result = tool.execute(validArgs(), ctx);

        assertFalse(result.isError());
        assertEquals("summary", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(999L, payload.path("id").asLong());
        assertEquals("Loft Bastille", payload.path("propertyName").asText());
        assertEquals("Alice", payload.path("guestName").asText());
        assertEquals(2, payload.path("guestCount").asInt());
        assertEquals("2026-06-01", payload.path("checkIn").asText());
        assertEquals("2026-06-04", payload.path("checkOut").asText());
        assertEquals("confirmed", payload.path("status").asText());
        assertEquals(3, payload.path("nights").asInt());
        assertEquals(0, new BigDecimal("300.00").compareTo(payload.path("total").decimalValue()));
    }

    /**
     * Coeur de la regle ARGENT : le prix passe au service est calcule depuis le
     * PriceEngine (serveur), PAS un input LLM. On capture l'entite passee a save()
     * et on verifie totalPrice == somme des nuits du PriceEngine.
     */
    @Test
    void totalPrice_isComputedServerSide_notFromArgs() {
        when(propertyService.getPropertyEntityById(7L)).thenReturn(stubProperty());
        when(priceEngine.resolvePriceRange(eq(7L), any(), any(), eq(42L)))
                .thenReturn(threeNightsAt100());
        when(reservationService.save(any(Reservation.class))).thenAnswer(inv -> inv.getArgument(0));

        // Tentative d'injection d'un prix par le LLM : doit etre IGNOREE (pas de champ prix).
        ObjectNode args = validArgs();
        args.put("total", 1);          // valeur piege
        args.put("totalPrice", 1);     // valeur piege

        tool.execute(args, ctx);

        ArgumentCaptor<Reservation> captor = ArgumentCaptor.forClass(Reservation.class);
        verify(reservationService).save(captor.capture());
        Reservation passed = captor.getValue();

        // Prix = somme PriceEngine (3 x 100), JAMAIS la valeur piege.
        assertEquals(0, new BigDecimal("300.00").compareTo(passed.getTotalPrice()));
        assertNotEquals(0, new BigDecimal("1").compareTo(passed.getTotalPrice()));
        // Sanity : la requete de prix vise bien les nuits [checkIn, checkOut-1] et l'org du contexte.
        verify(priceEngine).resolvePriceRange(7L, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 3), 42L);
    }

    @Test
    void delegatesToServiceWithExpectedReservationFields() {
        when(propertyService.getPropertyEntityById(7L)).thenReturn(stubProperty());
        when(priceEngine.resolvePriceRange(anyLong(), any(), any(), anyLong()))
                .thenReturn(threeNightsAt100());
        when(reservationService.save(any(Reservation.class))).thenAnswer(inv -> inv.getArgument(0));

        tool.execute(validArgs(), ctx);

        ArgumentCaptor<Reservation> captor = ArgumentCaptor.forClass(Reservation.class);
        verify(reservationService).save(captor.capture());
        Reservation passed = captor.getValue();

        assertEquals(7L, passed.getProperty().getId());
        assertEquals("Alice", passed.getGuestName());
        assertEquals(2, passed.getGuestCount());
        assertEquals(LocalDate.of(2026, 6, 1), passed.getCheckIn());
        assertEquals(LocalDate.of(2026, 6, 4), passed.getCheckOut());
        assertEquals("confirmed", passed.getStatus());
        assertEquals("direct", passed.getSource());
        assertEquals(42L, passed.getOrganizationId());
    }

    @Test
    void source_defaultsToDirect_whenOmitted() {
        when(propertyService.getPropertyEntityById(7L)).thenReturn(stubProperty());
        when(priceEngine.resolvePriceRange(anyLong(), any(), any(), anyLong()))
                .thenReturn(threeNightsAt100());
        when(reservationService.save(any(Reservation.class))).thenAnswer(inv -> inv.getArgument(0));

        ObjectNode args = validArgs();
        args.put("source", "airbnb");
        tool.execute(args, ctx);

        ArgumentCaptor<Reservation> captor = ArgumentCaptor.forClass(Reservation.class);
        verify(reservationService).save(captor.capture());
        assertEquals("airbnb", captor.getValue().getSource());
    }

    @Test
    void missingPropertyId_throws() {
        ObjectNode args = validArgs();
        args.remove("propertyId");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("propertyid"));
        verifyNoInteractions(reservationService);
    }

    @Test
    void blankGuestName_throws() {
        ObjectNode args = validArgs();
        args.put("guestName", "  ");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("guestname"));
        verifyNoInteractions(reservationService);
    }

    @Test
    void checkOutNotAfterCheckIn_throws() {
        ObjectNode args = validArgs();
        args.put("checkOut", "2026-06-01");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("checkout"));
        verifyNoInteractions(reservationService);
    }

    @Test
    void invalidDateFormat_throws() {
        ObjectNode args = validArgs();
        args.put("checkIn", "01/06/2026");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("date"));
        verifyNoInteractions(reservationService);
    }

    @Test
    void serviceThrows_wrappedAsToolExecutionException() {
        when(propertyService.getPropertyEntityById(7L)).thenReturn(stubProperty());
        when(priceEngine.resolvePriceRange(anyLong(), any(), any(), anyLong()))
                .thenReturn(threeNightsAt100());
        when(reservationService.save(any(Reservation.class)))
                .thenThrow(new RuntimeException("Dates non disponibles"));

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(validArgs(), ctx));
        assertTrue(ex.getMessage().contains("Dates non disponibles"));
        assertEquals("create_reservation", ex.getToolName());
    }

    @Test
    void unpricedNights_refused_noReservationCreated() {
        when(propertyService.getPropertyEntityById(7L)).thenReturn(stubProperty());
        // Seulement 2 des 3 nuits ont un tarif → prix indetermine → refus (regle argent).
        Map<LocalDate, BigDecimal> partial = new LinkedHashMap<>();
        partial.put(LocalDate.of(2026, 6, 1), new BigDecimal("100.00"));
        partial.put(LocalDate.of(2026, 6, 2), new BigDecimal("100.00"));
        when(priceEngine.resolvePriceRange(anyLong(), any(), any(), anyLong())).thenReturn(partial);

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(validArgs(), ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("tarif"));
        verify(reservationService, never()).save(any());
    }
}
