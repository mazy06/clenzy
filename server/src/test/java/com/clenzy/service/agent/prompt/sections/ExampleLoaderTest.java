package com.clenzy.service.agent.prompt.sections;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests du parser YAML : validation stricte, edge cases, idempotence.
 */
class ExampleLoaderTest {

    @Test
    void loads_examples_from_classpath_yaml_at_boot() {
        ExampleLoader loader = new ExampleLoader(new ClassPathResource("prompts/examples.yaml"));
        loader.loadExamples();

        assertThat(loader.isEmpty()).isFalse();
        assertThat(loader.getAll()).isNotEmpty();
        // Au moins une categorie attendue presente
        assertThat(loader.getByCategory("simulation")).isNotEmpty();
        assertThat(loader.getByCategory("navigation")).isNotEmpty();
    }

    @Test
    void missing_yaml_does_not_break_boot_just_logs_warning() {
        Resource missing = new ClassPathResource("prompts/__does_not_exist__.yaml");
        ExampleLoader loader = new ExampleLoader(missing);
        loader.loadExamples();
        assertThat(loader.isEmpty()).isTrue();
        assertThat(loader.getAll()).isEmpty();
        assertThat(loader.getByCategory("anything")).isEmpty();
    }

    @Test
    void fails_fast_when_yaml_missing_root_key() {
        Resource bad = stringResource("not_examples:\n  - foo: bar\n");
        ExampleLoader loader = new ExampleLoader(bad);
        assertThatThrownBy(loader::loadExamples)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("missing 'examples' root key");
    }

    @Test
    void fails_fast_when_example_missing_required_field() {
        Resource bad = stringResource("""
                examples:
                  - id: ok
                    category: analysis
                    user: "Question"
                    assistant: "Reponse"
                  - id: bad
                    category: analysis
                    user: "Question 2"
                    # assistant manquant
                """);
        ExampleLoader loader = new ExampleLoader(bad);
        assertThatThrownBy(loader::loadExamples)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("'assistant'");
    }

    @Test
    void fails_fast_on_duplicate_ids() {
        Resource bad = stringResource("""
                examples:
                  - id: same
                    category: analysis
                    user: "Q1"
                    assistant: "R1"
                  - id: same
                    category: navigation
                    user: "Q2"
                    assistant: "R2"
                """);
        ExampleLoader loader = new ExampleLoader(bad);
        assertThatThrownBy(loader::loadExamples)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("duplicate ids");
    }

    @Test
    void allows_optional_thinking_field() {
        Resource ok = stringResource("""
                examples:
                  - id: with_thinking
                    category: analysis
                    user: "Q"
                    thinking: "raisonnement cache"
                    assistant: "R"
                  - id: without_thinking
                    category: analysis
                    user: "Q2"
                    assistant: "R2"
                """);
        ExampleLoader loader = new ExampleLoader(ok);
        loader.loadExamples();
        assertThat(loader.getAll()).hasSize(2);
        assertThat(loader.getAll().get(0).thinking()).isEqualTo("raisonnement cache");
        assertThat(loader.getAll().get(1).thinking()).isNull();
    }

    @Test
    void returned_lists_are_immutable() {
        Resource ok = stringResource("""
                examples:
                  - id: a
                    category: x
                    user: "u"
                    assistant: "a"
                """);
        ExampleLoader loader = new ExampleLoader(ok);
        loader.loadExamples();
        assertThatThrownBy(() -> loader.getAll().clear())
                .isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> loader.getByCategory("x").clear())
                .isInstanceOf(UnsupportedOperationException.class);
    }

    private static Resource stringResource(String content) {
        return new ByteArrayResource(content.getBytes(StandardCharsets.UTF_8));
    }
}
