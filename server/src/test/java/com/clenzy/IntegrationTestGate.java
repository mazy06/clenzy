package com.clenzy;

import org.junit.jupiter.api.extension.ConditionEvaluationResult;
import org.junit.jupiter.api.extension.ExecutionCondition;
import org.junit.jupiter.api.extension.ExtensionContext;

/**
 * Gate d'execution des tests d'integration (strategie de tests, vague T1) :
 * actifs uniquement quand {@code CLENZY_IT=true} (Docker/Testcontainers requis).
 *
 * <p>Posee sur {@link AbstractIntegrationTest} via {@code @ExtendWith} — qui est
 * {@code @Inherited}, contrairement a {@code @EnabledIfEnvironmentVariable} :
 * une annotation de condition posee sur la classe de base ne se propage PAS aux
 * sous-classes (verifie : les ITs heritant du socle tournaient quand meme sans
 * la variable et echouaient faute de containers).</p>
 */
public class IntegrationTestGate implements ExecutionCondition {

    @Override
    public ConditionEvaluationResult evaluateExecutionCondition(ExtensionContext context) {
        if (AbstractIntegrationTest.IT_ENABLED) {
            return ConditionEvaluationResult.enabled("CLENZY_IT=true — tests d'integration actifs");
        }
        return ConditionEvaluationResult.disabled(
            "Tests d'integration (Docker/Testcontainers) — poser CLENZY_IT=true pour les executer");
    }
}
