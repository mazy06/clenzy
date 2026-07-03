package com.clenzy.architecture;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import com.tngtech.archunit.library.freeze.FreezingArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * Regles d'architecture executables issues de l'audit 2026-06 (T-ARCH-01).
 *
 * <p>Les regles sont GELEES ({@link FreezingArchRule}) : les violations historiques
 * sont inventoriees dans {@code server/archunit_store/} (versionne) et tolerees ;
 * toute NOUVELLE violation fait echouer le build. Quand une violation est corrigee,
 * elle est retiree du store automatiquement au run suivant — le store ne peut que
 * retrecir, jamais grossir.</p>
 *
 * <p>Convention (CLAUDE.md, « Lecons de l'audit ») : un controller fait validation
 * d'entree + delegation au service + mapping DTO. L'acces aux donnees, les
 * transactions et la logique metier vivent dans la couche service.</p>
 */
@AnalyzeClasses(packages = "com.clenzy", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureRulesTest {

    @ArchTest
    static final ArchRule controllersNeDependentPasDesRepositories = FreezingArchRule.freeze(
            noClasses().that().resideInAPackage("..controller..")
                    .should().dependOnClassesThat().resideInAPackage("..repository..")
                    .because("audit T-ARCH-01 : controller mince — l'acces donnees passe par la couche service "
                            + "(transactions + ownership org systematiques) ; "
                            + "voir CLAUDE.md « Lecons de l'audit 2026-06 », regle 4"));

    /**
     * Bug de boot 2026-07-02 : un bean Spring a plusieurs constructeurs sans
     * {@code @Autowired} → Spring cherche un constructeur no-arg (crash au boot
     * si absent, ou bean silencieusement degrade si present — cas PendingToolStore
     * instancie « in-memory only » en prod). Invisible en mvn package : la suite
     * de tests ne monte pas le contexte complet.
     */
    @ArchTest
    static final ArchRule beansMultiConstructeursOntAutowired = classes()
            .that().areAnnotatedWith(org.springframework.stereotype.Component.class)
            .or().areAnnotatedWith(org.springframework.stereotype.Service.class)
            .or().areAnnotatedWith(org.springframework.web.bind.annotation.RestController.class)
            .should(new ArchCondition<>("avoir @Autowired sur un constructeur s'ils en declarent plusieurs") {
                @Override
                public void check(JavaClass javaClass, ConditionEvents events) {
                    if (javaClass.getConstructors().size() <= 1) {
                        return;
                    }
                    boolean hasAnnotated = javaClass.getConstructors().stream().anyMatch(
                            c -> c.isAnnotatedWith(org.springframework.beans.factory.annotation.Autowired.class));
                    if (!hasAnnotated) {
                        events.add(SimpleConditionEvent.violated(javaClass,
                                javaClass.getName() + " declare plusieurs constructeurs sans @Autowired : "
                                        + "Spring retombe sur le constructeur no-arg (boot cassee ou bean degrade)"));
                    }
                }
            })
            .because("boot du 2026-07-02 : AgentRunRecorder et 7 autres beans plantaient ou bootaient degrades");
}
