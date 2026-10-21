package com.clenzy.marketplace.service;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.*;
import org.springframework.data.redis.core.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class BaitlyProfessionalDirectoryTest {
    JdbcTemplate db=mock(JdbcTemplate.class);
    BaitlyProfessionalDataClient client=mock(BaitlyProfessionalDataClient.class);
    StringRedisTemplate redis=mock(StringRedisTemplate.class);
    @SuppressWarnings("unchecked") ValueOperations<String,String> values=mock(ValueOperations.class);
    ObjectMapper mapper=new ObjectMapper().registerModule(new JavaTimeModule());
    BaitlyProfessionalDirectory service=new BaitlyProfessionalDirectory(db,client,redis,mapper);
    UUID token=UUID.randomUUID();
    @BeforeEach void setup(){
        // The constructor inspects the datasource to configure bounded map reads.
        verify(db).getDataSource();
        clearInvocations(db);
        when(redis.opsForValue()).thenReturn(values);
    }
    @Test void expiredTicketCannotMutate(){assertThatThrownBy(()->service.confirmBusiness("actor",new BaitlyProfessionalDirectory.Choice(token,0))).isInstanceOf(ResponseStatusException.class);verifyNoInteractions(db,client);}
    @Test void otherActorCannotReplay() throws Exception {
        var ticket=new BaitlyProfessionalDirectory.Ticket("other","SIRENE",null,null,Instant.now(),List.of(),List.of());when(values.get(anyString())).thenReturn(mapper.writeValueAsString(ticket));
        assertThatThrownBy(()->service.confirmBusiness("actor",new BaitlyProfessionalDirectory.Choice(token,0))).isInstanceOf(ResponseStatusException.class);verifyNoInteractions(db,client);
    }
    @Test void osmTicketCannotCreateBusiness() throws Exception {
        var ticket=new BaitlyProfessionalDirectory.Ticket("actor","OSM",1L,null,Instant.now(),List.of(),List.of());when(values.get(anyString())).thenReturn(mapper.writeValueAsString(ticket));
        assertThatThrownBy(()->service.confirmBusiness("actor",new BaitlyProfessionalDirectory.Choice(token,0))).isInstanceOf(ResponseStatusException.class);verifyNoInteractions(db,client);
    }
    @Test void indexMustBelongToServerCandidates() throws Exception {
        var ticket=new BaitlyProfessionalDirectory.Ticket("actor","SIRENE",null,null,Instant.now(),List.of(),List.of());when(values.get(anyString())).thenReturn(mapper.writeValueAsString(ticket));
        assertThatThrownBy(()->service.confirmBusiness("actor",new BaitlyProfessionalDirectory.Choice(token,5))).isInstanceOf(IllegalArgumentException.class);verifyNoInteractions(db,client);
    }
    @Test void cityAndActivitySearchDoesNotRequireACompanyName() throws Exception {
        when(client.search(eq(""),eq(""),eq("44109"),eq("81.21Z,81.22Z,81.29B"),eq(2))).thenReturn(mapper.readTree("{\"results\":[],\"total_pages\":3}"));
        var preview=service.search("actor",new BaitlyProfessionalDirectory.Search("","",2,"44109","CLEANING"));
        assertThat(preview.hasNext()).isTrue();assertThat(preview.candidates()).isEmpty();verifyNoInteractions(db);
    }
    @Test void invalidLaterTicketPreventsAnyBulkWrite() throws Exception {
        UUID later=UUID.randomUUID();
        var business=new BaitlyProfessionalData.Business("12345678900011","Atlas","Nantes","Nantes","44000","81.21Z",47.2,-1.5);
        var first=new BaitlyProfessionalDirectory.Ticket("actor","SIRENE",null,null,Instant.now(),List.of(business),List.of());
        when(values.get("baitly:directory:ticket:"+token)).thenReturn(mapper.writeValueAsString(first));
        assertThatThrownBy(()->service.confirmBusinesses("actor",new BaitlyProfessionalDirectory.BulkChoices(List.of(
            new BaitlyProfessionalDirectory.Choice(token,0),new BaitlyProfessionalDirectory.Choice(later,0)))))
            .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(db,client);
    }
    @Test void bulkCannotReplayAnotherActorsSelection() throws Exception {
        var ticket=new BaitlyProfessionalDirectory.Ticket("other","SIRENE",null,null,Instant.now(),List.of(),List.of());
        when(values.get(anyString())).thenReturn(mapper.writeValueAsString(ticket));
        assertThatThrownBy(()->service.confirmBusinesses("actor",new BaitlyProfessionalDirectory.BulkChoices(List.of(new BaitlyProfessionalDirectory.Choice(token,0)))))
            .isInstanceOf(ResponseStatusException.class);verifyNoInteractions(db,client);
    }
}
