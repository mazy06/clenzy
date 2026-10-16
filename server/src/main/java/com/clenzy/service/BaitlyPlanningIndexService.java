package com.clenzy.service;

import com.clenzy.dto.BaitlyPlanningReservationIndex;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class BaitlyPlanningIndexService {
    private final ReservationRepository reservations;
    private final TenantContext tenant;
    public BaitlyPlanningIndexService(ReservationRepository reservations, TenantContext tenant) {
        this.reservations = reservations;
        this.tenant = tenant;
    }
    /** Appelée uniquement après la garde d'accès de tous les logements. */
    public List<BaitlyPlanningReservationIndex> reservations(List<Long> propertyIds, LocalDate from, LocalDate to) {
        if (propertyIds == null || propertyIds.isEmpty()) return List.of();
        return reservations.findBaitlyPlanningIndex(propertyIds, from, to, tenant.getRequiredOrganizationId());
    }
}
