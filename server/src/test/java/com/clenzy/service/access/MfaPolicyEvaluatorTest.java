package com.clenzy.service.access;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Decision de politique 2FA (CLZ-P0-09).
 */
class MfaPolicyEvaluatorTest {

    private final MfaPolicyEvaluator evaluator = new MfaPolicyEvaluator();

    @Test
    void mfaSatisfied_whenAmrContainsOtp() {
        assertThat(evaluator.isMfaSatisfied(List.of("pwd", "otp"), null)).isTrue();
    }

    @Test
    void mfaSatisfied_whenAcrIsAal2() {
        assertThat(evaluator.isMfaSatisfied(List.of("pwd"), "aal2")).isTrue();
    }

    @Test
    void mfaNotSatisfied_whenSingleFactor() {
        assertThat(evaluator.isMfaSatisfied(List.of("pwd"), "1")).isFalse();
    }

    @Test
    void mfaNotSatisfied_whenClaimsAbsent() {
        assertThat(evaluator.isMfaSatisfied(null, null)).isFalse();
    }

    @Test
    void accessAllowed_whenOrgDoesNotRequireMfa_evenWithoutSecondFactor() {
        assertThat(evaluator.isAccessAllowed(false, List.of("pwd"), "1")).isTrue();
    }

    @Test
    void accessDenied_whenOrgRequiresMfaButNotSatisfied() {
        assertThat(evaluator.isAccessAllowed(true, List.of("pwd"), "1")).isFalse();
    }

    @Test
    void accessAllowed_whenOrgRequiresMfaAndSatisfied() {
        assertThat(evaluator.isAccessAllowed(true, List.of("pwd", "otp"), null)).isTrue();
    }
}
