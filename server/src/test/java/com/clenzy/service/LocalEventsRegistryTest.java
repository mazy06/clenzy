package com.clenzy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class LocalEventsRegistryTest {

    private ObjectMapper om;

    @BeforeEach
    void setUp() {
        om = new ObjectMapper().registerModule(new JavaTimeModule());
    }

    private LocalEventsRegistry registryWith(String json) {
        Resource resource = new ByteArrayResource(json.getBytes(StandardCharsets.UTF_8)) {
            @Override
            public String getFilename() { return "test_events.json"; }
        };
        LocalEventsRegistry r = new LocalEventsRegistry(om, resource, java.util.Optional.empty());
        r.loadDataset();
        return r;
    }

    @Test
    void loadDataset_parsesAllEvents() {
        LocalEventsRegistry r = registryWith("""
                {
                  "events": [
                    {"id":"a","title":"E1","type":"FESTIVAL","city":"Paris","country":"FR","date":"2026-06-21","description":"X"},
                    {"id":"b","title":"E2","type":"SPORT","city":"Lyon","country":"FR","date":"2026-07-14","description":"Y"}
                  ]
                }
                """);
        assertEquals(2, r.size());
    }

    @Test
    void findByCityAndDateRange_filtersByCityCaseInsensitive() {
        LocalEventsRegistry r = registryWith("""
                {
                  "events": [
                    {"id":"a","title":"E1","type":"FESTIVAL","city":"Paris","date":"2026-06-21","country":"FR"},
                    {"id":"b","title":"E2","type":"FESTIVAL","city":"Lyon","date":"2026-06-21","country":"FR"}
                  ]
                }
                """);

        List<LocalEventsRegistry.LocalEvent> matches = r.findByCityAndDateRange(
                "paris", LocalDate.parse("2026-01-01"), LocalDate.parse("2026-12-31"));
        assertEquals(1, matches.size());
        assertEquals("E1", matches.get(0).title);
    }

    @Test
    void wildcardCity_matchesAnyCity() {
        LocalEventsRegistry r = registryWith("""
                {
                  "events": [
                    {"id":"h","title":"Holiday","type":"PUBLIC_HOLIDAY","city":"*","date":"2026-07-14","country":"FR"},
                    {"id":"l","title":"Local","type":"FESTIVAL","city":"Paris","date":"2026-07-14","country":"FR"}
                  ]
                }
                """);

        // Filtre par Lyon : doit recuperer Holiday (wildcard) mais pas Local (Paris only)
        List<LocalEventsRegistry.LocalEvent> matches = r.findByCityAndDateRange(
                "Lyon", LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"));
        assertEquals(1, matches.size());
        assertEquals("Holiday", matches.get(0).title);
    }

    @Test
    void findByCityAndDateRange_filtersDateRange_inclusive() {
        LocalEventsRegistry r = registryWith("""
                {
                  "events": [
                    {"id":"a","title":"E1","city":"Paris","date":"2026-05-01","type":"FESTIVAL"},
                    {"id":"b","title":"E2","city":"Paris","date":"2026-05-15","type":"FESTIVAL"},
                    {"id":"c","title":"E3","city":"Paris","date":"2026-06-01","type":"FESTIVAL"}
                  ]
                }
                """);

        List<LocalEventsRegistry.LocalEvent> matches = r.findByCityAndDateRange(
                "Paris", LocalDate.parse("2026-05-01"), LocalDate.parse("2026-05-15"));
        // Bornes inclusives
        assertEquals(2, matches.size());
        assertEquals("E1", matches.get(0).title);
        assertEquals("E2", matches.get(1).title);
    }

    @Test
    void sortsByDateAscending() {
        LocalEventsRegistry r = registryWith("""
                {
                  "events": [
                    {"id":"late","title":"Late","city":"Paris","date":"2026-12-31","type":"FESTIVAL"},
                    {"id":"early","title":"Early","city":"Paris","date":"2026-01-01","type":"FESTIVAL"},
                    {"id":"mid","title":"Mid","city":"Paris","date":"2026-06-15","type":"FESTIVAL"}
                  ]
                }
                """);

        List<LocalEventsRegistry.LocalEvent> matches = r.findByCityAndDateRange(
                "Paris", null, null);
        assertEquals(3, matches.size());
        assertEquals("Early", matches.get(0).title);
        assertEquals("Mid", matches.get(1).title);
        assertEquals("Late", matches.get(2).title);
    }

    @Test
    void invalidJson_leavesRegistryEmpty() {
        LocalEventsRegistry r = registryWith("{ this isn't json");
        assertEquals(0, r.size());
        assertTrue(r.findByCityAndDateRange("Paris", null, null).isEmpty());
    }

    @Test
    void missingResource_leavesRegistryEmpty() {
        Resource missing = new ByteArrayResource(new byte[0]) {
            @Override public boolean exists() { return false; }
            @Override public String getFilename() { return "missing.json"; }
        };
        LocalEventsRegistry r = new LocalEventsRegistry(om, missing, java.util.Optional.empty());
        r.loadDataset();
        assertEquals(0, r.size());
    }

    @Test
    void productionDataset_loadsSuccessfully() {
        // Sanity check : le dataset reel doit se parser (regression sur formats JSON)
        LocalEventsRegistry r = new LocalEventsRegistry(om,
                new org.springframework.core.io.ClassPathResource("data/local_events.json"),
                java.util.Optional.empty());
        r.loadDataset();
        assertTrue(r.size() > 0, "Le dataset prod doit avoir au moins un evenement");
    }

    @Test
    void countryProvided_aggregatesPublicHolidaysFromClient() {
        com.clenzy.integration.holidays.PublicHolidaysClient phc =
                org.mockito.Mockito.mock(com.clenzy.integration.holidays.PublicHolidaysClient.class);
        org.mockito.Mockito.when(phc.findInRange(org.mockito.ArgumentMatchers.eq("FR"),
                        org.mockito.ArgumentMatchers.any(LocalDate.class),
                        org.mockito.ArgumentMatchers.any(LocalDate.class)))
                .thenReturn(List.of(
                        new com.clenzy.integration.holidays.PublicHolidaysClient.PublicHoliday(
                                LocalDate.parse("2026-07-14"), "Fete Nationale", "Bastille Day", "FR")
                ));

        Resource resource = new ByteArrayResource("""
                {"events":[
                    {"id":"a","title":"Festival","city":"Paris","date":"2026-07-10","type":"FESTIVAL"}
                ]}""".getBytes(StandardCharsets.UTF_8)) {
            @Override public String getFilename() { return "test_events.json"; }
        };
        LocalEventsRegistry r = new LocalEventsRegistry(om, resource, java.util.Optional.of(phc));
        r.loadDataset();

        List<LocalEventsRegistry.LocalEvent> matches = r.findByCityAndDateRange(
                "Paris", "FR", LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"));

        // 1 YAML (Festival Paris) + 1 holiday (wildcard city match Paris)
        assertEquals(2, matches.size());
        assertEquals("Festival", matches.get(0).title);     // 10 juillet
        assertEquals("Fete Nationale", matches.get(1).title); // 14 juillet
        assertEquals("public_holiday", matches.get(1).type);
    }

    @Test
    void duplicateHoliday_dedupedAgainstYamlDataset() {
        com.clenzy.integration.holidays.PublicHolidaysClient phc =
                org.mockito.Mockito.mock(com.clenzy.integration.holidays.PublicHolidaysClient.class);
        org.mockito.Mockito.when(phc.findInRange(org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any(LocalDate.class),
                        org.mockito.ArgumentMatchers.any(LocalDate.class)))
                .thenReturn(List.of(
                        new com.clenzy.integration.holidays.PublicHolidaysClient.PublicHoliday(
                                LocalDate.parse("2026-07-14"), "Fete Nationale", "Bastille Day", "FR")
                ));

        Resource resource = new ByteArrayResource("""
                {"events":[
                    {"id":"yaml-fr","title":"Fete Nat (YAML)","city":"*","date":"2026-07-14","type":"public_holiday"}
                ]}""".getBytes(StandardCharsets.UTF_8)) {
            @Override public String getFilename() { return "test_events.json"; }
        };
        LocalEventsRegistry r = new LocalEventsRegistry(om, resource, java.util.Optional.of(phc));
        r.loadDataset();

        List<LocalEventsRegistry.LocalEvent> matches = r.findByCityAndDateRange(
                "Paris", "FR", LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"));

        // Le YAML "public_holiday" du 14 juillet doit empecher la re-insertion API
        assertEquals(1, matches.size());
        assertEquals("Fete Nat (YAML)", matches.get(0).title);
    }

    @Test
    void noCountryParam_doesNotCallHolidaysClient() {
        com.clenzy.integration.holidays.PublicHolidaysClient phc =
                org.mockito.Mockito.mock(com.clenzy.integration.holidays.PublicHolidaysClient.class);
        Resource resource = new ByteArrayResource("""
                {"events":[
                    {"id":"a","title":"E","city":"Paris","date":"2026-07-14","type":"FESTIVAL"}
                ]}""".getBytes(StandardCharsets.UTF_8)) {
            @Override public String getFilename() { return "test_events.json"; }
        };
        LocalEventsRegistry r = new LocalEventsRegistry(om, resource, java.util.Optional.of(phc));
        r.loadDataset();

        r.findByCityAndDateRange("Paris", LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"));

        org.mockito.Mockito.verify(phc, org.mockito.Mockito.never())
                .findInRange(org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any());
    }
}
