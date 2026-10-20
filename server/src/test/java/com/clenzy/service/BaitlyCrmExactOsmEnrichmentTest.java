package com.clenzy.service;

import com.clenzy.marketplace.service.BaitlyProfessionalData.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyCrmExactOsmEnrichmentTest {
    JdbcTemplate db=mock(JdbcTemplate.class);BaitlyCrmAccess access=mock(BaitlyCrmAccess.class);
    BaitlyCrmImportedOsmSearch source=mock(BaitlyCrmImportedOsmSearch.class);BaitlyCrmOsmMatching matching=mock(BaitlyCrmOsmMatching.class);
    PlatformTransactionManager transactions=mock(PlatformTransactionManager.class);
    BaitlyCrmAddressGeocoding addresses=mock(BaitlyCrmAddressGeocoding.class);
    BaitlyCrmExactOsmEnrichment service=new BaitlyCrmExactOsmEnrichment(db,access,source,matching,new ObjectMapper(),transactions,addresses);
    Business business=new Business("12345678900011","Atlas","Nantes","Nantes","44000","81.21Z",47.2,-1.5);
    Place place=new Place("node/42","Atlas","Nantes",47.2,-1.5,"","","",List.of("SIRET"));
    @BeforeEach void setup(){
        when(access.require("actor")).thenReturn(10L);when(access.lock("actor")).thenReturn(10L);
        when(db.queryForList(anyString(),eq(10L),eq("actor"),eq(7L))).thenReturn(List.of(Map.of("status","PENDING")));
        when(db.queryForObject(anyString(),eq(String.class),eq(10L),eq(7L),eq(10L),eq(7L))).thenReturn("NONE");
    }
    @Test void ambiguityReturnsAllExactCandidatesForManualReviewWithoutWriting(){
        var second=new Place("way/43","Atlas","Paris",48.8,2.3,"","","",List.of("SIRET"));
        when(source.exact("actor",7)).thenReturn(new BaitlyCrmImportedOsmSearch.Exact(business,null,List.of(place,second)));
        var ticket=UUID.randomUUID();when(matching.proposeImported(anyString(),anyLong(),anyString(),anyString(),anyList())).thenAnswer(i->new BaitlyCrmOsmMatching.Results(ticket,i.getArgument(4)));
        var result=service.enrich("actor",7);assertThat(result.status()).isEqualTo("REVIEW");assertThat(result.proposal().candidates()).hasSize(2);
        verify(matching,never()).confirm(anyString(),anyLong(),any());verify(db,never()).update(anyString(),any(Object[].class));verifyNoInteractions(transactions);
    }
    @Test void skippedDuringLookupCannotBeAutomaticallyConfirmedByTheLateResponse(){
        when(db.queryForList(anyString(),eq(10L),eq("actor"),eq(7L))).thenReturn(List.of(Map.of("status","PENDING")),List.of(Map.of("status","SKIPPED")));
        when(source.exact("actor",7)).thenReturn(new BaitlyCrmImportedOsmSearch.Exact(business,place,List.of(place)));
        when(matching.proposeImported(anyString(),anyLong(),anyString(),anyString(),anyList())).thenReturn(new BaitlyCrmOsmMatching.Results(UUID.randomUUID(),List.of()));
        assertThat(service.enrich("actor",7).status()).isEqualTo("SKIPPED");verify(matching,never()).confirm(anyString(),anyLong(),any());verify(db,never()).update(anyString(),any(Object[].class));
    }
    @Test void anExistingOrStaleLocationIsNeverReplacedAutomatically(){
        when(db.queryForObject(anyString(),eq(String.class),eq(10L),eq(7L),eq(10L),eq(7L))).thenReturn("VALID","STALE");
        assertThat(service.enrich("actor",7).status()).isEqualTo("ALREADY_LOCATED");assertThat(service.enrich("actor",7).status()).isEqualTo("REVIEW");verifyNoInteractions(source,matching);
    }
    @Test void anOsmQuotaErrorDoesNotPreventAddressGeocoding(){
        when(source.exact("actor",7)).thenThrow(new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS));
        when(addresses.locate("actor",7)).thenReturn(new BaitlyCrmExactOsmEnrichment.Outcome("CONFIRMED",List.of()));
        assertThat(service.enrich("actor",7).status()).isEqualTo("CONFIRMED");verifyNoInteractions(matching);
    }
}
