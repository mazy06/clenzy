package com.clenzy.service.voucher;

import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.UnauthorizedException;
import com.clenzy.exception.VoucherException;
import com.clenzy.model.BookingVoucher;
import com.clenzy.model.Organization;
import com.clenzy.model.Property;
import com.clenzy.model.VoucherPropertyScope;
import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.model.voucher.VoucherCreatorOrgType;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.model.voucher.VoucherType;
import com.clenzy.repository.BookingVoucherRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.VoucherPropertyScopeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires complets pour {@link BookingVoucherService}.
 *
 * <p>Couvre :
 * <ul>
 *   <li>create : payload validation, permissions HOST vs MANAGEMENT_ORG,
 *       code uniqueness, property ownership cross-org</li>
 *   <li>update : transitions, scope changes, EXPIRED non-modifiable,
 *       fix H3 (scope vide existant)</li>
 *   <li>delete : usage_count guard</li>
 *   <li>setStatus : transitions valides + interdites + EXPIRED immuable</li>
 *   <li>findOrThrow : ownership defense in depth</li>
 *   <li>canCreateVoucherForProperty : permission helper</li>
 *   <li>getScopedPropertyIdsBatch : batch lookup (fix H2)</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BookingVoucherServiceTest {

    @Mock private BookingVoucherRepository voucherRepo;
    @Mock private VoucherPropertyScopeRepository scopeRepo;
    @Mock private PropertyRepository propertyRepo;
    @Mock private OrganizationRepository orgRepo;

    private BookingVoucherService service;

    private static final Long ORG_ID = 100L;
    private static final Long USER_ID = 200L;
    private static final Long PROPERTY_ID = 300L;
    private static final Long PROPERTY_ID_2 = 301L;
    private static final Long VOUCHER_ID = 42L;

    @BeforeEach
    void setUp() {
        service = new BookingVoucherService(voucherRepo, scopeRepo, propertyRepo, orgRepo);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private VoucherCreatePayload basePayload() {
        return new VoucherCreatePayload(
            "Test voucher",
            "Desc",
            "WELCOME20",
            VoucherType.MANUAL_CODE,
            VoucherDiscountType.PERCENTAGE,
            new BigDecimal("20"),
            null, null,
            null, null, null,
            null, 1,
            VoucherChannelScope.ALL,
            VoucherStatus.DRAFT,
            List.of(PROPERTY_ID)
        );
    }

    private Property property(Long id, Long orgId) {
        Property p = new Property();
        p.setId(id);
        p.setOrganizationId(orgId);
        return p;
    }

    private BookingVoucher voucher(Long id, Long orgId, VoucherStatus status) {
        BookingVoucher v = new BookingVoucher();
        v.setId(id);
        v.setOrganizationId(orgId);
        v.setCode("WELCOME20");
        v.setType(VoucherType.MANUAL_CODE);
        v.setDiscountType(VoucherDiscountType.PERCENTAGE);
        v.setDiscountValue(new BigDecimal("20"));
        v.setStatus(status);
        v.setUsageCount(0);
        v.setName("Test voucher");
        return v;
    }

    private Organization orgWithContract(boolean contract) {
        Organization o = new Organization();
        o.setHasVoucherContract(contract);
        return o;
    }

    // ─── CREATE ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("create")
    class Create {

        @Test
        @DisplayName("HOST cree avec succes sur property de son org")
        void createHostHappy() {
            when(propertyRepo.findAllById(List.of(PROPERTY_ID)))
                .thenReturn(List.of(property(PROPERTY_ID, ORG_ID)));
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "WELCOME20"))
                .thenReturn(Optional.empty());
            when(voucherRepo.save(any(BookingVoucher.class)))
                .thenAnswer(inv -> {
                    BookingVoucher v = inv.getArgument(0);
                    v.setId(VOUCHER_ID);
                    return v;
                });

            BookingVoucher result = service.create(ORG_ID, USER_ID, VoucherCreatorOrgType.HOST, basePayload());
            assertThat(result.getId()).isEqualTo(VOUCHER_ID);
            assertThat(result.getCreatedByOrgType()).isEqualTo(VoucherCreatorOrgType.HOST);
            assertThat(result.getCreatedByUserId()).isEqualTo(USER_ID);
            assertThat(result.getCode()).isEqualTo("WELCOME20");
            verify(scopeRepo).save(any(VoucherPropertyScope.class));
        }

        @Test
        @DisplayName("payload null leve VoucherException")
        void payloadNull() {
            assertThatThrownBy(() -> service.create(ORG_ID, USER_ID, VoucherCreatorOrgType.HOST, null))
                .isInstanceOf(VoucherException.class)
                .hasMessageContaining("Payload");
        }

        @Test
        @DisplayName("name blank leve VoucherException")
        void nameBlank() {
            VoucherCreatePayload p = new VoucherCreatePayload(
                "  ", null, "X", VoucherType.MANUAL_CODE, VoucherDiscountType.PERCENTAGE,
                new BigDecimal("10"), null, null, null, null, null, null, null,
                null, null, null
            );
            assertThatThrownBy(() -> service.create(ORG_ID, USER_ID, VoucherCreatorOrgType.HOST, p))
                .isInstanceOf(VoucherException.class)
                .hasMessageContaining("name");
        }

        @Test
        @DisplayName("PERCENTAGE > 100 leve VoucherException")
        void percentageTooBig() {
            VoucherCreatePayload p = new VoucherCreatePayload(
                "Test", null, "X", VoucherType.MANUAL_CODE, VoucherDiscountType.PERCENTAGE,
                new BigDecimal("150"), null, null, null, null, null, null, null,
                null, null, null
            );
            assertThatThrownBy(() -> service.create(ORG_ID, USER_ID, VoucherCreatorOrgType.HOST, p))
                .isInstanceOf(VoucherException.class)
                .hasMessageContaining("PERCENTAGE");
        }

        @Test
        @DisplayName("MANUAL_CODE sans code leve VoucherException")
        void manualCodeMissing() {
            VoucherCreatePayload p = new VoucherCreatePayload(
                "Test", null, null, VoucherType.MANUAL_CODE, VoucherDiscountType.PERCENTAGE,
                new BigDecimal("10"), null, null, null, null, null, null, null,
                null, null, null
            );
            assertThatThrownBy(() -> service.create(ORG_ID, USER_ID, VoucherCreatorOrgType.HOST, p))
                .isInstanceOf(VoucherException.class)
                .hasMessageContaining("code requis");
        }

        @Test
        @DisplayName("validFrom > validUntil leve VoucherException")
        void periodInverted() {
            VoucherCreatePayload p = new VoucherCreatePayload(
                "Test", null, "X", VoucherType.MANUAL_CODE, VoucherDiscountType.PERCENTAGE,
                new BigDecimal("10"),
                java.time.Instant.parse("2027-01-01T00:00:00Z"),
                java.time.Instant.parse("2026-01-01T00:00:00Z"),
                null, null, null, null, null, null, null, null
            );
            assertThatThrownBy(() -> service.create(ORG_ID, USER_ID, VoucherCreatorOrgType.HOST, p))
                .isInstanceOf(VoucherException.class)
                .hasMessageContaining("validFrom");
        }

        @Test
        @DisplayName("Property d'une autre org leve UnauthorizedException")
        void propertyCrossOrg() {
            when(propertyRepo.findAllById(List.of(PROPERTY_ID)))
                .thenReturn(List.of(property(PROPERTY_ID, 999L))); // org differente
            assertThatThrownBy(() -> service.create(ORG_ID, USER_ID,
                VoucherCreatorOrgType.HOST, basePayload()))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("hors de l'organisation");
        }

        @Test
        @DisplayName("Property ids manquants en DB leve VoucherException")
        void propertyMissing() {
            // payload demande 1 property, DB en retourne 0
            when(propertyRepo.findAllById(List.of(PROPERTY_ID))).thenReturn(List.of());
            assertThatThrownBy(() -> service.create(ORG_ID, USER_ID,
                VoucherCreatorOrgType.HOST, basePayload()))
                .isInstanceOf(VoucherException.class)
                .hasMessageContaining("introuvables");
        }

        @Test
        @DisplayName("Code deja utilise leve VoucherException")
        void codeDuplicate() {
            when(propertyRepo.findAllById(List.of(PROPERTY_ID)))
                .thenReturn(List.of(property(PROPERTY_ID, ORG_ID)));
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "WELCOME20"))
                .thenReturn(Optional.of(voucher(99L, ORG_ID, VoucherStatus.ACTIVE)));
            assertThatThrownBy(() -> service.create(ORG_ID, USER_ID,
                VoucherCreatorOrgType.HOST, basePayload()))
                .isInstanceOf(VoucherException.class)
                .hasMessageContaining("deja utilise");
        }

        @Test
        @DisplayName("MANUAL_CODE : code stocke en UPPER + trim")
        void codeNormalized() {
            VoucherCreatePayload p = new VoucherCreatePayload(
                "Test", null, "  welcome20  ", VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, new BigDecimal("10"),
                null, null, null, null, null, null, 1,
                VoucherChannelScope.ALL, VoucherStatus.DRAFT, List.of(PROPERTY_ID)
            );
            when(propertyRepo.findAllById(List.of(PROPERTY_ID)))
                .thenReturn(List.of(property(PROPERTY_ID, ORG_ID)));
            when(voucherRepo.findByOrgAndCodeIgnoreCase(anyLong(), any())).thenReturn(Optional.empty());
            when(voucherRepo.save(any(BookingVoucher.class))).thenAnswer(inv -> inv.getArgument(0));

            BookingVoucher result = service.create(ORG_ID, USER_ID, VoucherCreatorOrgType.HOST, p);
            assertThat(result.getCode()).isEqualTo("WELCOME20");
        }

        @Test
        @DisplayName("MANAGEMENT_ORG sans has_voucher_contract → Unauthorized")
        void mgmtOrgNoContract() {
            when(propertyRepo.findAllById(List.of(PROPERTY_ID)))
                .thenReturn(List.of(property(PROPERTY_ID, ORG_ID)));
            when(orgRepo.findById(ORG_ID)).thenReturn(Optional.of(orgWithContract(false)));
            when(voucherRepo.findByOrgAndCodeIgnoreCase(anyLong(), any())).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.create(ORG_ID, USER_ID,
                VoucherCreatorOrgType.MANAGEMENT_ORG, basePayload()))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("contrat voucher actif");
        }

        @Test
        @DisplayName("MANAGEMENT_ORG sans property.org_can_create_vouchers → Unauthorized")
        void mgmtOrgNoConsent() {
            Property p = property(PROPERTY_ID, ORG_ID);
            p.setOrgCanCreateVouchers(false);
            when(propertyRepo.findAllById(List.of(PROPERTY_ID))).thenReturn(List.of(p));
            when(orgRepo.findById(ORG_ID)).thenReturn(Optional.of(orgWithContract(true)));
            when(voucherRepo.findByOrgAndCodeIgnoreCase(anyLong(), any())).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.create(ORG_ID, USER_ID,
                VoucherCreatorOrgType.MANAGEMENT_ORG, basePayload()))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("n'a pas autorise");
        }

        @Test
        @DisplayName("MANAGEMENT_ORG scope vide → Unauthorized (V1 explicit scope obligatoire)")
        void mgmtOrgEmptyScope() {
            VoucherCreatePayload p = new VoucherCreatePayload(
                "Test", null, "X", VoucherType.MANUAL_CODE, VoucherDiscountType.PERCENTAGE,
                new BigDecimal("10"), null, null, null, null, null, null, 1,
                VoucherChannelScope.ALL, VoucherStatus.DRAFT, List.of()
            );
            when(orgRepo.findById(ORG_ID)).thenReturn(Optional.of(orgWithContract(true)));
            when(voucherRepo.findByOrgAndCodeIgnoreCase(anyLong(), any())).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.create(ORG_ID, USER_ID,
                VoucherCreatorOrgType.MANAGEMENT_ORG, p))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("scope non vide");
        }

        @Test
        @DisplayName("MANAGEMENT_ORG happy path (contrat + consentement par-property)")
        void mgmtOrgHappy() {
            Property p = property(PROPERTY_ID, ORG_ID);
            p.setOrgCanCreateVouchers(true);
            when(propertyRepo.findAllById(List.of(PROPERTY_ID))).thenReturn(List.of(p));
            when(orgRepo.findById(ORG_ID)).thenReturn(Optional.of(orgWithContract(true)));
            when(voucherRepo.findByOrgAndCodeIgnoreCase(anyLong(), any())).thenReturn(Optional.empty());
            when(voucherRepo.save(any(BookingVoucher.class))).thenAnswer(inv -> {
                BookingVoucher v = inv.getArgument(0);
                v.setId(VOUCHER_ID);
                return v;
            });

            BookingVoucher result = service.create(ORG_ID, USER_ID,
                VoucherCreatorOrgType.MANAGEMENT_ORG, basePayload());
            assertThat(result.getCreatedByOrgType()).isEqualTo(VoucherCreatorOrgType.MANAGEMENT_ORG);
        }
    }

    // ─── UPDATE ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("update")
    class Update {

        @Test
        @DisplayName("EXPIRED non-modifiable")
        void expiredImmutable() {
            BookingVoucher existing = voucher(VOUCHER_ID, ORG_ID, VoucherStatus.EXPIRED);
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(existing));

            VoucherUpdatePayload p = new VoucherUpdatePayload(
                "New name", null, null, null, null, null, null, null, null,
                null, null, null, null, null, null
            );
            assertThatThrownBy(() -> service.update(VOUCHER_ID, ORG_ID, USER_ID,
                VoucherCreatorOrgType.HOST, p))
                .isInstanceOf(VoucherException.class)
                .hasMessageContaining("non modifiable");
        }

        @Test
        @DisplayName("Fix H3 : update scope vide existant ne casse pas pour MANAGEMENT_ORG")
        void emptyScopeExistingNotBroken() {
            BookingVoucher existing = voucher(VOUCHER_ID, ORG_ID, VoucherStatus.ACTIVE);
            existing.setCreatedByOrgType(VoucherCreatorOrgType.HOST);
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(existing));
            // Scope existant vide (= toutes les properties), payload n'y touche pas
            when(scopeRepo.findPropertyIdsByVoucherId(VOUCHER_ID)).thenReturn(Set.of());
            when(voucherRepo.save(any(BookingVoucher.class))).thenAnswer(inv -> inv.getArgument(0));

            // L'update juste un champ name, sans toucher au scope
            VoucherUpdatePayload p = new VoucherUpdatePayload(
                "Updated name", null, null, null, null, null, null, null, null,
                null, null, null, null, null, null  // propertyIds = null = pas de changement
            );
            // Avant fix H3 : MANAGEMENT_ORG sur scope vide existant → UnauthorizedException
            BookingVoucher result = service.update(VOUCHER_ID, ORG_ID, USER_ID,
                VoucherCreatorOrgType.MANAGEMENT_ORG, p);
            assertThat(result.getName()).isEqualTo("Updated name");
        }

        @Test
        @DisplayName("update happy path : name + code uniqueness verifie")
        void updateHappy() {
            BookingVoucher existing = voucher(VOUCHER_ID, ORG_ID, VoucherStatus.DRAFT);
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(existing));
            when(scopeRepo.findPropertyIdsByVoucherId(VOUCHER_ID)).thenReturn(Set.of(PROPERTY_ID));
            when(propertyRepo.findAllById(anyList()))
                .thenReturn(List.of(property(PROPERTY_ID, ORG_ID)));
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "NEW10"))
                .thenReturn(Optional.empty());
            when(voucherRepo.save(any(BookingVoucher.class))).thenAnswer(inv -> inv.getArgument(0));

            VoucherUpdatePayload p = new VoucherUpdatePayload(
                "Renamed", null, "new10", null, new BigDecimal("15"),
                null, null, null, null, null, null, null, null, null, null
            );
            BookingVoucher result = service.update(VOUCHER_ID, ORG_ID, USER_ID,
                VoucherCreatorOrgType.HOST, p);
            assertThat(result.getName()).isEqualTo("Renamed");
            assertThat(result.getCode()).isEqualTo("NEW10");
            assertThat(result.getDiscountValue()).isEqualByComparingTo("15");
        }

        @Test
        @DisplayName("update vers EXPIRED interdit (geree par scheduler)")
        void cantSetExpiredManually() {
            BookingVoucher existing = voucher(VOUCHER_ID, ORG_ID, VoucherStatus.ACTIVE);
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(existing));
            when(scopeRepo.findPropertyIdsByVoucherId(VOUCHER_ID)).thenReturn(Set.of(PROPERTY_ID));
            when(propertyRepo.findAllById(anyList()))
                .thenReturn(List.of(property(PROPERTY_ID, ORG_ID)));

            VoucherUpdatePayload p = new VoucherUpdatePayload(
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, VoucherStatus.EXPIRED, null
            );
            assertThatThrownBy(() -> service.update(VOUCHER_ID, ORG_ID, USER_ID,
                VoucherCreatorOrgType.HOST, p))
                .isInstanceOf(VoucherException.class)
                .hasMessageContaining("EXPIRED");
        }
    }

    // ─── DELETE ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("delete")
    class Delete {

        @Test
        @DisplayName("usage_count > 0 → refuse")
        void cantDeleteUsed() {
            BookingVoucher v = voucher(VOUCHER_ID, ORG_ID, VoucherStatus.ACTIVE);
            v.setUsageCount(3);
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(v));

            assertThatThrownBy(() -> service.delete(VOUCHER_ID, ORG_ID))
                .isInstanceOf(VoucherException.class)
                .hasMessageContaining("3 fois");
            verify(voucherRepo, never()).delete(any());
        }

        @Test
        @DisplayName("usage_count = 0 → OK")
        void deleteUnused() {
            BookingVoucher v = voucher(VOUCHER_ID, ORG_ID, VoucherStatus.DRAFT);
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(v));

            service.delete(VOUCHER_ID, ORG_ID);
            verify(voucherRepo).delete(v);
        }
    }

    // ─── setStatus ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("setStatus")
    class SetStatus {

        @Test
        @DisplayName("DRAFT → ACTIVE OK")
        void draftToActive() {
            BookingVoucher v = voucher(VOUCHER_ID, ORG_ID, VoucherStatus.DRAFT);
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(v));
            when(voucherRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            BookingVoucher result = service.setStatus(VOUCHER_ID, ORG_ID, VoucherStatus.ACTIVE);
            assertThat(result.getStatus()).isEqualTo(VoucherStatus.ACTIVE);
        }

        @Test
        @DisplayName("ACTIVE → PAUSED OK")
        void activeToPaused() {
            BookingVoucher v = voucher(VOUCHER_ID, ORG_ID, VoucherStatus.ACTIVE);
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(v));
            when(voucherRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            BookingVoucher result = service.setStatus(VOUCHER_ID, ORG_ID, VoucherStatus.PAUSED);
            assertThat(result.getStatus()).isEqualTo(VoucherStatus.PAUSED);
        }

        @Test
        @DisplayName("EXPIRED → anything : interdit (status immuable)")
        void expiredImmutable() {
            BookingVoucher v = voucher(VOUCHER_ID, ORG_ID, VoucherStatus.EXPIRED);
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(v));

            assertThatThrownBy(() -> service.setStatus(VOUCHER_ID, ORG_ID, VoucherStatus.ACTIVE))
                .isInstanceOf(VoucherException.class)
                .hasMessageContaining("EXPIRED non modifiable");
        }

        @Test
        @DisplayName("→ EXPIRED interdit (reserve au scheduler)")
        void cantSetExpiredManually() {
            BookingVoucher v = voucher(VOUCHER_ID, ORG_ID, VoucherStatus.ACTIVE);
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(v));

            assertThatThrownBy(() -> service.setStatus(VOUCHER_ID, ORG_ID, VoucherStatus.EXPIRED))
                .isInstanceOf(VoucherException.class)
                .hasMessageContaining("EXPIRED est applique automatiquement");
        }
    }

    // ─── findOrThrow + canCreateVoucherForProperty ───────────────────────────

    @Nested
    @DisplayName("findOrThrow")
    class FindOrThrow {

        @Test
        @DisplayName("voucher inconnu → NotFoundException")
        void notFound() {
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.findOrThrow(VOUCHER_ID, ORG_ID))
                .isInstanceOf(NotFoundException.class);
        }

        @Test
        @DisplayName("voucher d'une autre org → UnauthorizedException (defense in depth)")
        void crossOrg() {
            BookingVoucher v = voucher(VOUCHER_ID, 999L, VoucherStatus.ACTIVE);
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(v));
            assertThatThrownBy(() -> service.findOrThrow(VOUCHER_ID, ORG_ID))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("hors de votre organisation");
        }
    }

    @Nested
    @DisplayName("canCreateVoucherForProperty")
    class CanCreateForProperty {

        @Test
        @DisplayName("HOST OK si property est dans son org")
        void hostOwnOrg() {
            Property p = property(PROPERTY_ID, ORG_ID);
            assertThat(service.canCreateVoucherForProperty(ORG_ID, p, VoucherCreatorOrgType.HOST)).isTrue();
        }

        @Test
        @DisplayName("HOST refuse si property d'une autre org")
        void hostCrossOrg() {
            Property p = property(PROPERTY_ID, 999L);
            assertThat(service.canCreateVoucherForProperty(ORG_ID, p, VoucherCreatorOrgType.HOST)).isFalse();
        }

        @Test
        @DisplayName("MANAGEMENT_ORG OK si contrat + consentement")
        void mgmtAllFlags() {
            Property p = property(PROPERTY_ID, ORG_ID);
            p.setOrgCanCreateVouchers(true);
            when(orgRepo.findById(ORG_ID)).thenReturn(Optional.of(orgWithContract(true)));
            assertThat(service.canCreateVoucherForProperty(ORG_ID, p, VoucherCreatorOrgType.MANAGEMENT_ORG)).isTrue();
        }

        @Test
        @DisplayName("MANAGEMENT_ORG refuse si pas de contrat")
        void mgmtNoContract() {
            Property p = property(PROPERTY_ID, ORG_ID);
            p.setOrgCanCreateVouchers(true);
            when(orgRepo.findById(ORG_ID)).thenReturn(Optional.of(orgWithContract(false)));
            assertThat(service.canCreateVoucherForProperty(ORG_ID, p, VoucherCreatorOrgType.MANAGEMENT_ORG)).isFalse();
        }

        @Test
        @DisplayName("MANAGEMENT_ORG refuse si pas de consentement per-property")
        void mgmtNoConsent() {
            Property p = property(PROPERTY_ID, ORG_ID);
            p.setOrgCanCreateVouchers(false);
            when(orgRepo.findById(ORG_ID)).thenReturn(Optional.of(orgWithContract(true)));
            assertThat(service.canCreateVoucherForProperty(ORG_ID, p, VoucherCreatorOrgType.MANAGEMENT_ORG)).isFalse();
        }

        @Test
        @DisplayName("Property null → false (defensif)")
        void propertyNull() {
            assertThat(service.canCreateVoucherForProperty(ORG_ID, null, VoucherCreatorOrgType.HOST)).isFalse();
        }
    }

    // ─── getScopedPropertyIdsBatch (fix H2) ──────────────────────────────────

    @Nested
    @DisplayName("getScopedPropertyIdsBatch")
    class ScopedBatch {

        @Test
        @DisplayName("Empty input → empty map (defensif)")
        void empty() {
            assertThat(service.getScopedPropertyIdsBatch(List.of())).isEmpty();
            assertThat(service.getScopedPropertyIdsBatch(null)).isEmpty();
        }

        @Test
        @DisplayName("Groupe les properties par voucher_id en 1 SQL")
        void groupsCorrectly() {
            VoucherPropertyScope s1 = new VoucherPropertyScope(VOUCHER_ID, PROPERTY_ID);
            VoucherPropertyScope s2 = new VoucherPropertyScope(VOUCHER_ID, PROPERTY_ID_2);
            VoucherPropertyScope s3 = new VoucherPropertyScope(43L, PROPERTY_ID_2);
            when(scopeRepo.findByVoucherIdIn(List.of(VOUCHER_ID, 43L)))
                .thenReturn(List.of(s1, s2, s3));

            var result = service.getScopedPropertyIdsBatch(List.of(VOUCHER_ID, 43L));
            assertThat(result.get(VOUCHER_ID)).containsExactlyInAnyOrder(PROPERTY_ID, PROPERTY_ID_2);
            assertThat(result.get(43L)).containsExactly(PROPERTY_ID_2);
        }
    }

    // ─── listByOrg ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("listByOrg")
    class ListByOrg {

        @Test
        @DisplayName("Pas de filtre → toutes les vouchers")
        void noFilter() {
            BookingVoucher v1 = voucher(1L, ORG_ID, VoucherStatus.ACTIVE);
            BookingVoucher v2 = voucher(2L, ORG_ID, VoucherStatus.DRAFT);
            when(voucherRepo.findByOrganizationIdOrderByCreatedAtDesc(ORG_ID))
                .thenReturn(List.of(v1, v2));

            assertThat(service.listByOrg(ORG_ID, null)).hasSize(2);
        }

        @Test
        @DisplayName("Filtre status → query specialisee")
        void withFilter() {
            BookingVoucher v = voucher(1L, ORG_ID, VoucherStatus.ACTIVE);
            when(voucherRepo.findByOrganizationIdAndStatusOrderByCreatedAtDesc(ORG_ID, VoucherStatus.ACTIVE))
                .thenReturn(List.of(v));

            assertThat(service.listByOrg(ORG_ID, VoucherStatus.ACTIVE)).hasSize(1);
        }
    }
}
