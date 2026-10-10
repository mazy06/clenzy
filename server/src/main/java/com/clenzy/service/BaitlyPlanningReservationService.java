package com.clenzy.service;

import com.clenzy.dto.ReservationDto;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.LocalDate;
import java.util.List;

/** Lecture Baitly dédiée ; l'accès aux logements est validé par le controller. */
@Service
public class BaitlyPlanningReservationService {
    private final ReservationRepository reservations;
    private final ReservationMapper mapper;
    private final TenantContext tenant;
    private final Timer readTimer;
    private final Timer mappingTimer;

    public BaitlyPlanningReservationService(ReservationRepository reservations,
            ReservationMapper mapper, TenantContext tenant, MeterRegistry metrics) {
        this.reservations = reservations;
        this.mapper = mapper;
        this.tenant = tenant;
        this.readTimer = Timer.builder("baitly.planning.reservations")
                .tag("phase", "read").publishPercentileHistogram().register(metrics);
        this.mappingTimer = Timer.builder("baitly.planning.reservations")
                .tag("phase", "mapping").publishPercentileHistogram().register(metrics);
    }

    @Transactional(readOnly = true)
    public List<ReservationDto> details(List<Long> ids, LocalDate from, LocalDate to) {
        var rows = readTimer.record(() -> reservations.findBaitlyPlanningDetails(
                ids, from, to, tenant.getRequiredOrganizationId()));
        return mappingTimer.record(() -> rows.stream().map(mapper::toPlanningDto).toList());
    }
}
