package com.clenzy.service;

import com.clenzy.model.Reservation;
import com.clenzy.model.User;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.clenzy.tenant.TenantContext;
import java.time.LocalDate;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class ReservationService {

    private static final Logger log = LoggerFactory.getLogger(ReservationService.class);

    private final ReservationRepository reservationRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public ReservationService(ReservationRepository reservationRepository,
                              UserRepository userRepository,
                              TenantContext tenantContext) {
        this.reservationRepository = reservationRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Retourne toutes les reservations dans une plage de dates.
     * Admin/Manager : toutes.
     * Host : uniquement ses proprietes.
     */
    public List<Reservation> getReservations(String keycloakId, List<Long> propertyIds,
                                              LocalDate from, LocalDate to) {
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        String role = user.getRole() != null ? user.getRole().name().toUpperCase() : "";
        boolean isAdminOrManager = role.contains("ADMIN") || role.contains("MANAGER");

        if (propertyIds != null && !propertyIds.isEmpty()) {
            return reservationRepository.findByPropertyIdsAndDateRange(propertyIds, from, to, tenantContext.getRequiredOrganizationId());
        }

        if (isAdminOrManager) {
            return reservationRepository.findAllByDateRange(from, to, tenantContext.getRequiredOrganizationId());
        }

        // Host : ses propres proprietes
        return reservationRepository.findByOwnerKeycloakIdAndDateRange(keycloakId, from, to, tenantContext.getRequiredOrganizationId());
    }

    /**
     * Retourne les reservations d'une propriete specifique.
     */
    public List<Reservation> getByProperty(Long propertyId) {
        return reservationRepository.findByPropertyId(propertyId, tenantContext.getRequiredOrganizationId());
    }

    /**
     * Sauvegarde une reservation (creation ou mise a jour).
     * Valide que l'organizationId correspond au tenant courant.
     */
    @Transactional
    public Reservation save(Reservation reservation) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        if (reservation.getOrganizationId() == null) {
            reservation.setOrganizationId(orgId);
        } else if (!reservation.getOrganizationId().equals(orgId)) {
            log.warn("Tentative de sauvegarde d'une reservation cross-tenant: reservation orgId={} vs caller orgId={}",
                    reservation.getOrganizationId(), orgId);
            throw new RuntimeException("Acces refuse : reservation hors de votre organisation");
        }
        return reservationRepository.save(reservation);
    }

    /**
     * Verifie si une reservation avec ce UID existe deja pour cette propriete.
     */
    public boolean existsByExternalUid(String externalUid, Long propertyId) {
        if (externalUid == null || propertyId == null) return false;
        return reservationRepository.existsByExternalUidAndPropertyId(externalUid, propertyId);
    }
}
