package com.clenzy.controller;

import com.clenzy.service.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(BaitlyCrmLocationAccessTest.Config.class)
class BaitlyCrmLocationAccessTest {
    @Configuration @Import(BaitlyCrmAccessTest.Config.class)
    static class Config {
        @Bean BaitlyCrmLocations locations(){return mock(BaitlyCrmLocations.class);}
        @Bean BaitlyCrmLocationController locationController(BaitlyCrmLocations locations){return new BaitlyCrmLocationController(locations);}
        @Bean BaitlyCrmDetails details(){return mock(BaitlyCrmDetails.class);}
        @Bean BaitlyCrmDetailsController detailsController(BaitlyCrmDetails details){return new BaitlyCrmDetailsController(details);}
        @Bean BaitlyCrmOsmMatching matching(){return mock(BaitlyCrmOsmMatching.class);}
        @Bean BaitlyCrmOsmController osmController(BaitlyCrmOsmMatching matching){return new BaitlyCrmOsmController(matching);}
        @Bean BaitlyCrmImportedOsmSearch importedSearch(){return mock(BaitlyCrmImportedOsmSearch.class);}
        @Bean BaitlyCrmImportedOsmController importedController(BaitlyCrmImportedOsmSearch search){return new BaitlyCrmImportedOsmController(search);}
        @Bean BaitlyCrmExactOsmEnrichment enrichment(){return mock(BaitlyCrmExactOsmEnrichment.class);}
        @Bean BaitlyCrmExactOsmEnrichmentController enrichmentController(BaitlyCrmExactOsmEnrichment enrichment){return new BaitlyCrmExactOsmEnrichmentController(enrichment);}
        @Bean BaitlyCrmLocationReview review(){return mock(BaitlyCrmLocationReview.class);}
        @Bean BaitlyCrmLocationReviewController reviewController(BaitlyCrmLocationReview review){return new BaitlyCrmLocationReviewController(review);}
        @Bean BaitlyCrmLocationBatches batches(){return mock(BaitlyCrmLocationBatches.class);}
        @Bean BaitlyCrmLocationBatchController batchController(BaitlyCrmLocationBatches batches){return new BaitlyCrmLocationBatchController(batches);}
        @Bean BaitlyCrmEnrichmentRuns runs(){return mock(BaitlyCrmEnrichmentRuns.class);}
        @Bean BaitlyCrmEnrichmentRunController runsController(BaitlyCrmEnrichmentRuns runs){return new BaitlyCrmEnrichmentRunController(runs);}
    }
    @Autowired BaitlyCrmLocationController controller;
    @Autowired BaitlyCrmLocations locations;
    @Autowired PermissionService permissions;
    @Autowired BaitlyCrmDetailsController detailsController;
    @Autowired BaitlyCrmDetails details;
    @Autowired BaitlyCrmOsmController osm;
    @Autowired BaitlyCrmOsmMatching matching;
    @Autowired BaitlyCrmImportedOsmController importedController;
    @Autowired BaitlyCrmImportedOsmSearch importedSearch;
    @Autowired BaitlyCrmLocationBatchController bulk;
    @Autowired BaitlyCrmLocationBatches batches;
    @Autowired BaitlyCrmLocationReview review;
    @Autowired BaitlyCrmLocationReviewController reviewController;
    @Autowired BaitlyCrmExactOsmEnrichment enrichment;
    @Autowired BaitlyCrmExactOsmEnrichmentController enrichmentController;
    @Autowired BaitlyCrmEnrichmentRuns runs;
    @Autowired BaitlyCrmEnrichmentRunController runsController;
    Jwt jwt;
    @BeforeEach void setup(){reset(locations,permissions);jwt=Jwt.withTokenValue("test").header("alg","none").subject("actor").build();SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,java.util.List.of()));}
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    @Test void bulkSearchRequiresCrmManagementForEveryEndpoint(){
        reset(batches);when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);var id=java.util.UUID.randomUUID();
        assertThatThrownBy(()->bulk.config(jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->bulk.latest(jwt,0)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->bulk.start(jwt,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->bulk.cancel(jwt,id)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->bulk.confirm(jwt,id,7,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->bulk.skip(jwt,id,7)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(batches);
        when(permissions.checkUserPermission("actor","baitly-crm:manage")).thenReturn(true);bulk.start(jwt,null);verify(batches).start("actor",null);
    }
    @Test void osmSearchAndConfirmationRequireManagementPermission(){
        reset(matching);when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);
        assertThatThrownBy(()->osm.search(jwt,7,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->osm.confirm(jwt,7,null)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(matching);
        when(permissions.checkUserPermission("actor","baitly-crm:manage")).thenReturn(true);
        osm.search(jwt,7,null);osm.confirm(jwt,7,null);verify(matching).search("actor",7,null);verify(matching).confirm("actor",7,null);
    }
    @Test void automaticSearchRequiresTheSameCrmManagementPermission(){
        reset(importedSearch);when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);
        assertThatThrownBy(()->importedController.search(jwt,7)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(importedSearch);
        when(permissions.checkUserPermission("actor","baitly-crm:manage")).thenReturn(true);
        importedController.search(jwt,7);verify(importedSearch).search("actor",7);
    }
    @Test void savedReviewRequiresReadAndManagementPermissions(){
        reset(review);when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);
        assertThatThrownBy(()->reviewController.progress(jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->reviewController.prepareImported(jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->reviewController.enqueue(jwt,java.util.List.of(1L))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->reviewController.skip(jwt,1)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->reviewController.search(jwt,1)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(review);
        when(permissions.checkUserPermission("actor","baitly-crm:manage")).thenReturn(true);reviewController.progress(jwt);verify(review).progress("actor");
    }
    @Test void automaticEnrichmentRequiresReadAndManagementPermission(){
        reset(enrichment);when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);
        assertThatThrownBy(()->enrichmentController.enrich(jwt,1)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(enrichment);
        when(permissions.checkUserPermission("actor","baitly-crm:manage")).thenReturn(true);enrichmentController.enrich(jwt,1);verify(enrichment).enrich("actor",1);
    }
    @Test void durableExecutionRequiresManagementForStartingReadingAndCancelling(){
        reset(runs);when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);
        assertThatThrownBy(()->runsController.latest(jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->runsController.start(jwt,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->runsController.cancel(jwt,java.util.UUID.randomUUID())).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(runs);
        when(permissions.checkUserPermission("actor","baitly-crm:manage")).thenReturn(true);runsController.latest(jwt);verify(runs).latest("actor");
    }
    @Test void readingRequiresCrmAccess(){assertThatThrownBy(()->controller.list(jwt)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(locations);}
    @Test void readersCannotSaveOrDeleteLocations(){
        when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);controller.list(jwt);verify(locations).list("actor");
        assertThatThrownBy(()->controller.save(jwt,1,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.remove(jwt,1)).isInstanceOf(AccessDeniedException.class);
    }
    @Test void managersCanConfirmAndRemoveALocation(){
        when(permissions.checkUserPermission(eq("actor"),anyString())).thenReturn(true);
        var point=new BaitlyCrmLocations.Location("Rabat",34.0,-6.8,"CITY");controller.save(jwt,1,point);controller.remove(jwt,1);
        verify(locations).save("actor",1,point);verify(locations).remove("actor",1);
    }
    @Test void detailsAndTeamDirectoryRequireReadAccessAndSavingRequiresManagement(){
        assertThatThrownBy(()->detailsController.list(jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->detailsController.assignees(jwt)).isInstanceOf(AccessDeniedException.class);
        when(permissions.checkUserPermission("actor","baitly-crm:view")).thenReturn(true);
        detailsController.list(jwt);detailsController.assignees(jwt);
        assertThatThrownBy(()->detailsController.save(jwt,1,null)).isInstanceOf(AccessDeniedException.class);
        when(permissions.checkUserPermission("actor","baitly-crm:manage")).thenReturn(true);
        var command=new BaitlyCrmDetails.Details(null,"Atlas Services","Gérante",null,"Rabat","QUALIFIED");detailsController.save(jwt,1,command);verify(details).save("actor",1,command);
    }
}
