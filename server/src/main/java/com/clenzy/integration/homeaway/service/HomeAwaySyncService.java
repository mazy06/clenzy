package com.clenzy.integration.homeaway.service;

import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import com.clenzy.service.AuditLogService;
import org.springframework.stereotype.Service;
import java.util.Map;

/** Réception HomeAway fermée jusqu au câblage métier PMS et à sa qualification. */
@Service
public class HomeAwaySyncService {
    // Constructeur conservé pour les consommateurs existants.
    public HomeAwaySyncService(HomeAwayConnectionRepository connections, HomeAwayApiClient api,
                               HomeAwayOAuthService oauth, AuditLogService audit) {}
    public boolean isInboundReady() {return false;}
    public void handleReservationCreated(Map<String, Object> data, Long orgId) {throw unavailable();}
    public void handleReservationUpdated(Map<String, Object> data, Long orgId) {throw unavailable();}
    public void handleReservationCancelled(Map<String, Object> data, Long orgId) {throw unavailable();}
    public void handleAvailabilityUpdate(Map<String, Object> data, Long orgId) {throw unavailable();}
    private UnsupportedOperationException unavailable() {
        return new UnsupportedOperationException("Synchronisation HomeAway indisponible : traitement PMS non implémenté");
    }
}
