package com.clenzy.service;

import com.clenzy.dto.ReservationDto;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.GuestRepository;
import com.clenzy.util.BaitlyFieldDecryptionTiming;
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
    private final GuestRepository guests;
    private final ReservationMapper mapper;
    private final TenantContext tenant;
    private final Timer readTimer;
    private final Timer mappingTimer;
    private final Timer contactsTimer;

    public BaitlyPlanningReservationService(ReservationRepository reservations, GuestRepository guests,
            ReservationMapper mapper, TenantContext tenant, MeterRegistry metrics) {
        this.reservations = reservations;
        this.guests = guests;
        this.mapper = mapper;
        this.tenant = tenant;
        this.readTimer = Timer.builder("baitly.planning.reservations")
                .tag("phase", "read").publishPercentileHistogram().register(metrics);
        this.mappingTimer = Timer.builder("baitly.planning.reservations")
                .tag("phase", "mapping").publishPercentileHistogram().register(metrics);
        this.contactsTimer = Timer.builder("baitly.planning.reservations")
                .tag("phase", "contacts").publishPercentileHistogram().register(metrics);
    }

    public record Details(List<ReservationDto> reservations, long readNanos, long contactsNanos,
            long mappingNanos, long decryptNanos) {
        public static Details empty() { return new Details(List.of(), 0, 0, 0, 0); }
        public String serverTiming() {
            return String.format(java.util.Locale.ROOT,
                    "rows;dur=%.3f, contacts;dur=%.3f, decrypt;dur=%.3f, mapping;dur=%.3f",
                    readNanos / 1_000_000.0, contactsNanos / 1_000_000.0,
                    decryptNanos / 1_000_000.0, mappingNanos / 1_000_000.0);
        }
    }

    @Transactional(readOnly = true)
    public Details details(List<Long> ids, LocalDate from, LocalDate to) {
        long started = System.nanoTime();
        Long org = tenant.getRequiredOrganizationId();
        var rows = readTimer.record(() -> reservations.findBaitlyPlanningDetails(
                ids, from, to, org));
        long read = System.nanoTime();
        // Les identifiants proviennent uniquement des séjours déjà autorisés et filtrés par organisation.
        var guestIds = rows.stream().map(com.clenzy.dto.BaitlyPlanningReservationRow::guestId)
                .filter(java.util.Objects::nonNull).distinct().toList();
        java.util.Map<Long, com.clenzy.dto.BaitlyPlanningGuestContact> contacts;
        long decryptNanos;
        try (var timing = BaitlyFieldDecryptionTiming.open()) {
            contacts = contactsTimer.record(() -> guestIds.isEmpty()
                    ? java.util.Map.of()
                    : guests.findBaitlyPlanningContacts(guestIds, org).stream().collect(
                        java.util.stream.Collectors.toMap(com.clenzy.dto.BaitlyPlanningGuestContact::id,
                            java.util.function.Function.identity())));
            decryptNanos = timing.nanos();
        }
        long contacted = System.nanoTime();
        var dtos = mappingTimer.record(() -> rows.stream()
                .map(row -> mapper.toPlanningDto(row, row.guestId() == null ? null : contacts.get(row.guestId()))).toList());
        return new Details(dtos, read - started, contacted - read,
                System.nanoTime() - contacted, decryptNanos);
    }
}
