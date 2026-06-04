package com.clenzy.integration.tuya.service;

import com.clenzy.integration.tuya.model.TuyaDeviceClaim;
import com.clenzy.integration.tuya.repository.TuyaDeviceClaimRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Registre de reclamation des devices Tuya (garde-fou multi-tenant). Un {@code tuya_device_id}
 * ne peut appartenir qu'a une seule organisation -> segmente les appareils par tenant meme sur
 * un compte Tuya partage. Voir {@link TuyaDeviceClaim}.
 */
@Service
public class TuyaDeviceClaimService {

    private final TuyaDeviceClaimRepository repository;
    private final TenantContext tenantContext;

    public TuyaDeviceClaimService(TuyaDeviceClaimRepository repository, TenantContext tenantContext) {
        this.repository = repository;
        this.tenantContext = tenantContext;
    }

    /**
     * Reclame un device pour l'organisation courante. Idempotent si deja reclame par CETTE org ;
     * leve {@link IllegalStateException} s'il est deja reclame par une AUTRE org.
     */
    @Transactional
    public void claim(String tuyaDeviceId, String deviceType) {
        if (tuyaDeviceId == null || tuyaDeviceId.isBlank()) {
            return;
        }
        Long orgId = tenantContext.getRequiredOrganizationId();
        Optional<TuyaDeviceClaim> existing = repository.findByTuyaDeviceId(tuyaDeviceId);
        if (existing.isPresent()) {
            if (!existing.get().getOrganizationId().equals(orgId)) {
                throw new IllegalStateException("Cet appareil Tuya est deja rattache a une autre organisation");
            }
            return; // deja reclame par cette org : no-op
        }
        repository.save(new TuyaDeviceClaim(tuyaDeviceId, orgId, deviceType));
    }

    /** Libere la reclamation (a la suppression du device). */
    @Transactional
    public void release(String tuyaDeviceId) {
        if (tuyaDeviceId == null || tuyaDeviceId.isBlank()) {
            return;
        }
        repository.deleteByTuyaDeviceId(tuyaDeviceId);
    }

    /** device_ids reclames par l'org courante (pour marquer « deja ajoute » dans la decouverte). */
    public Set<String> claimedByCurrentOrg() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return repository.findByOrganizationId(orgId).stream()
                .map(TuyaDeviceClaim::getTuyaDeviceId)
                .collect(Collectors.toSet());
    }

    /** device_ids reclames par une AUTRE org (a exclure de la decouverte = segmentation). */
    public Set<String> claimedByOtherOrgs() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return repository.findAll().stream()
                .filter(c -> !orgId.equals(c.getOrganizationId()))
                .map(TuyaDeviceClaim::getTuyaDeviceId)
                .collect(Collectors.toSet());
    }
}
