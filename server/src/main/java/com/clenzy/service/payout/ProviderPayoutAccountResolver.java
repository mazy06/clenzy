package com.clenzy.service.payout;

import com.clenzy.model.HousekeeperPayoutConfig;
import com.clenzy.model.Intervention;
import com.clenzy.model.PayoutBeneficiary;
import com.clenzy.repository.HousekeeperPayoutConfigRepository;
import com.clenzy.repository.PaymentConnectionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;

/** Résout le compte du prestataire désigné par la mission, y compris pour une mission marketplace inter-organisations. */
@Service
@Transactional(readOnly = true)
public class ProviderPayoutAccountResolver {
    private final PaymentConnectionRepository connections;
    private final HousekeeperPayoutConfigRepository legacy;
    public ProviderPayoutAccountResolver(PaymentConnectionRepository connections, HousekeeperPayoutConfigRepository legacy) {
        this.connections = connections; this.legacy = legacy;
    }

    public Optional<HousekeeperPayoutConfig> resolve(Intervention mission) {
        var user = mission.getAssignedUser();
        if (user == null) return Optional.empty();
        return resolve(mission, PayoutBeneficiary.user(user.getId()));
    }

    public Optional<HousekeeperPayoutConfig> resolve(Intervention mission, PayoutBeneficiary beneficiary) {
        var account = beneficiary.organizationId() != null
                ? connections.findOrganizationProviderAccount(mission.getId(), mission.getOrganizationId(), beneficiary.organizationId())
                : connections.findAssignedProviderAccount(mission.getId(), mission.getOrganizationId(), beneficiary.userId());
        if (account.isPresent()) {
            // Un compte révoqué ou incomplet ne doit jamais être contourné via l'ancienne configuration.
            var c = account.get();
            var result = new HousekeeperPayoutConfig();
            result.setOrganizationId(mission.getOrganizationId());
            result.setUserId(beneficiary.userId());
            result.setStripeAccountId(c.getAccountId());
            result.setOnboardingCompleted(c.getReady());
            return Optional.of(result);
        }
        // Une société ne peut jamais recevoir via le compte personnel de son représentant.
        if (beneficiary.organizationId() != null) return Optional.empty();
        return legacy.findByUserIdAndOrganizationId(beneficiary.userId(), mission.getOrganizationId());
    }
}
