package com.clenzy.service.payout;

import com.clenzy.model.Intervention;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Recharge l'état commité : ne pas payer sur l'objet détaché du lifecycle. */
@Service
public class ProviderPayoutMissionReader {
    private final InterventionRepository missions;
    public ProviderPayoutMissionReader(InterventionRepository missions) { this.missions = missions; }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public Intervention load(Long missionId, Long orgId) {
        return missions.findForPayout(missionId, orgId).orElseThrow(() -> new NotFoundException("Intervention non trouvée"));
    }
}
