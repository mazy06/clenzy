package com.clenzy.integration.tuya.service;

import com.clenzy.repository.NoiseDeviceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lectures des devices lies a un utilisateur pour l'integration Tuya Cloud
 * — refactor T-ARCH-01 : plus aucun repository dans les controllers.
 *
 * <p>L'ownership est valide par {@code userId} (subject du JWT) : les devices
 * d'un autre utilisateur sont invisibles — il n'y a aucun chargement par ID
 * brut sans scoping.</p>
 */
@Service
public class TuyaDeviceQueryService {

    private final NoiseDeviceRepository noiseDeviceRepository;

    public TuyaDeviceQueryService(NoiseDeviceRepository noiseDeviceRepository) {
        this.noiseDeviceRepository = noiseDeviceRepository;
    }

    /** Nombre de devices lies a l'utilisateur (ecran de statut de connexion). */
    @Transactional(readOnly = true)
    public long countDevicesForUser(String userId) {
        return noiseDeviceRepository.countByUserId(userId);
    }

    /** Verifie que l'utilisateur possede un device avec l'externalDeviceId donne. */
    @Transactional(readOnly = true)
    public boolean userOwnsDevice(String userId, String externalDeviceId) {
        return noiseDeviceRepository.findByUserId(userId).stream()
                .anyMatch(d -> externalDeviceId.equals(d.getExternalDeviceId()));
    }
}
