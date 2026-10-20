package com.clenzy.service;

import com.clenzy.marketplace.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyCrmImportedOsmSearchTest {
    JdbcTemplate db=mock(JdbcTemplate.class);
    BaitlyCrmAccess access=mock(BaitlyCrmAccess.class);
    BaitlyProfessionalDataClient client=mock(BaitlyProfessionalDataClient.class);
    BaitlyCrmOsmMatching matching=mock(BaitlyCrmOsmMatching.class);
    ObjectMapper mapper=new ObjectMapper();
    BaitlyCrmImportedOsmSearch service=new BaitlyCrmImportedOsmSearch(db,access,client,matching,mapper);
    Map<String,Object> row;
    @BeforeEach void setup()throws Exception{
        row=new HashMap<>(Map.of("siret","12345678900011","name","Atlas","city","Nantes","contact_type","PROVIDER","contact_nature","PROFESSIONAL"));
        row.put("snapshot","""
            {"siret":"12345678900011","name":"Atlas","city":"Nantes","address":"Nantes","postalCode":"44000","activity":"81.21Z","latitude":47.2,"longitude":-1.5}
            """);
        when(access.require("actor")).thenReturn(10L);when(db.queryForList(anyString(),eq(10L),eq(7L))).thenReturn(List.of(row));
        when(client.match(any())).thenReturn(mapper.readTree("""
            {"elements":[{"type":"node","id":42,"lat":47.2,"lon":-1.5,"tags":{"name":"Atlas","ref:FR:SIRET":"12345678900011","addr:postcode":"44000"}}]}
            """));
    }
    @Test void proposesFromSireneWithoutSavingAnyLocation(){
        service.search("actor",7);
        verify(matching).proposeImported(eq("actor"),eq(7L),eq("Atlas"),eq("Nantes"),argThat(list->list.size()==1&&list.getFirst().osmId()==42&&list.getFirst().signals().contains("SIRET")));
        verify(client).match(argThat(b->b.siret().equals("12345678900011")));
        verify(db,never()).update(anyString(),any(Object[].class));
    }
    @Test void supportsTheSnapshotOfAReferencedDirectoryProfessional(){
        row.put("snapshot","{\"identity\":{\"business\":"+row.get("snapshot")+"}}");service.search("actor",7);
        verify(client).match(any());verify(matching).proposeImported(anyString(),eq(7L),anyString(),anyString(),anyList());
    }
    @Test void reusesTheExistingPublicOsmMatchWithoutAnExternalRequest(){
        row.put("snapshot",row.get("snapshot").toString().replace("47.2","null"));
        when(db.queryForList(anyString(),eq("12345678900011"))).thenReturn(List.of(Map.of("osm_key","node/42","name","Atlas","label","Nantes","latitude",47.2,"longitude",-1.5)));
        service.search("actor",7);verifyNoInteractions(client);
        verify(matching).proposeImported(eq("actor"),eq(7L),eq("Atlas"),eq("Nantes"),argThat(list->list.getFirst().osmId()==42));
    }
    @Test void cannotSearchAnotherOrganizationOrAnArchivedContact(){
        when(db.queryForList(anyString(),eq(10L),eq(7L))).thenReturn(List.of());
        assertThatThrownBy(()->service.search("actor",7)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(client,matching);
    }
    @Test void rejectsPrivateOrChangedContactsBeforeExternalLookup(){
        row.put("contact_nature","PRIVATE");assertThatThrownBy(()->service.search("actor",7)).isInstanceOf(ResponseStatusException.class);
        row.put("contact_nature","PROFESSIONAL");row.put("city","Paris");assertThatThrownBy(()->service.search("actor",7)).hasMessageContaining("changé");
        verifyNoInteractions(client,matching);
    }
    @Test void missingCoordinatesAndSuppressedReferencesDoNotTriggerLookup(){
        var original=row.get("snapshot");row.put("snapshot",original.toString().replace("47.2","null"));
        assertThatThrownBy(()->service.search("actor",7)).hasMessageContaining("Coordonnées");
        row.put("snapshot",original);when(db.queryForObject(anyString(),eq(Boolean.class),eq("12345678900011"))).thenReturn(true);
        assertThatThrownBy(()->service.search("actor",7)).hasMessageContaining("retirée");verifyNoInteractions(client,matching);
    }
    @Test void exactSiretWorksWithoutSireneCoordinatesAndWithoutAnOsmName() throws Exception {
        row.put("snapshot",row.get("snapshot").toString().replace("47.2","null"));
        when(client.matchExactSiret("12345678900011")).thenReturn(mapper.readTree("{\"elements\":[{\"type\":\"node\",\"id\":42,\"lat\":47.2,\"lon\":-1.5,\"tags\":{\"ref:FR:SIRET\":\"12345678900011\"}}]}"));
        var exact=service.exact("actor",7);assertThat(exact.place().key()).isEqualTo("node/42");assertThat(exact.place().name()).isEqualTo("Atlas");verifyNoInteractions(matching);
    }
    @Test void multipleExactObjectsRemainAmbiguousEvenWhenOneHasInvalidCoordinates() throws Exception {
        when(client.matchExactSiret("12345678900011")).thenReturn(mapper.readTree("{\"elements\":[{\"type\":\"node\",\"id\":42,\"lat\":47.2,\"lon\":-1.5,\"tags\":{\"ref:FR:SIRET\":\"12345678900011\"}},{\"type\":\"way\",\"id\":43,\"tags\":{\"ref:FR:SIRET\":\"12345678900011\"}}]}"));
        assertThat(service.exact("actor",7).place()).isNull();
    }
    @Test void aMatchingNameOrACatalogueSiretDoesNotCountAsAnExactOsmTag() throws Exception {
        when(client.matchExactSiret("12345678900011")).thenReturn(mapper.readTree("{\"elements\":[{\"type\":\"node\",\"id\":42,\"lat\":47.2,\"lon\":-1.5,\"tags\":{\"name\":\"Atlas\"}}]}"));
        assertThat(service.exact("actor",7).place()).isNull();
    }
    @Test void incompleteResultsCannotBeAutomaticallyConfirmed() throws Exception {
        when(client.matchExactSiret("12345678900011")).thenReturn(mapper.readTree("{\"elements\":[],\"remark\":\"runtime timeout\"}"));
        assertThatThrownBy(()->service.exact("actor",7)).isInstanceOf(ResponseStatusException.class);
    }

}
