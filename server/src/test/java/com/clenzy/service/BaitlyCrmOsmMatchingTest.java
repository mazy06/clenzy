package com.clenzy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.data.redis.core.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.time.Duration;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BaitlyCrmOsmMatchingTest {
    JdbcTemplate db;BaitlyCrmAccess access;BaitlyCrmLocations locations;StringRedisTemplate redis;
    ValueOperations<String,String> values;ObjectMapper mapper=new ObjectMapper();BaitlyCrmOsmMatching service;
    Map<String,Object> contact;Map<String,String> cache;
    static final String ROWS="""
        [{"osm_type":"node","osm_id":42,"name":"Atlas Services","display_name":"Atlas Services, Rabat, Maroc","category":"office","lat":"34.02","lon":"-6.84","address":{"city":"Rabat","country_code":"ma"},"extratags":{"website":"https://www.atlas.example/"}},
         {"osm_type":"relation","osm_id":1,"name":"Rabat","display_name":"Rabat","category":"boundary","lat":"34","lon":"-6","address":{"country_code":"ma"}},
         {"osm_type":"node","osm_id":43,"name":"Atlas Services","display_name":"Atlas, France","category":"office","lat":"48","lon":"2","address":{"country_code":"fr"}}]
        """;
    @BeforeEach @SuppressWarnings("unchecked") void setup(){
        db=mock(JdbcTemplate.class);access=mock(BaitlyCrmAccess.class);locations=mock(BaitlyCrmLocations.class);redis=mock(StringRedisTemplate.class);values=mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);cache=new HashMap<>();
        when(values.get(anyString())).thenAnswer(call->{String key=call.getArgument(0);return key.contains(":cache:")?ROWS:cache.get(key);});
        doAnswer(call->{cache.put(call.getArgument(0),call.getArgument(1));return null;}).when(values).set(anyString(),anyString(),any(Duration.class));
        when(access.require("actor")).thenReturn(10L);when(access.lock("actor")).thenReturn(10L);
        contact=new HashMap<>(Map.of("name","Atlas Services","city","Rabat","website","https://atlas.example","contact_type","PROVIDER","contact_nature","PROFESSIONAL"));
        when(db.queryForList(contains("FROM prospects"),eq(10L),eq(7L))).thenAnswer(call->List.of(contact));
        when(db.queryForList(contains("updated_at::text"),eq(10L),eq(7L))).thenReturn(List.of());
        service=new BaitlyCrmOsmMatching(db,access,locations,redis,mapper,"https://invalid.example/search");
    }
    BaitlyCrmOsmMatching.Results search(){return service.search("actor",7,new BaitlyCrmOsmMatching.Search("Atlas Services","Rabat","MA",true));}
    @Test void cachedSearchReturnsBusinessSignalsWithoutWritingALocation(){
        var result=search();assertThat(result.candidates()).hasSize(1);
        assertThat(result.candidates().getFirst().signals()).containsExactly("NAME","CITY","WEBSITE");
        verifyNoInteractions(locations);verify(db,never()).update(anyString(),any(Object[].class));
    }
    @Test void importedCandidatesReuseExplicitScopedConfirmationAndRejectContactChanges(){
        var candidate=new BaitlyCrmOsmMatching.Candidate("node",42,"Atlas Services","Rabat",34,-6,List.of("SIRET"),"ADDRESS");
        var result=service.proposeImported("actor",7,"Atlas Services","Rabat",List.of(candidate));verifyNoInteractions(locations);
        service.confirm("actor",7,new BaitlyCrmOsmMatching.Confirmation(result.ticket(),0,false));
        verify(locations).save("actor",7,new BaitlyCrmLocations.Location("Rabat",34.0,-6.0,"ADDRESS"));
        contact.put("city","Paris");assertThatThrownBy(()->service.proposeImported("actor",7,"Atlas Services","Rabat",List.of(candidate))).hasMessageContaining("changé");
    }
    @Test void confirmationUsesServerCandidateAndRecordsProvenance(){
        var result=search();service.confirm("actor",7,new BaitlyCrmOsmMatching.Confirmation(result.ticket(),0,false));
        verify(locations).save("actor",7,new BaitlyCrmLocations.Location("Atlas Services, Rabat, Maroc",34.02,-6.84,"ADDRESS"));
        verify(db).update(contains("osm_confirmed_at=now()"),eq("node"),eq(42L),eq("Atlas Services, Rabat"),eq(10L),eq(7L));
    }
    @Test void privateContactsNeverTriggerExternalSearch(){
        contact.put("contact_type","OWNER");assertThatThrownBy(this::search).isInstanceOf(ResponseStatusException.class);verifyNoInteractions(redis,locations);
        contact.put("contact_type","PROVIDER");contact.put("contact_nature","PRIVATE");assertThatThrownBy(this::search).isInstanceOf(ResponseStatusException.class);
    }
    @Test void crossOrganizationAndActorTicketsAreRejected(){
        var result=search();when(access.lock("actor")).thenReturn(20L);
        when(db.queryForList(contains("FROM prospects"),eq(20L),eq(7L))).thenReturn(List.of(contact));
        assertThatThrownBy(()->service.confirm("actor",7,new BaitlyCrmOsmMatching.Confirmation(result.ticket(),0,false))).isInstanceOf(ResponseStatusException.class);
        when(access.lock("other")).thenReturn(10L);
        assertThatThrownBy(()->service.confirm("other",7,new BaitlyCrmOsmMatching.Confirmation(result.ticket(),0,false))).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(locations);
    }
    @Test void expiredTicketOrChangedContactCannotBeConfirmed(){
        assertThatThrownBy(()->service.confirm("actor",7,new BaitlyCrmOsmMatching.Confirmation(UUID.randomUUID(),0,false))).isInstanceOf(ResponseStatusException.class);
        var result=search();contact.put("city","Casablanca");
        assertThatThrownBy(()->service.confirm("actor",7,new BaitlyCrmOsmMatching.Confirmation(result.ticket(),0,false))).isInstanceOf(ResponseStatusException.class);verifyNoInteractions(locations);
    }
    @Test void existingAndConcurrentlyChangedLocationsAreProtected(){
        when(db.queryForList(contains("updated_at::text"),eq(10L),eq(7L))).thenReturn(List.of(Map.of("version","v1")));
        var result=search();
        assertThatThrownBy(()->service.confirm("actor",7,new BaitlyCrmOsmMatching.Confirmation(result.ticket(),0,false))).isInstanceOf(ResponseStatusException.class);
        service.confirm("actor",7,new BaitlyCrmOsmMatching.Confirmation(result.ticket(),0,true));verify(locations).save(eq("actor"),eq(7L),any());clearInvocations(locations);
        when(db.queryForList(contains("updated_at::text"),eq(10L),eq(7L))).thenReturn(List.of(Map.of("version","v2")));
        assertThatThrownBy(()->service.confirm("actor",7,new BaitlyCrmOsmMatching.Confirmation(result.ticket(),0,true))).isInstanceOf(ResponseStatusException.class);verifyNoInteractions(locations);
    }
    @Test void rateLimitAndRedisOutageDoNotSendAnUncachedRequest(){
        when(values.get(anyString())).thenReturn(null);when(values.setIfAbsent(anyString(),anyString(),any(Duration.class))).thenReturn(false);
        assertThatThrownBy(this::search).isInstanceOfSatisfying(ResponseStatusException.class,e->assertThat(e.getStatusCode().value()).isEqualTo(429));
        when(values.get(anyString())).thenThrow(new IllegalStateException("redis down"));
        assertThatThrownBy(this::search).isInstanceOfSatisfying(ResponseStatusException.class,e->assertThat(e.getStatusCode().value()).isEqualTo(503));verifyNoInteractions(locations);
    }
    @Test void invalidCoordinatesAreNeverProposed() throws Exception {
        var rows=mapper.readTree(ROWS.replace("34.02","NaN"));assertThat(BaitlyCrmOsmMatching.map(rows,new BaitlyCrmOsmMatching.Search("Atlas","Rabat","MA",true),contact)).isEmpty();
    }
    @Test void privateOwnerBatchSearchUsesOnlyTheSavedCityAndConfirmsACityMarker(){
        contact.put("contact_type","OWNER");contact.put("contact_nature","PRIVATE");contact.put("name","Nom personnel confidentiel");
        when(values.get(anyString())).thenReturn("""
            [{"osm_type":"relation","osm_id":43,"name":"Rabat","display_name":"Rabat, Maroc","category":"boundary","addresstype":"city","lat":"34","lon":"-6","address":{"country_code":"ma"}}]
            """);
        var ticket=service.prepare(10,"actor",7,new BaitlyCrmOsmMatching.Search("Nom personnel confidentiel","Rabat","MA",true),true);
        assertThat(ticket.query()).isEqualTo("Rabat");assertThat(ticket.candidates()).hasSize(1);assertThat(ticket.candidates().getFirst().precision()).isEqualTo("CITY");
        service.confirmPrepared(10,"actor",7,ticket,0,false);verify(locations).save("actor",7,new BaitlyCrmLocations.Location("Rabat, Maroc",34.0,-6.0,"CITY"));
    }
    @Test void sendsOnlyBusinessCityCountryAndIdentifiesBaitly() throws Exception {
        var upstream=com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1",0),0);
        var query=new java.util.concurrent.atomic.AtomicReference<String>();var agent=new java.util.concurrent.atomic.AtomicReference<String>();
        upstream.createContext("/search",exchange->{query.set(exchange.getRequestURI().getRawQuery());agent.set(exchange.getRequestHeaders().getFirst("User-Agent"));byte[] bytes=ROWS.getBytes(java.nio.charset.StandardCharsets.UTF_8);exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();});upstream.start();
        try{
            when(values.get(anyString())).thenAnswer(call->cache.get(call.getArgument(0)));when(values.setIfAbsent(anyString(),anyString(),any(Duration.class))).thenReturn(true);
            service=new BaitlyCrmOsmMatching(db,access,locations,redis,mapper,"http://127.0.0.1:"+upstream.getAddress().getPort()+"/search");
            assertThat(search().candidates()).hasSize(1);assertThat(agent.get()).startsWith("Baitly-PMS/");
            assertThat(query.get()).contains("q=Atlas+Services%2C+Rabat","countrycodes=ma").doesNotContain("atlas.example","email","phone");
            search();verify(values,times(1)).setIfAbsent(eq("baitly:crm:osm:rate"),eq("1"),any(Duration.class));verifyNoInteractions(locations);
        }finally{upstream.stop(0);}
    }
}
