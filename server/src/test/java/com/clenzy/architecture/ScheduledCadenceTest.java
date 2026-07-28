package com.clenzy.architecture;

import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import org.springframework.scheduling.annotation.Scheduled;

import java.util.Set;
import java.util.regex.Pattern;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;

/**
 * Garde-fou sur la <b>cadence</b> des jobs planifies.
 *
 * <p>Origine : six schedulers de synchronisation OTA ont tourne toutes les <b>15 secondes au
 * lieu de 15 minutes</b> — un facteur 60 — parce que l'expression
 * {@code "${airbnb.sync.interval-minutes:15}000"} concatene une chaine au lieu de multiplier.
 * Le placeholder resolvait {@code "15"}, la concatenation donnait {@code "15000"} millisecondes.
 * Corrige en juillet 2026 par passage a la forme SpEL {@code "#{${...} * 60000}"}, mais
 * <b>aucun test n'aurait detecte le probleme</b> : les tests unitaires des schedulers appellent
 * les methodes directement et ne regardent jamais l'annotation.</p>
 *
 * <p>Ces regles lisent le <b>bytecode</b>, pas le source : une cadence ecrite
 * {@code 3 * 60 * 60 * 1000} y est deja evaluee en constante par le compilateur. Une analyse
 * textuelle du source y lirait « 3 » et crierait au loup.</p>
 */
@AnalyzeClasses(packages = "com.clenzy", importOptions = ImportOption.DoNotIncludeTests.class)
class ScheduledCadenceTest {

    /** Un placeholder immediatement suivi de chiffres : {@code ${prop:15}000}. */
    private static final Pattern CONCATENATION_SUSPECTE = Pattern.compile("\\$\\{[^}]*}\\d");

    private static final long UNE_MINUTE_MS = 60_000L;

    /**
     * Jobs dont la cadence rapide est <b>deliberee</b>. Format {@code SimpleClassName#methodName}.
     *
     * <p>{@code OutboxRelay} draine la table d'outbox vers Kafka : sa latence est le delai entre
     * un evenement metier et sa publication, donc une cadence courte est sa raison d'etre. Le
     * lot est borne a 500 lignes.</p>
     */
    private static final Set<String> CADENCES_RAPIDES_ASSUMEES = Set.of(
            "OutboxRelay#relayPendingEvents",
            "OutboxRelay#retryFailedEvents");

    /**
     * Interdit la concatenation qui a produit le facteur 60. La forme correcte est SpEL :
     * {@code "#{${prop:15} * 60000}"}, ou l'operation est une vraie multiplication.
     */
    @ArchTest
    static final ArchRule aucune_cadence_ne_concatene_un_placeholder =
            methods().that().areAnnotatedWith(Scheduled.class)
                    .should(new ArchCondition<JavaMethod>(
                            "exprimer les cadences en SpEL plutot qu'en concatenant un placeholder") {
                        @Override
                        public void check(JavaMethod method, ConditionEvents events) {
                            final Scheduled a = method.getAnnotationOfType(Scheduled.class);
                            controler(method, "fixedRateString", a.fixedRateString(), events);
                            controler(method, "fixedDelayString", a.fixedDelayString(), events);
                            controler(method, "initialDelayString", a.initialDelayString(), events);
                        }

                        private void controler(JavaMethod method, String attribut, String valeur,
                                               ConditionEvents events) {
                            if (valeur == null || valeur.isEmpty()) {
                                return;
                            }
                            if (CONCATENATION_SUSPECTE.matcher(valeur).find()) {
                                events.add(SimpleConditionEvent.violated(method,
                                        method.getOwner().getSimpleName() + "#" + method.getName()
                                                + " : " + attribut + " = \"" + valeur + "\" concatene un "
                                                + "placeholder avec des chiffres. Le placeholder est resolu en "
                                                + "CHAINE, donc \"15\" + \"000\" donne 15 secondes, pas 15 minutes. "
                                                + "Utiliser la forme SpEL : \"#{${prop:15} * 60000}\"."));
                            }
                        }
                    });

    /**
     * Une cadence litterale sous la minute est presque toujours une erreur d'unite (millisecondes
     * prises pour des secondes, ou l'inverse). Les exceptions legitimes sont inventoriees.
     *
     * <p>{@code initialDelay} n'est volontairement pas controle : un demarrage differe de quelques
     * secondes est normal et sans consequence — c'est la <i>repetition</i> qui coute.</p>
     */
    @ArchTest
    static final ArchRule aucune_cadence_sous_la_minute_sans_justification =
            methods().that().areAnnotatedWith(Scheduled.class)
                    .should(new ArchCondition<JavaMethod>(
                            "se repeter au plus une fois par minute, sauf exception inventoriee") {
                        @Override
                        public void check(JavaMethod method, ConditionEvents events) {
                            final String id = method.getOwner().getSimpleName() + "#" + method.getName();
                            if (CADENCES_RAPIDES_ASSUMEES.contains(id)) {
                                return;
                            }
                            final Scheduled a = method.getAnnotationOfType(Scheduled.class);
                            controler(method, id, "fixedRate", a.fixedRate(), events);
                            controler(method, id, "fixedDelay", a.fixedDelay(), events);
                        }

                        private void controler(JavaMethod method, String id, String attribut,
                                               long valeur, ConditionEvents events) {
                            if (valeur <= 0 || valeur >= UNE_MINUTE_MS) {
                                return;
                            }
                            events.add(SimpleConditionEvent.violated(method,
                                    id + " : " + attribut + " = " + valeur + " ms, soit "
                                            + String.format("%.1f", valeur / 1000.0) + " s. Une repetition "
                                            + "sous la minute est presque toujours une confusion d'unite. "
                                            + "Si elle est voulue, l'inscrire dans CADENCES_RAPIDES_ASSUMEES ("
                                            + ScheduledCadenceTest.class.getSimpleName() + ") en expliquant "
                                            + "pourquoi la latence prime sur le cout."));
                        }
                    });
}
