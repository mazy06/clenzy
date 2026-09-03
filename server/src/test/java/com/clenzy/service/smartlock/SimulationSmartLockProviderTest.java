package com.clenzy.service.smartlock;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SimulationSmartLockProviderTest {

    private static final LocalDateTime FROM = LocalDateTime.of(2026, 9, 10, 15, 0);
    private static final LocalDateTime UNTIL = LocalDateTime.of(2026, 9, 14, 11, 0);

    private SimulationSmartLockProvider providerSur(String... profils) {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles(profils);
        return new SimulationSmartLockProvider(env);
    }

    private AccessCodeParams params(String code) {
        return new AccessCodeParams(code, "Baitly-Test", FROM, UNTIL,
                AccessCodeParams.AccessCodeType.TEMPORARY);
    }

    @Test
    void whenProfilProdActif_thenLeBeanRefuseDeDemarrer() {
        // Le @Profile positif laisse passer "dev,prod" : c'est ce garde-fou qui l'arrete.
        SimulationSmartLockProvider provider = providerSur("dev", "prod");

        IllegalStateException levee = assertThrows(IllegalStateException.class,
                provider::refuseEnProduction);

        assertTrue(levee.getMessage().contains("prod"));
    }

    @Test
    void whenProfilHorsProduction_thenLeBeanDemarre() {
        SimulationSmartLockProvider provider = providerSur("dev");

        provider.refuseEnProduction();

        assertEquals(SmartLockBrand.SIMULATION, provider.getBrand());
    }

    @Test
    void whenGenerationAvecCode_thenSuccesEtIdentifiantExterne() {
        SimulationSmartLockProvider provider = providerSur("test");

        SmartLockCommandResult resultat = provider.generateAccessCode("sim-1", params("482913"), 2L);

        assertTrue(resultat.success());
        assertNotNull(resultat.externalId());
        assertEquals(1, provider.codesEnCours());
    }

    @Test
    void whenGenerationSansCode_thenEchecPlutotQueCodeInvente() {
        // Un code invente ici ne serait jamais transmis au voyageur : il recevrait
        // le PIN calcule par l'appelant, different de celui pose sur la serrure.
        SimulationSmartLockProvider provider = providerSur("test");

        SmartLockCommandResult resultat = provider.generateAccessCode("sim-1", params(null), 2L);

        assertFalse(resultat.success());
        assertEquals(0, provider.codesEnCours());
    }

    @Test
    void whenRevocation_thenLeCodeDisparait() {
        SimulationSmartLockProvider provider = providerSur("test");
        String externalId = provider.generateAccessCode("sim-1", params("482913"), 2L).externalId();

        SmartLockCommandResult resultat = provider.revokeAccessCode("sim-1", externalId, 2L);

        assertTrue(resultat.success());
        assertEquals(0, provider.codesEnCours());
    }

    @Test
    void whenRevocationDunCodeInconnu_thenSuccesQuandMeme() {
        // Un banc d'essai redemarre perd ses codes en memoire ; faire echouer la
        // revocation bloquerait un depart pour une raison sans rapport.
        SimulationSmartLockProvider provider = providerSur("test");

        assertTrue(provider.revokeAccessCode("sim-1", "sim-inconnu", 2L).success());
    }

    @Test
    void whenDeviceIdManquant_thenEchec() {
        SimulationSmartLockProvider provider = providerSur("test");

        assertFalse(provider.generateAccessCode("  ", params("482913"), 2L).success());
    }
}
