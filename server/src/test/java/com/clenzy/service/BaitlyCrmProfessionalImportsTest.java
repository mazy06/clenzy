package com.clenzy.service;

import com.clenzy.marketplace.service.BaitlyProfessionalDirectory;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyCrmProfessionalImportsTest {
    JdbcTemplate db=mock(JdbcTemplate.class);
    BaitlyCrmAccess access=mock(BaitlyCrmAccess.class);
    BaitlyProfessionalDirectory directory=mock(BaitlyProfessionalDirectory.class);
    BaitlyCrmProfessionalImports imports=new BaitlyCrmProfessionalImports(db,access,directory,new ObjectMapper());
    @Test void missingOrganizationAccessNeverSearchesExternalSources(){
        when(access.require("actor")).thenThrow(new AccessDeniedException("inaccessible"));
        assertThatThrownBy(()->imports.cities("actor","Nantes")).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->imports.search("actor",null)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(db,directory);
    }
    @Test void importRechecksManagementBeforeResolvingReferencesOrTickets(){
        when(access.lock("actor")).thenThrow(new AccessDeniedException("inaccessible"));
        assertThatThrownBy(()->imports.importSelection("actor",null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->imports.importReference("actor",1)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(db,directory);
        assertThatThrownBy(()->imports.importReferences("actor",new BaitlyCrmProfessionalImports.References(java.util.List.of(1L)))).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(db,directory);
    }
    @Test void rejectsEmptyOversizedAndInvalidReferenceSelectionsBeforeResolvingSources(){
        when(access.lock("actor")).thenReturn(10L);when(db.queryForObject("SELECT type FROM organizations WHERE id=?",String.class,10L)).thenReturn("CONCIERGE");
        assertThatThrownBy(()->imports.importReferences("actor",new BaitlyCrmProfessionalImports.References(java.util.List.of()))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->imports.importReferences("actor",new BaitlyCrmProfessionalImports.References(java.util.stream.LongStream.rangeClosed(1,101).boxed().toList()))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->imports.importReferences("actor",new BaitlyCrmProfessionalImports.References(java.util.List.of(-1L)))).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(directory);
    }
}
