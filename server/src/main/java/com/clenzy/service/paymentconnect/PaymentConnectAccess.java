package com.clenzy.service.paymentconnect;

import com.clenzy.model.*;
import com.clenzy.repository.OrganizationMemberRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import java.util.Objects;

@Service
public class PaymentConnectAccess {
    public enum Scope { PERSONAL, ORGANIZATION }
    public record Beneficiary(Long orgId, Long actorId, Long userId, String key, String email, UserRole role) {}
    private final UserRepository users;
    private final OrganizationMemberRepository members;
    private final TenantContext tenant;

    public PaymentConnectAccess(UserRepository users, OrganizationMemberRepository members, TenantContext tenant) {
        this.users = users;
        this.members = members;
        this.tenant = tenant;
    }

    public Beneficiary resolve(String subject, Scope scope) {
        User user = users.findByKeycloakId(subject).orElseThrow(() -> new AccessDeniedException("User not found"));
        Long orgId = tenant.getRequiredOrganizationId();
        var membership = members.findByUserId(user.getId()).filter(m -> orgId.equals(m.getOrganizationId()));
        if (!Objects.equals(orgId, user.getOrganizationId()) && membership.isEmpty() && !tenant.isSuperAdmin())
            throw new AccessDeniedException("Organization mismatch");
        if (scope == Scope.ORGANIZATION
                && membership.filter(m -> m.getRoleInOrg().canManageOrg()).isEmpty())
            throw new AccessDeniedException("Organization payment account requires owner or administrator");
        return new Beneficiary(orgId, user.getId(), scope == Scope.PERSONAL ? user.getId() : null,
                scope == Scope.PERSONAL ? "user:" + user.getId() : "organization", user.getEmail(), user.getRole());
    }

    public boolean canManageOrganization(String subject) {
        try { resolve(subject, Scope.ORGANIZATION); return true; }
        catch (AccessDeniedException e) { return false; }
    }
}
