package com.clenzy.service;
import com.clenzy.marketplace.service.BaitlyPublicProfiles;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyCrmPublicationTest {
    BaitlyCrmAccess access=mock(BaitlyCrmAccess.class);
    BaitlyPublicProfiles profiles=mock(BaitlyPublicProfiles.class);
    JdbcTemplate db=mock(JdbcTemplate.class);
    BaitlyCrmPublication publication=new BaitlyCrmPublication(access,profiles,db);
    @Test void individualOrganizationsCannotPublishAConciergeIntakePage() {
        when(access.lock("actor")).thenReturn(10L);
        when(db.queryForObject("SELECT type FROM organizations WHERE id=?",String.class,10L)).thenReturn("INDIVIDUAL");
        assertThatThrownBy(() -> publication.publish(null,"actor")).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(profiles);
    }
    @Test void organizationAccessIsCheckedBeforeExposingAPublication() {
        when(access.require("actor")).thenThrow(new AccessDeniedException("Not manager"));
        assertThatThrownBy(() -> publication.own("actor")).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(db,profiles);
    }
    @Test void platformStaffCanManageTheInternalOrganizationsConciergeForm() {
        when(access.require("staff")).thenReturn(10L);when(access.lock("staff")).thenReturn(10L);
        when(access.isPlatformStaff()).thenReturn(true);
        when(db.queryForObject("SELECT type FROM organizations WHERE id=?",String.class,10L)).thenReturn("SYSTEM");
        when(profiles.own("staff")).thenReturn(java.util.Optional.empty());
        assertThat(publication.own("staff")).containsEntry("available",true);
        publication.publish(null,"staff");verify(profiles).publish(null,"staff");
    }
    @Test void internalOrganizationMembershipAloneDoesNotGrantConciergePublication() {
        when(access.lock("member")).thenReturn(10L);
        when(db.queryForObject("SELECT type FROM organizations WHERE id=?",String.class,10L)).thenReturn("SYSTEM");
        assertThatThrownBy(()->publication.publish(null,"member")).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(profiles);
    }
}
