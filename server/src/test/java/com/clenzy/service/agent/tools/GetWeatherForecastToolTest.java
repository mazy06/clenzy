package com.clenzy.service.agent.tools;

import com.clenzy.dto.PropertyDto;
import com.clenzy.integration.openmeteo.OpenMeteoClient;
import com.clenzy.service.PropertyService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class GetWeatherForecastToolTest {

    private OpenMeteoClient openMeteoClient;
    private PropertyService propertyService;
    private GetWeatherForecastTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        openMeteoClient = mock(OpenMeteoClient.class);
        propertyService = mock(PropertyService.class);
        om = new ObjectMapper();
        tool = new GetWeatherForecastTool(openMeteoClient, propertyService, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    @Test
    void descriptor_isReadOnly() {
        assertEquals("get_weather_forecast", tool.name());
        assertEquals("get_weather_forecast", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void city_geocodeAndForecast_buildsCleanPayload() throws Exception {
        var paris = new OpenMeteoClient.GeoCoord(48.85, 2.35, "Paris", "FR");
        when(openMeteoClient.geocode("Paris")).thenReturn(Optional.of(paris));
        when(openMeteoClient.forecast(eq(paris), eq(5))).thenReturn(Optional.of(List.of(
                new OpenMeteoClient.DailyForecast(LocalDate.parse("2026-05-26"), 22.3, 12.1, 0.0, 0),
                new OpenMeteoClient.DailyForecast(LocalDate.parse("2026-05-27"), 19.5, 11.0, 5.2, 61)
        )));

        ObjectNode args = om.createObjectNode();
        args.put("city", "Paris");
        ToolResult result = tool.execute(args, ctx);

        assertFalse(result.isError());
        assertEquals("weather", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals("Paris", payload.path("city").asText());
        assertEquals("FR", payload.path("countryCode").asText());
        assertEquals(2, payload.path("items").size());

        JsonNode day0 = payload.path("items").get(0);
        assertEquals("2026-05-26", day0.path("date").asText());
        assertEquals(22.3, day0.path("tempMax").asDouble(), 0.001);
        assertEquals(12.1, day0.path("tempMin").asDouble(), 0.001);
        assertEquals(0, day0.path("conditionCode").asInt());
        assertEquals("Ensoleille", day0.path("conditionLabel").asText());

        JsonNode day1 = payload.path("items").get(1);
        assertEquals(61, day1.path("conditionCode").asInt());
        assertEquals("Pluie", day1.path("conditionLabel").asText());
    }

    @Test
    void propertyId_resolvesCityFromProperty() throws Exception {
        PropertyDto loft = new PropertyDto();
        loft.id = 42L;
        loft.name = "Loft";
        loft.city = "Lyon";
        when(propertyService.getById(42L)).thenReturn(loft);

        var lyon = new OpenMeteoClient.GeoCoord(45.75, 4.85, "Lyon", "FR");
        when(openMeteoClient.geocode("Lyon")).thenReturn(Optional.of(lyon));
        when(openMeteoClient.forecast(eq(lyon), any(Integer.class))).thenReturn(Optional.of(List.of()));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 42);
        ToolResult result = tool.execute(args, ctx);

        assertFalse(result.isError());
        JsonNode payload = om.readTree(result.content());
        assertEquals("Lyon", payload.path("city").asText());
        verify(openMeteoClient).geocode("Lyon");
    }

    @Test
    void neither_city_nor_propertyId_throws() {
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("city")
                || ex.getMessage().toLowerCase().contains("propertyid"));
    }

    @Test
    void geocodeFailure_throwsToolException() {
        when(openMeteoClient.geocode("Atlantis")).thenReturn(Optional.empty());
        ObjectNode args = om.createObjectNode();
        args.put("city", "Atlantis");

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("geocoding"));
    }

    @Test
    void forecastFailure_throwsToolException() {
        var coord = new OpenMeteoClient.GeoCoord(48.0, 2.0, "Paris", "FR");
        when(openMeteoClient.geocode("Paris")).thenReturn(Optional.of(coord));
        when(openMeteoClient.forecast(any(), any(Integer.class))).thenReturn(Optional.empty());

        ObjectNode args = om.createObjectNode();
        args.put("city", "Paris");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("indisponible"));
    }

    @Test
    void daysArg_isClampedTo1And7() {
        var coord = new OpenMeteoClient.GeoCoord(48.0, 2.0, "Paris", "FR");
        when(openMeteoClient.geocode(any())).thenReturn(Optional.of(coord));
        when(openMeteoClient.forecast(any(), any(Integer.class))).thenReturn(Optional.of(List.of()));

        ObjectNode args = om.createObjectNode();
        args.put("city", "Paris");
        args.put("days", 99);
        tool.execute(args, ctx);
        verify(openMeteoClient).forecast(eq(coord), eq(7));

        args.put("days", -5);
        tool.execute(args, ctx);
        verify(openMeteoClient).forecast(eq(coord), eq(1));
    }

    @Test
    void labelFromCode_coversAllRanges() {
        // Spot-check : valeurs cles de la table WMO
        assertEquals("Ensoleille", GetWeatherForecastTool.labelFromCode(0));
        assertEquals("Partiellement nuageux", GetWeatherForecastTool.labelFromCode(2));
        assertEquals("Brouillard", GetWeatherForecastTool.labelFromCode(45));
        assertEquals("Pluie", GetWeatherForecastTool.labelFromCode(63));
        assertEquals("Neige", GetWeatherForecastTool.labelFromCode(75));
        assertEquals("Orage", GetWeatherForecastTool.labelFromCode(95));
        assertEquals("Indisponible", GetWeatherForecastTool.labelFromCode(null));
        assertEquals("Inconnu", GetWeatherForecastTool.labelFromCode(12345));
    }
}
