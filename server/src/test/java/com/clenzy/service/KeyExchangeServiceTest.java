package com.clenzy.service;

import com.clenzy.dto.keyexchange.CreateKeyExchangeCodeDto;
import com.clenzy.dto.keyexchange.CreateKeyExchangePointDto;
import com.clenzy.dto.keyexchange.KeyExchangeCodeDto;
import com.clenzy.dto.keyexchange.KeyExchangeEventDto;
import com.clenzy.dto.keyexchange.KeyExchangePointDto;
import com.clenzy.exception.TooManyVerificationAttemptsException;
import com.clenzy.model.KeyExchangeCode;
import com.clenzy.model.KeyExchangeCode.CodeStatus;
import com.clenzy.model.KeyExchangeCode.CodeType;
import com.clenzy.model.KeyExchangeEvent;
import com.clenzy.model.KeyExchangeEvent.EventSource;
import com.clenzy.model.KeyExchangeEvent.EventType;
import com.clenzy.model.KeyExchangePoint;
import com.clenzy.model.KeyExchangePoint.GuardianType;
import com.clenzy.model.KeyExchangePoint.PointStatus;
import com.clenzy.model.KeyExchangePoint.Provider;
import com.clenzy.model.Property;
import com.clenzy.repository.KeyExchangeCodeRepository;
import com.clenzy.repository.KeyExchangeEventRepository;
import com.clenzy.repository.KeyExchangePointRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KeyExchangeServiceTest {

    @Mock private KeyExchangePointRepository pointRepository;
    @Mock private KeyExchangeCodeRepository codeRepository;
    @Mock private KeyExchangeEventRepository eventRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private KeyVerificationThrottle verificationThrottle;

    private TenantContext tenantContext;
    private KeyExchangeService service;

    private static final Long ORG_ID = 1L;
    private static final String USER_ID = "user-keycloak-123";

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        service = new KeyExchangeService(
                pointRepository, codeRepository, eventRepository,
                propertyRepository, tenantContext, verificationThrottle);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Property property(Long id, String name) {
        Property p = new Property();
        p.setId(id);
        p.setName(name);
        return p;
    }

    private KeyExchangePoint point(Long id, Provider provider) {
        KeyExchangePoint p = new KeyExchangePoint();
        p.setId(id);
        p.setOrganizationId(ORG_ID);
        p.setUserId(USER_ID);
        p.setPropertyId(20L);
        p.setProvider(provider);
        p.setStoreName("Tabac du coin");
        p.setStatus(PointStatus.ACTIVE);
        if (provider == Provider.CLENZY_KEYVAULT) {
            p.setGuardianType(GuardianType.MERCHANT);
            p.setVerificationToken("token-xyz");
        }
        return p;
    }

    private KeyExchangeCode code(Long id, Long pointId, String codeStr, CodeStatus status) {
        KeyExchangeCode c = new KeyExchangeCode();
        c.setId(id);
        c.setOrganizationId(ORG_ID);
        c.setPointId(pointId);
        c.setPropertyId(20L);
        c.setCode(codeStr);
        c.setCodeType(CodeType.COLLECTION);
        c.setStatus(status);
        return c;
    }

    private CreateKeyExchangePointDto createPointDto(String provider) {
        CreateKeyExchangePointDto dto = new CreateKeyExchangePointDto();
        dto.setPropertyId(20L);
        dto.setProvider(provider);
        dto.setStoreName("Tabac Café");
        dto.setStoreAddress("1 rue Test");
        dto.setStorePhone("0123456789");
        dto.setStoreLat(48.8566);
        dto.setStoreLng(2.3522);
        dto.setStoreOpeningHours("Lun-Ven 8h-20h");
        return dto;
    }

    // ── getPoints ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getPoints(userId)")
    class GetPoints {

        @Test
        @DisplayName("returns all ACTIVE points mapped to DTOs")
        void whenCalled_thenReturnsActivePoints() {
            KeyExchangePoint p1 = point(1L, Provider.CLENZY_KEYVAULT);
            KeyExchangePoint p2 = point(2L, Provider.KEYNEST);

            when(pointRepository.findByStatus(PointStatus.ACTIVE))
                    .thenReturn(List.of(p1, p2));
            when(propertyRepository.findById(20L))
                    .thenReturn(Optional.of(property(20L, "MaProp")));
            when(codeRepository.countByPointIdAndStatus(anyLong(), eq(CodeStatus.ACTIVE)))
                    .thenReturn(0L);

            List<KeyExchangePointDto> result = service.getPoints(USER_ID);

            assertThat(result).hasSize(2);
            assertThat(result.get(0).getId()).isEqualTo(1L);
            assertThat(result.get(0).getProvider()).isEqualTo("CLENZY_KEYVAULT");
            assertThat(result.get(0).getPropertyName()).isEqualTo("MaProp");
            assertThat(result.get(1).getProvider()).isEqualTo("KEYNEST");
        }

        @Test
        @DisplayName("empty list when no active points")
        void whenNoPoints_thenEmpty() {
            when(pointRepository.findByStatus(PointStatus.ACTIVE)).thenReturn(List.of());
            assertThat(service.getPoints(USER_ID)).isEmpty();
        }
    }

    // ── createPoint ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("createPoint(userId, dto)")
    class CreatePoint {

        @Test
        @DisplayName("when property not found - throws IllegalArgumentException")
        void whenPropertyMissing_thenThrows() {
            CreateKeyExchangePointDto dto = createPointDto("KEYNEST");
            when(propertyRepository.findById(20L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.createPoint(USER_ID, dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Propriete introuvable");
        }

        @Test
        @DisplayName("when invalid provider - throws IllegalArgumentException")
        void whenInvalidProvider_thenThrows() {
            CreateKeyExchangePointDto dto = createPointDto("INVALID");
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property(20L, "X")));

            assertThatThrownBy(() -> service.createPoint(USER_ID, dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Provider invalide");
        }

        @Test
        @DisplayName("when KEYNEST provider - saves with provider, no verification token")
        void whenKeynest_thenNoVerificationToken() {
            CreateKeyExchangePointDto dto = createPointDto("KEYNEST");
            dto.setProviderStoreId("KN-STORE-999");

            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property(20L, "MaProp")));
            when(pointRepository.save(any())).thenAnswer(inv -> {
                KeyExchangePoint p = inv.getArgument(0);
                p.setId(50L);
                return p;
            });

            KeyExchangePointDto result = service.createPoint(USER_ID, dto);

            ArgumentCaptor<KeyExchangePoint> captor = ArgumentCaptor.forClass(KeyExchangePoint.class);
            verify(pointRepository).save(captor.capture());

            KeyExchangePoint saved = captor.getValue();
            assertThat(saved.getProvider()).isEqualTo(Provider.KEYNEST);
            assertThat(saved.getProviderStoreId()).isEqualTo("KN-STORE-999");
            assertThat(saved.getUserId()).isEqualTo(USER_ID);
            assertThat(saved.getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(saved.getVerificationToken()).isNull();
            assertThat(saved.getGuardianType()).isNull();
            assertThat(saved.getStoreName()).isEqualTo("Tabac Café");
            assertThat(result.getId()).isEqualTo(50L);
        }

        @Test
        @DisplayName("when CLENZY_KEYVAULT - default MERCHANT + verification token generated")
        void whenClenzyKeyVault_thenDefaultsMerchantAndToken() {
            CreateKeyExchangePointDto dto = createPointDto("CLENZY_KEYVAULT");

            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property(20L, "X")));
            when(pointRepository.save(any())).thenAnswer(inv -> {
                KeyExchangePoint p = inv.getArgument(0);
                p.setId(51L);
                return p;
            });

            service.createPoint(USER_ID, dto);

            ArgumentCaptor<KeyExchangePoint> captor = ArgumentCaptor.forClass(KeyExchangePoint.class);
            verify(pointRepository).save(captor.capture());

            KeyExchangePoint saved = captor.getValue();
            assertThat(saved.getProvider()).isEqualTo(Provider.CLENZY_KEYVAULT);
            assertThat(saved.getGuardianType()).isEqualTo(GuardianType.MERCHANT);
            assertThat(saved.getVerificationToken()).isNotBlank();
            assertThat(saved.getVerificationToken()).doesNotContain("-");
            assertThat(saved.getVerificationToken().length()).isGreaterThan(20);
        }

        @Test
        @DisplayName("when CLENZY_KEYVAULT with INDIVIDUAL guardian - sets INDIVIDUAL")
        void whenClenzyKeyVault_thenIndividualGuardian() {
            CreateKeyExchangePointDto dto = createPointDto("CLENZY_KEYVAULT");
            dto.setGuardianType("INDIVIDUAL");

            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property(20L, "X")));
            when(pointRepository.save(any())).thenAnswer(inv -> {
                KeyExchangePoint p = inv.getArgument(0);
                p.setId(52L);
                return p;
            });

            service.createPoint(USER_ID, dto);

            ArgumentCaptor<KeyExchangePoint> captor = ArgumentCaptor.forClass(KeyExchangePoint.class);
            verify(pointRepository).save(captor.capture());
            assertThat(captor.getValue().getGuardianType()).isEqualTo(GuardianType.INDIVIDUAL);
        }

        @Test
        @DisplayName("when CLENZY_KEYVAULT + invalid guardian - throws IllegalArgumentException")
        void whenInvalidGuardian_thenThrows() {
            CreateKeyExchangePointDto dto = createPointDto("CLENZY_KEYVAULT");
            dto.setGuardianType("OTHER");

            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property(20L, "X")));

            assertThatThrownBy(() -> service.createPoint(USER_ID, dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Type de gardien invalide");
        }
    }

    // ── deletePoint ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("deletePoint(userId, pointId)")
    class DeletePoint {

        @Test
        @DisplayName("when found and owned - deletes")
        void whenFoundAndOwned_thenDeletes() {
            KeyExchangePoint p = point(50L, Provider.KEYNEST);
            when(pointRepository.findByIdAndUserId(50L, USER_ID)).thenReturn(Optional.of(p));

            service.deletePoint(USER_ID, 50L);

            verify(pointRepository).delete(p);
        }

        @Test
        @DisplayName("when not found / not owned - throws IllegalArgumentException")
        void whenNotFound_thenThrows() {
            when(pointRepository.findByIdAndUserId(99L, USER_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deletePoint(USER_ID, 99L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Point d'echange introuvable");
        }
    }

    // ── getActiveCodesByPoint ────────────────────────────────────────────────

    @Nested
    @DisplayName("getActiveCodesByPoint(pointId)")
    class GetActiveCodes {

        @Test
        @DisplayName("returns active codes mapped to DTOs")
        void whenCalled_thenReturnsCodes() {
            KeyExchangeCode c1 = code(1L, 50L, "123456", CodeStatus.ACTIVE);

            when(codeRepository.findByPointIdAndStatus(50L, CodeStatus.ACTIVE))
                    .thenReturn(List.of(c1));
            when(pointRepository.findById(50L))
                    .thenReturn(Optional.of(point(50L, Provider.CLENZY_KEYVAULT)));

            List<KeyExchangeCodeDto> result = service.getActiveCodesByPoint(50L);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getId()).isEqualTo(1L);
            assertThat(result.get(0).getCode()).isEqualTo("123456");
            assertThat(result.get(0).getStatus()).isEqualTo("ACTIVE");
        }

        @Test
        @DisplayName("empty when no codes")
        void whenNoCodes_thenEmpty() {
            when(codeRepository.findByPointIdAndStatus(50L, CodeStatus.ACTIVE))
                    .thenReturn(List.of());
            assertThat(service.getActiveCodesByPoint(50L)).isEmpty();
        }
    }

    // ── generateCode ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("generateCode(userId, dto)")
    class GenerateCode {

        @Test
        @DisplayName("when point not found - throws IllegalArgumentException")
        void whenPointMissing_thenThrows() {
            CreateKeyExchangeCodeDto dto = new CreateKeyExchangeCodeDto();
            dto.setPointId(99L);

            when(pointRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.generateCode(USER_ID, dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Point d'echange introuvable");
        }

        @Test
        @DisplayName("when invalid codeType - throws IllegalArgumentException")
        void whenInvalidCodeType_thenThrows() {
            CreateKeyExchangeCodeDto dto = new CreateKeyExchangeCodeDto();
            dto.setPointId(50L);
            dto.setCodeType("INVALID");

            when(pointRepository.findById(50L))
                    .thenReturn(Optional.of(point(50L, Provider.CLENZY_KEYVAULT)));

            assertThatThrownBy(() -> service.generateCode(USER_ID, dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Type de code invalide");
        }

        @Test
        @DisplayName("when CLENZY_KEYVAULT - generates 6-digit code & saves event")
        void whenClenzyKeyVault_thenSixDigitsCode() {
            CreateKeyExchangeCodeDto dto = new CreateKeyExchangeCodeDto();
            dto.setPointId(50L);
            dto.setGuestName("Jean Voyageur");
            dto.setValidUntil(LocalDateTime.now().plusDays(2));

            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            when(pointRepository.findById(50L)).thenReturn(Optional.of(p));
            when(codeRepository.findByCode(any())).thenReturn(Optional.empty());
            when(codeRepository.save(any())).thenAnswer(inv -> {
                KeyExchangeCode c = inv.getArgument(0);
                c.setId(100L);
                return c;
            });

            KeyExchangeCodeDto result = service.generateCode(USER_ID, dto);

            ArgumentCaptor<KeyExchangeCode> codeCaptor = ArgumentCaptor.forClass(KeyExchangeCode.class);
            verify(codeRepository).save(codeCaptor.capture());

            KeyExchangeCode saved = codeCaptor.getValue();
            assertThat(saved.getCode()).matches("\\d{6}");
            assertThat(saved.getStatus()).isEqualTo(CodeStatus.ACTIVE);
            assertThat(saved.getCodeType()).isEqualTo(CodeType.COLLECTION);
            assertThat(saved.getGuestName()).isEqualTo("Jean Voyageur");
            assertThat(saved.getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(saved.getPointId()).isEqualTo(50L);
            assertThat(saved.getValidFrom()).isNotNull();

            // event saved
            ArgumentCaptor<KeyExchangeEvent> eventCaptor = ArgumentCaptor.forClass(KeyExchangeEvent.class);
            verify(eventRepository).save(eventCaptor.capture());
            assertThat(eventCaptor.getValue().getEventType()).isEqualTo(EventType.CODE_GENERATED);
            assertThat(eventCaptor.getValue().getSource()).isEqualTo(EventSource.MANUAL);
            assertThat(result.getId()).isEqualTo(100L);
        }

        @Test
        @DisplayName("when KEYNEST - generates 'KN-' prefixed code")
        void whenKeynest_thenPrefixedCode() {
            CreateKeyExchangeCodeDto dto = new CreateKeyExchangeCodeDto();
            dto.setPointId(50L);
            dto.setGuestName("Visitor");

            KeyExchangePoint p = point(50L, Provider.KEYNEST);
            when(pointRepository.findById(50L)).thenReturn(Optional.of(p));
            when(codeRepository.findByCode(any())).thenReturn(Optional.empty());
            when(codeRepository.save(any())).thenAnswer(inv -> {
                KeyExchangeCode c = inv.getArgument(0);
                c.setId(101L);
                return c;
            });

            service.generateCode(USER_ID, dto);

            ArgumentCaptor<KeyExchangeCode> captor = ArgumentCaptor.forClass(KeyExchangeCode.class);
            verify(codeRepository).save(captor.capture());
            assertThat(captor.getValue().getCode()).startsWith("KN-");
            assertThat(captor.getValue().getCode()).matches("KN-\\d{6}");
        }

        @Test
        @DisplayName("when explicit DROP_OFF code type - sets correctly")
        void whenDropOff_thenSet() {
            CreateKeyExchangeCodeDto dto = new CreateKeyExchangeCodeDto();
            dto.setPointId(50L);
            dto.setCodeType("DROP_OFF");

            when(pointRepository.findById(50L))
                    .thenReturn(Optional.of(point(50L, Provider.CLENZY_KEYVAULT)));
            when(codeRepository.findByCode(any())).thenReturn(Optional.empty());
            when(codeRepository.save(any())).thenAnswer(inv -> {
                KeyExchangeCode c = inv.getArgument(0);
                c.setId(102L);
                return c;
            });

            service.generateCode(USER_ID, dto);

            ArgumentCaptor<KeyExchangeCode> captor = ArgumentCaptor.forClass(KeyExchangeCode.class);
            verify(codeRepository).save(captor.capture());
            assertThat(captor.getValue().getCodeType()).isEqualTo(CodeType.DROP_OFF);
        }

        @Test
        @DisplayName("when validFrom omitted - defaults to now")
        void whenValidFromOmitted_thenNow() {
            CreateKeyExchangeCodeDto dto = new CreateKeyExchangeCodeDto();
            dto.setPointId(50L);

            when(pointRepository.findById(50L))
                    .thenReturn(Optional.of(point(50L, Provider.CLENZY_KEYVAULT)));
            when(codeRepository.findByCode(any())).thenReturn(Optional.empty());
            when(codeRepository.save(any())).thenAnswer(inv -> {
                KeyExchangeCode c = inv.getArgument(0);
                c.setId(103L);
                return c;
            });

            LocalDateTime before = LocalDateTime.now().minusSeconds(1);
            service.generateCode(USER_ID, dto);

            ArgumentCaptor<KeyExchangeCode> captor = ArgumentCaptor.forClass(KeyExchangeCode.class);
            verify(codeRepository).save(captor.capture());
            assertThat(captor.getValue().getValidFrom()).isAfter(before);
        }

        @Test
        @DisplayName("when code collisions exhausted - falls back to 8-digit code")
        void whenCollisionsExhausted_thenFallback8digits() {
            CreateKeyExchangeCodeDto dto = new CreateKeyExchangeCodeDto();
            dto.setPointId(50L);

            when(pointRepository.findById(50L))
                    .thenReturn(Optional.of(point(50L, Provider.CLENZY_KEYVAULT)));

            // Simulate every 6-digit attempt collides → fall back to 8 digits
            KeyExchangeCode existing = new KeyExchangeCode();
            existing.setId(999L);
            when(codeRepository.findByCode(any())).thenReturn(Optional.of(existing));
            when(codeRepository.save(any())).thenAnswer(inv -> {
                KeyExchangeCode c = inv.getArgument(0);
                c.setId(104L);
                return c;
            });

            service.generateCode(USER_ID, dto);

            ArgumentCaptor<KeyExchangeCode> captor = ArgumentCaptor.forClass(KeyExchangeCode.class);
            verify(codeRepository).save(captor.capture());
            // Fallback 8-digit zero-padded
            assertThat(captor.getValue().getCode()).matches("\\d{8}");
        }
    }

    // ── cancelCode ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("cancelCode(userId, codeId)")
    class CancelCode {

        @Test
        @DisplayName("when found and ACTIVE - cancels and creates event")
        void whenActive_thenCancels() {
            KeyExchangeCode c = code(100L, 50L, "123456", CodeStatus.ACTIVE);
            when(codeRepository.findById(100L)).thenReturn(Optional.of(c));

            service.cancelCode(USER_ID, 100L);

            assertThat(c.getStatus()).isEqualTo(CodeStatus.CANCELLED);
            verify(codeRepository).save(c);

            ArgumentCaptor<KeyExchangeEvent> captor = ArgumentCaptor.forClass(KeyExchangeEvent.class);
            verify(eventRepository).save(captor.capture());
            assertThat(captor.getValue().getEventType()).isEqualTo(EventType.CODE_CANCELLED);
            assertThat(captor.getValue().getNotes()).contains(USER_ID);
        }

        @Test
        @DisplayName("when code not found - throws IllegalArgumentException")
        void whenMissing_thenThrows() {
            when(codeRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.cancelCode(USER_ID, 99L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Code introuvable");
        }

        @Test
        @DisplayName("when code not ACTIVE - throws IllegalStateException")
        void whenAlreadyUsed_thenThrows() {
            KeyExchangeCode c = code(100L, 50L, "123456", CodeStatus.USED);
            when(codeRepository.findById(100L)).thenReturn(Optional.of(c));

            assertThatThrownBy(() -> service.cancelCode(USER_ID, 100L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("USED");
            verify(codeRepository, never()).save(any());
        }
    }

    // ── verifyCodePublic ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("verifyCodePublic(token, code)")
    class VerifyCodePublic {

        @Test
        @DisplayName("when token invalid - throws IllegalArgumentException")
        void whenInvalidToken_thenThrows() {
            when(pointRepository.findByVerificationToken("BAD")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.verifyCodePublic("BAD", "123456"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Lien de verification invalide");
        }

        @Test
        @DisplayName("when code not found - throws IllegalArgumentException")
        void whenCodeMissing_thenThrows() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("XXXXXX")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.verifyCodePublic("token-xyz", "XXXXXX"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Code invalide");
        }

        @Test
        @DisplayName("when code does not belong to point - throws IllegalArgumentException")
        void whenCodePointMismatch_thenThrows() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            KeyExchangeCode c = code(1L, 99L, "123456", CodeStatus.ACTIVE);

            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("123456")).thenReturn(Optional.of(c));

            assertThatThrownBy(() -> service.verifyCodePublic("token-xyz", "123456"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Code invalide");
        }

        @Test
        @DisplayName("when ACTIVE and not expired - valid=true")
        void whenActiveNotExpired_thenValid() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            KeyExchangeCode c = code(1L, 50L, "123456", CodeStatus.ACTIVE);
            c.setGuestName("Alice");
            c.setValidUntil(LocalDateTime.now().plusDays(1));

            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("123456")).thenReturn(Optional.of(c));

            Map<String, Object> result = service.verifyCodePublic("token-xyz", "123456");

            assertThat(result.get("valid")).isEqualTo(true);
            assertThat(result.get("guestName")).isEqualTo("Alice");
            assertThat(result.get("status")).isEqualTo("ACTIVE");
            assertThat(result.get("codeType")).isEqualTo("COLLECTION");
            assertThat(result.get("storeName")).isEqualTo("Tabac du coin");
            assertThat(result.get("validUntil")).isNotNull();
        }

        @Test
        @DisplayName("when expired - valid=false")
        void whenExpired_thenInvalid() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            KeyExchangeCode c = code(1L, 50L, "123456", CodeStatus.ACTIVE);
            c.setValidUntil(LocalDateTime.now().minusDays(1));

            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("123456")).thenReturn(Optional.of(c));

            Map<String, Object> result = service.verifyCodePublic("token-xyz", "123456");

            assertThat(result.get("valid")).isEqualTo(false);
        }

        @Test
        @DisplayName("when CANCELLED - valid=false")
        void whenCancelled_thenInvalid() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            KeyExchangeCode c = code(1L, 50L, "123456", CodeStatus.CANCELLED);

            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("123456")).thenReturn(Optional.of(c));

            Map<String, Object> result = service.verifyCodePublic("token-xyz", "123456");

            assertThat(result.get("valid")).isEqualTo(false);
            assertThat(result.get("status")).isEqualTo("CANCELLED");
        }

        @Test
        @DisplayName("when guestName null - returns empty string")
        void whenNoGuestName_thenEmpty() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            KeyExchangeCode c = code(1L, 50L, "123456", CodeStatus.ACTIVE);
            c.setGuestName(null);

            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("123456")).thenReturn(Optional.of(c));

            Map<String, Object> result = service.verifyCodePublic("token-xyz", "123456");
            assertThat(result.get("guestName")).isEqualTo("");
        }
    }

    // ── confirmKeyMovement ───────────────────────────────────────────────────

    @Nested
    @DisplayName("confirmKeyMovement(token, code, action)")
    class ConfirmKeyMovement {

        @Test
        @DisplayName("when action 'collected' - sets collectedAt + USED + event KEY_COLLECTED")
        void whenCollected_thenSetsCollectedAtAndUsed() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            KeyExchangeCode c = code(1L, 50L, "123456", CodeStatus.ACTIVE);

            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("123456")).thenReturn(Optional.of(c));

            service.confirmKeyMovement("token-xyz", "123456", "collected");

            assertThat(c.getCollectedAt()).isNotNull();
            assertThat(c.getStatus()).isEqualTo(CodeStatus.USED);

            ArgumentCaptor<KeyExchangeEvent> captor = ArgumentCaptor.forClass(KeyExchangeEvent.class);
            verify(eventRepository).save(captor.capture());
            assertThat(captor.getValue().getEventType()).isEqualTo(EventType.KEY_COLLECTED);
            assertThat(captor.getValue().getSource()).isEqualTo(EventSource.PUBLIC_PAGE);
        }

        @Test
        @DisplayName("when action 'returned' - sets returnedAt + event KEY_RETURNED")
        void whenReturned_thenSetsReturnedAt() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            KeyExchangeCode c = code(1L, 50L, "123456", CodeStatus.USED);

            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("123456")).thenReturn(Optional.of(c));

            service.confirmKeyMovement("token-xyz", "123456", "returned");

            assertThat(c.getReturnedAt()).isNotNull();
            assertThat(c.getStatus()).isEqualTo(CodeStatus.USED); // unchanged

            ArgumentCaptor<KeyExchangeEvent> captor = ArgumentCaptor.forClass(KeyExchangeEvent.class);
            verify(eventRepository).save(captor.capture());
            assertThat(captor.getValue().getEventType()).isEqualTo(EventType.KEY_RETURNED);
        }

        @Test
        @DisplayName("when action 'deposited' - event KEY_DEPOSITED only")
        void whenDeposited_thenEventOnly() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            KeyExchangeCode c = code(1L, 50L, "123456", CodeStatus.ACTIVE);

            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("123456")).thenReturn(Optional.of(c));

            service.confirmKeyMovement("token-xyz", "123456", "deposited");

            ArgumentCaptor<KeyExchangeEvent> captor = ArgumentCaptor.forClass(KeyExchangeEvent.class);
            verify(eventRepository).save(captor.capture());
            assertThat(captor.getValue().getEventType()).isEqualTo(EventType.KEY_DEPOSITED);
            // Status / collectedAt / returnedAt untouched
            assertThat(c.getStatus()).isEqualTo(CodeStatus.ACTIVE);
            assertThat(c.getCollectedAt()).isNull();
            assertThat(c.getReturnedAt()).isNull();
        }

        @Test
        @DisplayName("when invalid action - throws IllegalArgumentException")
        void whenInvalidAction_thenThrows() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            KeyExchangeCode c = code(1L, 50L, "123456", CodeStatus.ACTIVE);

            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("123456")).thenReturn(Optional.of(c));

            assertThatThrownBy(() -> service.confirmKeyMovement("token-xyz", "123456", "stolen"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Action invalide");
        }

        @Test
        @DisplayName("when invalid token - throws IllegalArgumentException")
        void whenInvalidToken_thenThrows() {
            when(pointRepository.findByVerificationToken("BAD")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.confirmKeyMovement("BAD", "123456", "collected"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Lien de verification invalide");
        }

        @Test
        @DisplayName("when code does not belong to point - throws")
        void whenCodePointMismatch_thenThrows() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            KeyExchangeCode c = code(1L, 999L, "123456", CodeStatus.ACTIVE);

            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("123456")).thenReturn(Optional.of(c));

            assertThatThrownBy(() -> service.confirmKeyMovement("token-xyz", "123456", "collected"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Code invalide");
        }

        @Test
        @DisplayName("when action 'collected' on CANCELLED code - refuses (IllegalStateException), no save")
        void whenCollectedOnCancelled_thenRefuses() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            KeyExchangeCode c = code(1L, 50L, "123456", CodeStatus.CANCELLED);

            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("123456")).thenReturn(Optional.of(c));

            assertThatThrownBy(() -> service.confirmKeyMovement("token-xyz", "123456", "collected"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Code inactif ou expire");
            verify(codeRepository, never()).save(any());
            verify(eventRepository, never()).save(any());
        }

        @Test
        @DisplayName("when action 'collected' on expired code - refuses (IllegalStateException)")
        void whenCollectedOnExpired_thenRefuses() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            KeyExchangeCode c = code(1L, 50L, "123456", CodeStatus.ACTIVE);
            c.setValidUntil(LocalDateTime.now().minusDays(1));

            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("123456")).thenReturn(Optional.of(c));

            assertThatThrownBy(() -> service.confirmKeyMovement("token-xyz", "123456", "collected"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Code inactif ou expire");
            verify(codeRepository, never()).save(any());
        }
    }

    // ── brute-force throttle integration ─────────────────────────────────────

    @Nested
    @DisplayName("KeyVerificationThrottle integration (anti brute-force)")
    class Throttling {

        @Test
        @DisplayName("verifyCodePublic - locked token short-circuits before any lookup")
        void whenLocked_verify_thenPropagatesAndSkipsLookup() {
            doThrow(new TooManyVerificationAttemptsException(120))
                    .when(verificationThrottle).assertNotLocked("token-xyz");

            assertThatThrownBy(() -> service.verifyCodePublic("token-xyz", "123456"))
                    .isInstanceOf(TooManyVerificationAttemptsException.class);
            verify(pointRepository, never()).findByVerificationToken(any());
            verify(codeRepository, never()).findByCode(any());
        }

        @Test
        @DisplayName("verifyCodePublic - wrong code records a failed attempt, no reset")
        void whenWrongCode_thenRecordsFailure() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("000000")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.verifyCodePublic("token-xyz", "000000"))
                    .isInstanceOf(IllegalArgumentException.class);
            verify(verificationThrottle).recordFailure("token-xyz");
            verify(verificationThrottle, never()).reset(any());
        }

        @Test
        @DisplayName("verifyCodePublic - code of another point also records a failed attempt")
        void whenWrongPointCode_thenRecordsFailure() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            KeyExchangeCode c = code(1L, 999L, "123456", CodeStatus.ACTIVE);
            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("123456")).thenReturn(Optional.of(c));

            assertThatThrownBy(() -> service.verifyCodePublic("token-xyz", "123456"))
                    .isInstanceOf(IllegalArgumentException.class);
            verify(verificationThrottle).recordFailure("token-xyz");
        }

        @Test
        @DisplayName("verifyCodePublic - correct code resets the counter")
        void whenValidCode_thenResets() {
            KeyExchangePoint p = point(50L, Provider.CLENZY_KEYVAULT);
            KeyExchangeCode c = code(1L, 50L, "123456", CodeStatus.ACTIVE);
            when(pointRepository.findByVerificationToken("token-xyz")).thenReturn(Optional.of(p));
            when(codeRepository.findByCode("123456")).thenReturn(Optional.of(c));

            service.verifyCodePublic("token-xyz", "123456");

            verify(verificationThrottle).reset("token-xyz");
            verify(verificationThrottle, never()).recordFailure(any());
        }

        @Test
        @DisplayName("confirmKeyMovement - locked token short-circuits before any lookup")
        void whenLocked_confirm_thenPropagatesAndSkipsLookup() {
            doThrow(new TooManyVerificationAttemptsException(120))
                    .when(verificationThrottle).assertNotLocked("token-xyz");

            assertThatThrownBy(() -> service.confirmKeyMovement("token-xyz", "123456", "collected"))
                    .isInstanceOf(TooManyVerificationAttemptsException.class);
            verify(pointRepository, never()).findByVerificationToken(any());
        }
    }

    // ── getEvents ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getEvents(propertyId, page, size)")
    class GetEvents {

        @Test
        @DisplayName("when no propertyId - calls findAllByOrderByCreatedAtDesc")
        void whenNoProperty_thenAll() {
            KeyExchangeEvent ev = new KeyExchangeEvent();
            ev.setId(1L);
            ev.setOrganizationId(ORG_ID);
            ev.setPropertyId(20L);
            ev.setEventType(EventType.CODE_GENERATED);
            ev.setSource(EventSource.MANUAL);
            ev.setCodeId(10L);
            ev.setPointId(50L);

            Page<KeyExchangeEvent> page = new PageImpl<>(List.of(ev), PageRequest.of(0, 10), 1);
            when(eventRepository.findAllByOrderByCreatedAtDesc(any())).thenReturn(page);
            when(pointRepository.findById(50L))
                    .thenReturn(Optional.of(point(50L, Provider.CLENZY_KEYVAULT)));
            when(propertyRepository.findById(20L))
                    .thenReturn(Optional.of(property(20L, "MaProp")));

            Page<KeyExchangeEventDto> result = service.getEvents(null, 0, 10);

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).getId()).isEqualTo(1L);
            assertThat(result.getContent().get(0).getEventType()).isEqualTo("CODE_GENERATED");
            assertThat(result.getContent().get(0).getSource()).isEqualTo("MANUAL");
            assertThat(result.getContent().get(0).getPointName()).isEqualTo("Tabac du coin");
            assertThat(result.getContent().get(0).getPropertyName()).isEqualTo("MaProp");
        }

        @Test
        @DisplayName("when propertyId provided - calls findByPropertyIdOrderByCreatedAtDesc")
        void whenPropertyId_thenFiltered() {
            KeyExchangeEvent ev = new KeyExchangeEvent();
            ev.setId(2L);
            ev.setPropertyId(20L);
            ev.setEventType(EventType.KEY_COLLECTED);
            ev.setSource(EventSource.PUBLIC_PAGE);

            Page<KeyExchangeEvent> page = new PageImpl<>(List.of(ev), PageRequest.of(0, 5), 1);
            when(eventRepository.findByPropertyIdOrderByCreatedAtDesc(eq(20L), any()))
                    .thenReturn(page);
            when(propertyRepository.findById(20L))
                    .thenReturn(Optional.of(property(20L, "PropName")));

            Page<KeyExchangeEventDto> result = service.getEvents(20L, 0, 5);

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).getId()).isEqualTo(2L);
            assertThat(result.getContent().get(0).getEventType()).isEqualTo("KEY_COLLECTED");
            verify(eventRepository).findByPropertyIdOrderByCreatedAtDesc(eq(20L), any());
        }
    }
}
