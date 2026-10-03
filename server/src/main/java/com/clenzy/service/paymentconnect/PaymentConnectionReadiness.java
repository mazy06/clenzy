package com.clenzy.service.paymentconnect;

import com.clenzy.model.PaymentConnection;
import com.clenzy.repository.PaymentConnectionRepository;
import com.clenzy.repository.OrganizationMemberRepository;
import org.springframework.stereotype.Service;

@Service
public class PaymentConnectionReadiness {
    private final PaymentConnectionRepository connections;
    private final OrganizationMemberRepository members;
    public PaymentConnectionReadiness(PaymentConnectionRepository connections, OrganizationMemberRepository members) {
        this.connections = connections;
        this.members = members;
    }
    public boolean isReady(Long userId, Long orgId, boolean allowOrganization) {
        if (userId == null || orgId == null) return false;
        if (connections.findByOrganizationIdAndBeneficiaryKey(orgId, "user:" + userId)
                .filter(PaymentConnection::isReady).isPresent()) return true;
        boolean manages = allowOrganization && members.findByUserId(userId).filter(m -> orgId.equals(m.getOrganizationId())
                && m.getRoleInOrg().canManageOrg()).isPresent();
        return manages && connections.findByOrganizationIdAndBeneficiaryKey(orgId, "organization")
                .filter(PaymentConnection::isReady).isPresent();
    }
}
