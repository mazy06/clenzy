package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AssignableTypeFilter;

import java.lang.reflect.Constructor;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Completude du SPI du moteur d'automatisations (strategie de tests, vague T3) :
 * CHAQUE valeur de {@link AutomationAction} doit avoir un
 * {@link AutomationActionExecutor} concret dans le classpath — une action
 * orpheline compilerait sans bruit et n'echouerait qu'au premier declenchement
 * reel ({@code AutomationActionRegistry.executorFor} jette a l'usage, pas au boot).
 *
 * <p><b>Test unitaire volontairement sans contexte Spring</b> (tourne dans le
 * build standard, sans Docker) : scan du classpath pour les implementations
 * concretes, instanciation avec des mocks de constructeur (les executeurs sont
 * des beans a constructeur d'assignation pure), lecture de {@code action()}.
 * Le doublon (2 executeurs pour la meme action) est deja un fail-fast au boot
 * ({@code AutomationActionRegistry}) — re-verifie ici pour echouer des le build.</p>
 */
class AutomationActionExecutorCoverageTest {

    private static final String BASE_PACKAGE = "com.clenzy";

    @Test
    void everyAutomationAction_hasExactlyOneExecutorImplementation() {
        Map<AutomationAction, List<String>> byAction = new EnumMap<>(AutomationAction.class);

        for (Class<?> type : findConcreteExecutorTypes()) {
            AutomationActionExecutor executor = instantiateWithMocks(type);
            AutomationAction action = executor.action();
            assertThat(action)
                    .as("action() de %s ne doit pas etre null", type.getName())
                    .isNotNull();
            byAction.computeIfAbsent(action, a -> new ArrayList<>()).add(type.getSimpleName());
        }

        List<AutomationAction> orphans = new ArrayList<>();
        List<String> duplicates = new ArrayList<>();
        for (AutomationAction action : AutomationAction.values()) {
            List<String> impls = byAction.getOrDefault(action, List.of());
            if (impls.isEmpty()) {
                orphans.add(action);
            } else if (impls.size() > 1) {
                duplicates.add(action + " -> " + impls);
            }
        }

        assertThat(orphans)
                .as("Actions ORPHELINES (aucun AutomationActionExecutor dans le classpath) — "
                        + "chaque nouvelle valeur d'AutomationAction doit livrer son executeur : %s", orphans)
                .isEmpty();
        assertThat(duplicates)
                .as("Actions avec PLUSIEURS executeurs (le registre echouerait au boot) : %s", duplicates)
                .isEmpty();
    }

    // ─── Scan + instanciation ────────────────────────────────────────────────

    private static List<Class<?>> findConcreteExecutorTypes() {
        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AssignableTypeFilter(AutomationActionExecutor.class));

        List<Class<?>> types = new ArrayList<>();
        for (BeanDefinition definition : scanner.findCandidateComponents(BASE_PACKAGE)) {
            try {
                Class<?> type = Class.forName(definition.getBeanClassName());
                if (!type.isInterface() && !Modifier.isAbstract(type.getModifiers())) {
                    types.add(type);
                }
            } catch (ClassNotFoundException e) {
                throw new AssertionError("Classe scannee introuvable : " + definition.getBeanClassName(), e);
            }
        }
        assertThat(types)
                .as("Le scan doit trouver au moins un executeur — package de base errone ?")
                .isNotEmpty();
        return types;
    }

    /**
     * Instancie l'executeur avec un mock (ou une valeur par defaut primitive)
     * pour chaque parametre de constructeur : les executeurs sont des beans
     * Spring a constructeur d'assignation pure, {@code action()} retourne une
     * constante sans toucher aux dependances.
     */
    private static AutomationActionExecutor instantiateWithMocks(Class<?> type) {
        Constructor<?> constructor = type.getDeclaredConstructors()[0];
        constructor.setAccessible(true);
        Object[] args = new Object[constructor.getParameterCount()];
        Class<?>[] paramTypes = constructor.getParameterTypes();
        for (int i = 0; i < paramTypes.length; i++) {
            args[i] = defaultValueFor(paramTypes[i]);
        }
        try {
            return (AutomationActionExecutor) constructor.newInstance(args);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError("Impossible d'instancier " + type.getName()
                    + " avec des mocks de constructeur — adapter defaultValueFor()", e);
        }
    }

    private static Object defaultValueFor(Class<?> paramType) {
        if (!paramType.isPrimitive()) {
            return Mockito.mock(paramType);
        }
        if (paramType == boolean.class) {
            return false;
        }
        if (paramType == long.class) {
            return 0L;
        }
        if (paramType == double.class) {
            return 0.0d;
        }
        if (paramType == float.class) {
            return 0.0f;
        }
        return 0; // int / short / byte / char via auto-boxing int
    }
}
