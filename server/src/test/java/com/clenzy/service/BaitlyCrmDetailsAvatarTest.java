package com.clenzy.service;

import com.clenzy.model.OrganizationMember;
import com.clenzy.model.User;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.OrganizationMemberRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BaitlyCrmDetailsAvatarTest {
    @Test void returnsTheResolvedAvatarOnlyForAnEligibleOrganizationMember() {
        var db=mock(JdbcTemplate.class);var access=mock(BaitlyCrmAccess.class);
        var members=mock(OrganizationMemberRepository.class);var permissions=mock(PermissionService.class);
        var avatars=mock(UserAvatarUrlResolver.class);
        var service=new BaitlyCrmDetails(db,access,members,permissions,avatars);
        var user=new User();user.setId(301L);user.setFirstName("Nadia");user.setLastName("Bennani");
        user.setStatus(UserStatus.ACTIVE);user.setKeycloakId("nadia");user.setProfilePictureUrl("avatars/nadia.jpg");
        var member=new OrganizationMember();member.setUser(user);
        when(access.require("actor")).thenReturn(10L);
        when(members.findByOrganizationIdWithUser(10L)).thenReturn(List.of(member));
        when(permissions.checkUserPermission("nadia","baitly-crm:view")).thenReturn(true);
        when(avatars.publicUrl(301L,"avatars/nadia.jpg")).thenReturn("/api/users/301/profile-picture?ticket=signed");
        when(db.queryForList(anyString(),eq(10L))).thenAnswer(call->List.of(new HashMap<String,Object>(Map.of("assigned_user_id",301L))));
        assertThat(service.list("actor").getFirst()).containsEntry("assigned_user_avatar_url","/api/users/301/profile-picture?ticket=signed");
        assertThat(service.assignees("actor").getFirst().profilePictureUrl()).isEqualTo("/api/users/301/profile-picture?ticket=signed");
        clearInvocations(avatars);
        when(permissions.checkUserPermission("nadia","baitly-crm:view")).thenReturn(false);
        assertThat(service.list("actor").getFirst()).containsEntry("assigned_user_avatar_url",null).containsEntry("assigned_user_name",null);
        verifyNoInteractions(avatars);
    }
}
