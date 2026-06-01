package com.clenzy.service;

import com.clenzy.exception.DocumentValidationException;
import com.clenzy.model.TaxRule;
import com.clenzy.repository.TaxRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaxRulePreValidatorTest {

    @Mock private TaxRuleRepository taxRuleRepository;

    @InjectMocks
    private TaxRulePreValidator validator;

    private final LocalDate date = LocalDate.of(2024, 6, 1);

    @BeforeEach
    void setUp() {
        // Default: no rules exist - tests override per scenario
        lenient().when(taxRuleRepository.findApplicableRule(anyString(), anyString(), any()))
            .thenReturn(Optional.empty());
    }

    @Test
    void validateTaxRulesExist_allCategoriesPresent_passes() {
        TaxRule rule = mock(TaxRule.class);
        when(taxRuleRepository.findApplicableRule(eq("FR"), anyString(), eq(date)))
            .thenReturn(Optional.of(rule));

        assertDoesNotThrow(() -> validator.validateTaxRulesExist("FR", date));

        // Verify all 4 required categories were checked
        verify(taxRuleRepository).findApplicableRule("FR", "ACCOMMODATION", date);
        verify(taxRuleRepository).findApplicableRule("FR", "STANDARD", date);
        verify(taxRuleRepository).findApplicableRule("FR", "CLEANING", date);
        verify(taxRuleRepository).findApplicableRule("FR", "FOOD", date);
    }

    @Test
    void validateTaxRulesExist_allCategoriesMissing_throws() {
        // setUp already returns Optional.empty() for any args
        DocumentValidationException ex = assertThrows(DocumentValidationException.class,
            () -> validator.validateTaxRulesExist("MA", date));

        String msg = ex.getMessage();
        assertTrue(msg.contains("MA"));
        assertTrue(msg.contains("ACCOMMODATION"));
        assertTrue(msg.contains("STANDARD"));
        assertTrue(msg.contains("CLEANING"));
        assertTrue(msg.contains("FOOD"));
    }

    @Test
    void validateTaxRulesExist_oneCategoryMissing_throwsWithName() {
        TaxRule rule = mock(TaxRule.class);
        // All except CLEANING are present
        lenient().when(taxRuleRepository.findApplicableRule(eq("FR"), eq("ACCOMMODATION"), eq(date)))
            .thenReturn(Optional.of(rule));
        lenient().when(taxRuleRepository.findApplicableRule(eq("FR"), eq("STANDARD"), eq(date)))
            .thenReturn(Optional.of(rule));
        lenient().when(taxRuleRepository.findApplicableRule(eq("FR"), eq("FOOD"), eq(date)))
            .thenReturn(Optional.of(rule));

        DocumentValidationException ex = assertThrows(DocumentValidationException.class,
            () -> validator.validateTaxRulesExist("FR", date));

        String msg = ex.getMessage();
        assertTrue(msg.contains("CLEANING"));
    }

    @Test
    void validateTaxRulesExist_includesCountryAndDate() {
        DocumentValidationException ex = assertThrows(DocumentValidationException.class,
            () -> validator.validateTaxRulesExist("BE", date));

        assertTrue(ex.getMessage().contains("BE"));
        assertTrue(ex.getMessage().contains(date.toString()));
        assertTrue(ex.getMessage().contains("Parametres > Fiscal"));
    }

    @Test
    void validateTaxRulesExist_checksAllFourCategoriesEvenIfFirstSucceeds() {
        TaxRule rule = mock(TaxRule.class);
        lenient().when(taxRuleRepository.findApplicableRule(eq("FR"), eq("ACCOMMODATION"), any()))
            .thenReturn(Optional.of(rule));
        // Other categories absent

        assertThrows(DocumentValidationException.class,
            () -> validator.validateTaxRulesExist("FR", date));

        verify(taxRuleRepository).findApplicableRule("FR", "ACCOMMODATION", date);
        verify(taxRuleRepository).findApplicableRule("FR", "STANDARD", date);
        verify(taxRuleRepository).findApplicableRule("FR", "CLEANING", date);
        verify(taxRuleRepository).findApplicableRule("FR", "FOOD", date);
    }
}
