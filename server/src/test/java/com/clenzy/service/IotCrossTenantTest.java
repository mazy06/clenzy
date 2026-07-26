package com.clenzy.service;

import com.clenzy.model.Camera;
import com.clenzy.model.EnvironmentSensor;
import com.clenzy.model.NoiseDevice;
import com.clenzy.model.Thermostat;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Isolation multi-tenant des appareils connectés — audit sécurité 2026-07-26,
 * constats P1-09 (thermostats), P1-10 (caméras) et P1-15 (capteurs).
 *
 * <p>Les quatre services chargeaient leurs appareils par identifiant sans vérifier
 * l'organisation. Un compte d'un autre tenant pouvait donc supprimer une caméra,
 * envoyer une consigne de chauffage sur un logement tiers, ou supprimer un détecteur
 * de fumée.
 *
 * <p>Ce test verrouille la <b>règle commune</b> aux quatre services plutôt que de
 * réinstancier chacun d'eux avec sa douzaine de dépendances : ce qui doit être garanti,
 * c'est que l'organisation portée par l'appareil est confrontée à celle du tenant, et
 * que l'absence d'organisation vaut refus. Les parcours nominaux de chaque service
 * restent couverts par {@code ThermostatServiceTest}, {@code CameraServiceTest},
 * {@code NoiseDeviceServiceTest} et {@code EnvironmentSensorServiceTest}.
 */
@DisplayName("Appareils connectés — isolation multi-tenant (P1-09, P1-10, P1-15)")
class IotCrossTenantTest {

    private static final Long ORG_COURANTE = 1L;
    private static final Long ORG_VICTIME = 2L;

    private OrganizationAccessGuard gardePour(Long orgCourante) {
        TenantContext contexte = new TenantContext();
        contexte.setOrganizationId(orgCourante);
        return new OrganizationAccessGuard(contexte);
    }

    private Camera camera(Long orgId) {
        Camera c = new Camera();
        c.setId(1L);
        c.setOrganizationId(orgId);
        return c;
    }

    private Thermostat thermostat(Long orgId) {
        Thermostat t = new Thermostat();
        t.setId(1L);
        t.setOrganizationId(orgId);
        return t;
    }

    private NoiseDevice capteurBruit(Long orgId) {
        NoiseDevice d = new NoiseDevice();
        d.setId(1L);
        d.setOrganizationId(orgId);
        return d;
    }

    private EnvironmentSensor capteurEnvironnement(Long orgId) {
        EnvironmentSensor s = new EnvironmentSensor();
        s.setId(1L);
        s.setOrganizationId(orgId);
        return s;
    }

    @Test
    @DisplayName("un appareil d'une autre organisation est refusé, quel que soit son type")
    void appareilHorsOrganisation_estRefuse() {
        OrganizationAccessGuard garde = gardePour(ORG_COURANTE);

        assertThatThrownBy(() -> garde.requireSameOrganization(
                camera(ORG_VICTIME).getOrganizationId(), "Camera hors de votre organisation"))
                .isInstanceOf(AccessDeniedException.class);

        assertThatThrownBy(() -> garde.requireSameOrganization(
                thermostat(ORG_VICTIME).getOrganizationId(), "Thermostat hors de votre organisation"))
                .isInstanceOf(AccessDeniedException.class);

        assertThatThrownBy(() -> garde.requireSameOrganization(
                capteurBruit(ORG_VICTIME).getOrganizationId(), "Capteur de bruit hors de votre organisation"))
                .isInstanceOf(AccessDeniedException.class);

        assertThatThrownBy(() -> garde.requireSameOrganization(
                capteurEnvironnement(ORG_VICTIME).getOrganizationId(), "Capteur hors de votre organisation"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("un appareil de sa propre organisation reste accessible")
    void appareilDeSonOrganisation_estAutorise() {
        OrganizationAccessGuard garde = gardePour(ORG_COURANTE);

        assertThatCode(() -> garde.requireSameOrganization(
                camera(ORG_COURANTE).getOrganizationId(), "Camera hors de votre organisation"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("un appareil sans organisation est refusé — le modèle est fail-closed")
    void appareilSansOrganisation_estRefuse() {
        OrganizationAccessGuard garde = gardePour(ORG_COURANTE);

        // Une donnée incomplète ne doit jamais ouvrir l'accès : c'est ce qui distingue
        // un contrôle fail-closed d'un contrôle qui se contente de comparer deux valeurs.
        assertThatThrownBy(() -> garde.requireSameOrganization(
                camera(null).getOrganizationId(), "Camera hors de votre organisation"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("un contexte sans organisation ne donne accès à rien")
    void contexteSansOrganisation_neDonneAccesARien() {
        OrganizationAccessGuard garde = gardePour(null);

        assertThatThrownBy(() -> garde.requireSameOrganization(
                camera(ORG_COURANTE).getOrganizationId(), "Camera hors de votre organisation"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("le personnel plateforme conserve son accès transverse")
    void personnelPlateforme_conserveSonAccesTransverse() {
        // Le bypass est délibéré (SUPER_ADMIN / org SYSTEM) : le vérifier ici évite qu'un
        // durcissement futur casse silencieusement le support et l'exploitation.
        TenantContext contexte = new TenantContext();
        contexte.setOrganizationId(ORG_COURANTE);
        contexte.setSuperAdmin(true);
        OrganizationAccessGuard garde = new OrganizationAccessGuard(contexte);

        assertThatCode(() -> garde.requireSameOrganization(
                camera(ORG_VICTIME).getOrganizationId(), "Camera hors de votre organisation"))
                .doesNotThrowAnyException();
        assertThat(contexte.isSuperAdmin()).isTrue();
    }
}
