package com.clenzy.config;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.annotation.KafkaListener;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifie que tout topic consomme par un {@code @KafkaListener} est declare.
 *
 * <h2>Le defaut P5-02 / P5-03 de l'audit 2026-07</h2>
 * <p>Deux trous, tous deux invisibles au compilateur comme aux tests unitaires :</p>
 * <ul>
 *   <li><b>P5-03</b> — quatre topics etaient consommes par litteral sans jamais etre
 *       declares ({@code booking.reservations}, {@code booking.calendar.sync},
 *       {@code agoda.reservations}, {@code agoda.calendar.sync}). Avec
 *       {@code KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false"} en production, ces flux OTA
 *       echouaient <b>silencieusement</b>.</li>
 *   <li><b>P5-02</b> — le {@code DeadLetterPublishingRecoverer} route les messages en echec
 *       vers {@code <topic>.DLT}, mais aucun topic {@code .DLT} n'etait declare. Le commentaire
 *       du code supposait une auto-creation, desactivee en production. Un message empoisonne
 *       produisait donc : 6 tentatives → publication DLT en echec → offset non commite →
 *       <b>boucle de retry infinie bloquant la partition</b>.</li>
 * </ul>
 *
 * <p>La liste {@link KafkaConfig#CONSUMED_TOPICS} est desormais la source unique : elle pilote
 * la creation des topics metier <b>et</b> de leurs DLT. Ce test garantit qu'aucun listener ne
 * consomme un topic absent de cette liste — le cas se reproduirait sinon au prochain ajout.</p>
 */
class KafkaTopicDeclarationTest {

    private static final JavaClasses PRODUCTION_CLASSES = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("com.clenzy");

    /** Topics litteraux portes par les annotations {@code @KafkaListener} du code. */
    private Set<String> consumedTopicsFromListeners() {
        return PRODUCTION_CLASSES.stream()
                .flatMap(javaClass -> javaClass.getMethods().stream())
                .filter(method -> method.isAnnotatedWith(KafkaListener.class))
                .flatMap(method -> Arrays.stream(
                        method.getAnnotationOfType(KafkaListener.class).topics()))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    @Test
    @DisplayName("tout topic consomme figure dans CONSUMED_TOPICS (P5-03)")
    void everyConsumedTopicIsDeclared() {
        Set<String> consumed = consumedTopicsFromListeners();

        assertThat(consumed)
                .as("le scan doit trouver les listeners — un resultat vide invaliderait le test")
                .isNotEmpty();
        // Egalite stricte plutot que containsAll : detecte aussi un topic declare mais plus
        // consomme (declaration morte), et empeche le test de passer si le scan sous-detecte.
        assertThat(KafkaConfig.CONSUMED_TOPICS)
                .as("un @KafkaListener sur un topic absent de CONSUMED_TOPICS ne verra jamais "
                        + "son topic cree (auto-creation desactivee en production) ni sa DLT ; "
                        + "a l'inverse un topic declare sans listener est une declaration morte")
                .containsExactlyInAnyOrderElementsOf(consumed);
    }

    @Test
    @DisplayName("chaque topic consomme a une DLT declaree (P5-02)")
    void everyConsumedTopicHasDeadLetterTopic() {
        Set<String> deadLetterTopics = KafkaConfig.deadLetterTopicNames();

        assertThat(deadLetterTopics)
                .as("sans topic .DLT, un message empoisonne boucle indefiniment et bloque "
                        + "sa partition au lieu d'etre mis de cote")
                .containsAll(KafkaConfig.CONSUMED_TOPICS.stream()
                        .map(topic -> topic + ".DLT")
                        .collect(Collectors.toSet()));
    }

    @Test
    @DisplayName("les 4 topics OTA jamais declares le sont desormais (P5-03)")
    void previouslyUndeclaredOtaTopicsAreCovered() {
        assertThat(KafkaConfig.CONSUMED_TOPICS)
                .contains("booking.reservations", "booking.calendar.sync",
                        "agoda.reservations", "agoda.calendar.sync");
    }
}
