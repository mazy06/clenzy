package com.clenzy.architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.library.freeze.FreezingArchRule;

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
}
