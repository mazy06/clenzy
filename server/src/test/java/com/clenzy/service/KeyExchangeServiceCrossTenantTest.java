package com.clenzy.service;

import com.clenzy.dto.keyexchange.CreateKeyExchangeCodeDto;
import com.clenzy.dto.keyexchange.CreateKeyExchangePointDto;
import com.clenzy.dto.keyexchange.KeyExchangePointDto;
import com.clenzy.model.KeyExchangeCode;
import com.clenzy.model.KeyExchangePoint;
import com.clenzy.model.Property;
import com.clenzy.repository.KeyExchangeCodeRepository;
import com.clenzy.repository.KeyExchangeEventRepository;
import com.clenzy.repository.KeyExchangePointRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Isolation multi-tenant du module Key Exchange — audit sécurité 2026-07-26, constat P1-02.
 *
 * <p>Le module cumulait deux familles de défauts. D'une part des <b>listings non bornés</b> :
 * {@code getPoints} appelait {@code findByStatus} et {@code getEvents} appelait
 * {@code findAll…}, renvoyant les données de toutes les organisations. D'autre part des
 * <b>chargements par identifiant</b> sans contrôle d'organisation, sur des opérations qui
 * génèrent ou annulent des codes d'accès à des logements.
 *
 * <p>Le listing des points exposait de surcroît {@code verificationToken}, le jeton qui ouvre
 * la page publique de vérification du gardien.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("KeyExchangeService — isolation multi-tenant (P1-02)")
class KeyExchangeServiceCrossTenantTest {

    private static final Long ORG_COURANTE = 1L;
    private static final Long ORG_VICTIME = 2L;

    @Mock private KeyExchangePointRepository pointRepository;
    @Mock private KeyExchangeCodeRepository codeRepository;
    @Mock private KeyExchangeEventRepository eventRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private TenantContext tenantContext;
    @Mock private KeyVerificationThrottle verificationThrottle;

    private KeyExchangeService service;

    @BeforeEach
    void setUp() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_COURANTE);
        when(tenantContext.getOrganizationId()).thenReturn(ORG_COURANTE);
        when(tenantContext.isSuperAdmin()).thenReturn(false);
        when(tenantContext.isSystemOrg()).thenReturn(false);

        service = new KeyExchangeService(pointRepository, codeRepository, eventRepository,
                propertyRepository, tenantContext, verificationThrottle,
                new OrganizationAccessGuard(tenantContext));
    }

    private KeyExchangePoint point(Long orgId) {
        KeyExchangePoint p = new KeyExchangePoint();
        p.setId(10L);
        p.setOrganizationId(orgId);
        p.setPropertyId(5L);
        p.setStoreName("Commerce");
        p.setProvider(KeyExchangePoint.Provider.CLENZY_KEYVAULT);
        p.setStatus(KeyExchangePoint.PointStatus.ACTIVE);
        p.setVerificationToken("jeton-de-la-page-publique");
        return p;
    }

    // ─── Listings : le périmètre doit être l'organisation, pas la table ───

    @Test
    @DisplayName("le listing des points est borné à l'organisation courante")
    void getPoints_interrogeUniquementSonOrganisation() {
        when(pointRepository.findByOrganizationIdAndStatus(eq(ORG_COURANTE), any()))
                .thenReturn(List.of(point(ORG_COURANTE)));

        service.getPoints("user-1");

        // Le point du correctif : ne plus balayer la table entière.
        verify(pointRepository).findByOrganizationIdAndStatus(eq(ORG_COURANTE), any());
        verify(pointRepository, never()).findByStatus(any());
    }

    @Test
    @DisplayName("le listing des points n'expose plus le jeton de la page publique")
    void getPoints_nExposePlusLeJetonDeVerification() throws Exception {
        when(pointRepository.findByOrganizationIdAndStatus(eq(ORG_COURANTE), any()))
                .thenReturn(List.of(point(ORG_COURANTE)));

        List<KeyExchangePointDto> points = service.getPoints("user-1");

        assertThat(points).hasSize(1);
        // Le champ doit avoir disparu du contrat d'API : sa seule présence rendait le jeton
        // lisible par tout appelant du listing.
        assertThat(champsDe(KeyExchangePointDto.class)).doesNotContain("verificationToken");
    }

    @Test
    @DisplayName("l'historique des événements est borné à l'organisation courante")
    void getEvents_interrogeUniquementSonOrganisation() {
        Page<com.clenzy.model.KeyExchangeEvent> vide = new PageImpl<>(List.of());
        when(eventRepository.findByOrganizationIdOrderByCreatedAtDesc(eq(ORG_COURANTE), any(Pageable.class)))
                .thenReturn(vide);

        service.getEvents(null, 0, 20);

        verify(eventRepository).findByOrganizationIdOrderByCreatedAtDesc(eq(ORG_COURANTE), any(Pageable.class));
        verify(eventRepository, never()).findAllByOrderByCreatedAtDesc(any(Pageable.class));
    }

    // ─── Chargements par identifiant : refus hors organisation ───

    @Test
    @DisplayName("créer un point sur la propriété d'une autre organisation est refusé")
    void createPoint_refuseUnePropieteHorsOrganisation() {
        Property propriete = new Property();
        propriete.setId(5L);
        propriete.setOrganizationId(ORG_VICTIME);
        when(propertyRepository.findById(5L)).thenReturn(Optional.of(propriete));

        CreateKeyExchangePointDto dto = new CreateKeyExchangePointDto();
        dto.setPropertyId(5L);
        dto.setProvider("CLENZY_KEYVAULT");

        assertThatThrownBy(() -> service.createPoint("attaquant", dto))
                .isInstanceOf(AccessDeniedException.class);

        verify(pointRepository, never()).save(any());
    }

    @Test
    @DisplayName("lire les codes d'un point d'une autre organisation est refusé")
    void getActiveCodesByPoint_refuseUnPointHorsOrganisation() {
        when(pointRepository.findById(10L)).thenReturn(Optional.of(point(ORG_VICTIME)));

        assertThatThrownBy(() -> service.getActiveCodesByPoint(10L))
                .isInstanceOf(AccessDeniedException.class);

        verify(codeRepository, never()).findByPointIdAndStatus(any(), any());
    }

    @Test
    @DisplayName("générer un code sur un point d'une autre organisation est refusé")
    void generateCode_refuseUnPointHorsOrganisation() {
        when(pointRepository.findById(10L)).thenReturn(Optional.of(point(ORG_VICTIME)));

        CreateKeyExchangeCodeDto dto = new CreateKeyExchangeCodeDto();
        dto.setPointId(10L);

        assertThatThrownBy(() -> service.generateCode("attaquant", dto))
                .isInstanceOf(AccessDeniedException.class);

        verify(codeRepository, never()).save(any());
    }

    @Test
    @DisplayName("annuler le code d'une autre organisation est refusé")
    void cancelCode_refuseUnCodeHorsOrganisation() {
        KeyExchangeCode code = new KeyExchangeCode();
        code.setId(77L);
        code.setOrganizationId(ORG_VICTIME);
        code.setStatus(KeyExchangeCode.CodeStatus.ACTIVE);
        when(codeRepository.findById(77L)).thenReturn(Optional.of(code));

        assertThatThrownBy(() -> service.cancelCode("attaquant", 77L))
                .isInstanceOf(AccessDeniedException.class);

        verify(codeRepository, never()).save(any());
    }

    @Test
    @DisplayName("un point de sa propre organisation reste utilisable")
    void generateCode_autoriseSaPropreOrganisation() {
        when(pointRepository.findById(10L)).thenReturn(Optional.of(point(ORG_COURANTE)));
        when(codeRepository.findByCode(any())).thenReturn(Optional.empty());
        when(codeRepository.save(any())).thenAnswer(call -> call.getArgument(0));

        CreateKeyExchangeCodeDto dto = new CreateKeyExchangeCodeDto();
        dto.setPointId(10L);
        dto.setGuestName("Voyageur");

        assertThat(service.generateCode("proprietaire", dto)).isNotNull();
    }

    private static List<String> champsDe(Class<?> type) {
        return java.util.Arrays.stream(type.getDeclaredFields()).map(Field::getName).toList();
    }
}
