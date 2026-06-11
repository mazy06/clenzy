package com.clenzy.controller;

import com.clenzy.dto.TaxRuleDto;
import com.clenzy.dto.TaxRuleRequest;
import com.clenzy.fiscal.FiscalEngine;
import com.clenzy.model.TaxRule;
import com.clenzy.repository.TaxRuleRepository;
import com.clenzy.service.TaxRuleService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaxRuleControllerTest {

    @Mock private TaxRuleRepository taxRuleRepository;
    @Mock private FiscalEngine fiscalEngine;
    @Mock private TenantContext tenantContext;

    private TaxRuleController controller;

    @BeforeEach
    void setUp() {
        // Pattern Vague A : service REEL construit au-dessus du mock repository
        // pour garder la couverture bout-en-bout (normalisation pays, CRUD).
        controller = new TaxRuleController(new TaxRuleService(taxRuleRepository), fiscalEngine, tenantContext);
    }

    private TaxRule sampleRule() {
        TaxRule rule = new TaxRule("FR", "VAT", new BigDecimal("0.2000"), "TVA 20%",
                LocalDate.of(2024, 1, 1));
        rule.setId(1L);
        return rule;
    }

    @Nested
    @DisplayName("getCurrentRules")
    class GetCurrentRules {

        @Test
        void noCategory_returnsAllRulesForOrgCountry() {
            when(tenantContext.getCountryCode()).thenReturn("FR");
            when(taxRuleRepository.findByCountryCode("FR")).thenReturn(List.of(sampleRule()));

            ResponseEntity<List<TaxRuleDto>> response = controller.getCurrentRules(null);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        void withCategory_delegatesToFiscalEngine() {
            when(tenantContext.getCountryCode()).thenReturn("fr");
            when(fiscalEngine.getApplicableRules(eq("FR"), eq("VAT"), any(LocalDate.class)))
                    .thenReturn(List.of(sampleRule()));

            ResponseEntity<List<TaxRuleDto>> response = controller.getCurrentRules("vat");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).hasSize(1);
            verify(fiscalEngine).getApplicableRules(eq("FR"), eq("VAT"), any(LocalDate.class));
        }

        @Test
        void withBlankCategory_returnsAllRules() {
            when(tenantContext.getCountryCode()).thenReturn("FR");
            when(taxRuleRepository.findByCountryCode("FR")).thenReturn(List.of());

            ResponseEntity<List<TaxRuleDto>> response = controller.getCurrentRules("  ");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            verify(taxRuleRepository).findByCountryCode("FR");
            verify(fiscalEngine, never()).getApplicableRules(any(), any(), any());
        }
    }

    @Test
    void getAllRules_returnsRepositoryFindAll() {
        when(taxRuleRepository.findAll()).thenReturn(List.of(sampleRule(), sampleRule()));

        ResponseEntity<List<TaxRuleDto>> response = controller.getAllRules();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(2);
    }

    @Nested
    @DisplayName("getRulesForCountry")
    class GetRulesForCountry {

        @Test
        void noCategory_returnsCountryRules() {
            when(taxRuleRepository.findByCountryCode("DE")).thenReturn(List.of(sampleRule()));

            ResponseEntity<List<TaxRuleDto>> response = controller.getRulesForCountry("de", null);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        void withCategory_callsFiscalEngine() {
            when(fiscalEngine.getApplicableRules(eq("MA"), eq("CITY_TAX"), any(LocalDate.class)))
                    .thenReturn(List.of(sampleRule()));

            ResponseEntity<List<TaxRuleDto>> response = controller.getRulesForCountry("ma", "city_tax");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Test
    void isCountrySupported_delegatesToEngine() {
        when(fiscalEngine.isCountrySupported("FR")).thenReturn(true);

        ResponseEntity<Boolean> response = controller.isCountrySupported("fr");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isTrue();
    }

    @Nested
    @DisplayName("createRule")
    class CreateRule {
        @Test
        void persists_andReturns201() {
            TaxRuleRequest req = new TaxRuleRequest("fr", "vat", new BigDecimal("0.2000"),
                    "TVA", LocalDate.of(2024, 1, 1), null, "desc");
            when(taxRuleRepository.save(any(TaxRule.class))).thenAnswer(inv -> {
                TaxRule r = inv.getArgument(0);
                r.setId(99L);
                return r;
            });

            ResponseEntity<TaxRuleDto> response = controller.createRule(req);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            assertThat(response.getBody().countryCode()).isEqualTo("FR");
            assertThat(response.getBody().taxCategory()).isEqualTo("VAT");
            assertThat(response.getBody().id()).isEqualTo(99L);
        }

        @Test
        void persistsWithEffectiveToAndDescription() {
            TaxRuleRequest req = new TaxRuleRequest("FR", "VAT", new BigDecimal("0.10"),
                    "TVA reduite", LocalDate.now(), LocalDate.now().plusYears(1), "Reduit");
            when(taxRuleRepository.save(any(TaxRule.class))).thenAnswer(inv -> inv.getArgument(0));

            ResponseEntity<TaxRuleDto> response = controller.createRule(req);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            assertThat(response.getBody().effectiveTo()).isNotNull();
            assertThat(response.getBody().description()).isEqualTo("Reduit");
        }
    }

    @Nested
    @DisplayName("updateRule")
    class UpdateRule {
        @Test
        void updatesExisting() {
            TaxRule existing = sampleRule();
            when(taxRuleRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(taxRuleRepository.save(existing)).thenReturn(existing);

            TaxRuleRequest req = new TaxRuleRequest("de", "vat", new BigDecimal("0.19"),
                    "MwSt", LocalDate.now(), null, null);

            ResponseEntity<TaxRuleDto> response = controller.updateRule(1L, req);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(existing.getCountryCode()).isEqualTo("DE");
            assertThat(existing.getTaxCategory()).isEqualTo("VAT");
            assertThat(existing.getTaxName()).isEqualTo("MwSt");
        }

        @Test
        void missing_throwsIllegalArgument() {
            when(taxRuleRepository.findById(42L)).thenReturn(Optional.empty());
            TaxRuleRequest req = new TaxRuleRequest("FR", "VAT", BigDecimal.ZERO, "X",
                    LocalDate.now(), null, null);

            assertThatThrownBy(() -> controller.updateRule(42L, req))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("introuvable");
        }
    }

    @Nested
    @DisplayName("deleteRule")
    class DeleteRule {
        @Test
        void existing_returns204() {
            when(taxRuleRepository.existsById(5L)).thenReturn(true);

            ResponseEntity<Void> response = controller.deleteRule(5L);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
            verify(taxRuleRepository).deleteById(5L);
        }

        @Test
        void unknown_throws() {
            when(taxRuleRepository.existsById(99L)).thenReturn(false);

            assertThatThrownBy(() -> controller.deleteRule(99L))
                    .isInstanceOf(IllegalArgumentException.class);
            verify(taxRuleRepository, never()).deleteById(any());
        }
    }

    /**
     * T-ARCH-07 : le DTO reprend champ a champ la shape JSON historique de
     * l'entite (9 proprietes, memes noms) — contrat frontend (taxRulesApi.ts)
     * inchange.
     */
    @Nested
    @DisplayName("TaxRuleDto mapping")
    class DtoMapping {

        @Test
        void whenMappingEntity_thenAllNineSerializedFieldsArePreserved() {
            // Arrange
            TaxRule rule = sampleRule();
            rule.setEffectiveTo(LocalDate.of(2030, 12, 31));
            rule.setDescription("TVA standard hexagone");
            rule.setCreatedAt(java.time.LocalDateTime.of(2026, 1, 1, 12, 0));

            // Act
            TaxRuleDto dto = TaxRuleDto.from(rule);

            // Assert — id, countryCode, taxCategory, taxRate, taxName,
            // effectiveFrom, effectiveTo, description, createdAt
            assertThat(dto.id()).isEqualTo(rule.getId());
            assertThat(dto.countryCode()).isEqualTo(rule.getCountryCode());
            assertThat(dto.taxCategory()).isEqualTo(rule.getTaxCategory());
            assertThat(dto.taxRate()).isEqualByComparingTo(rule.getTaxRate());
            assertThat(dto.taxName()).isEqualTo(rule.getTaxName());
            assertThat(dto.effectiveFrom()).isEqualTo(rule.getEffectiveFrom());
            assertThat(dto.effectiveTo()).isEqualTo(rule.getEffectiveTo());
            assertThat(dto.description()).isEqualTo(rule.getDescription());
            assertThat(dto.createdAt()).isEqualTo(rule.getCreatedAt());
        }
    }
}
