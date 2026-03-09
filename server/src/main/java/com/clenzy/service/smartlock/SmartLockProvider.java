package com.clenzy.service.smartlock;

/**
 * Interface d'abstraction pour les providers de serrures connectees.
 *
 * Chaque integration (Tuya, Nuki, TTLock, Yale, etc.) implemente cette
 * interface. Les implementations sont collectees automatiquement par
 * {@link SmartLockProviderRegistry} via injection Spring.
 *
 * Convention :
 * - Chaque methode prend un orgId pour le contexte multi-tenant
 * - Les tokens sont dechiffres en interne via TokenEncryptionService
 * - Les appels API externes sont proteges par @CircuitBreaker
 */
public interface SmartLockProvider {

    /**
     * Retourne la marque geree par ce provider.
     */
    SmartLockBrand getBrand();

    /**
     * Deverrouille une serrure.
     */
    SmartLockCommandResult unlock(String deviceId, Long orgId);

    /**
     * Verrouille une serrure.
     */
    SmartLockCommandResult lock(String deviceId, Long orgId);

    /**
     * Genere un code d'acces temporaire ou permanent.
     */
    SmartLockCommandResult generateAccessCode(String deviceId, AccessCodeParams params, Long orgId);

    /**
     * Revoque un code d'acces existant.
     */
    SmartLockCommandResult revokeAccessCode(String deviceId, String codeId, Long orgId);

    /**
     * Recupere les informations d'un device.
     */
    SmartLockDeviceInfo getDeviceInfo(String deviceId, Long orgId);

    /**
     * Verifie si ce provider est disponible (configure et connexion active)
     * pour l'organisation donnee.
     */
    boolean isAvailable(Long orgId);
}
