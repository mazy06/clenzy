package com.clenzy.service.agent.multiagent;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SpecialistResultTest {

    @Test
    void success_factory_marks_isSuccess_true_no_error() {
        SpecialistResult r = SpecialistResult.success("text", List.of("tool1"), 100, 50);
        assertThat(r.isSuccess()).isTrue();
        assertThat(r.error()).isNull();
        assertThat(r.truncated()).isFalse();
        assertThat(r.synthesis()).isEqualTo("text");
        assertThat(r.toolCallsExecuted()).containsExactly("tool1");
        assertThat(r.promptTokens()).isEqualTo(100);
        assertThat(r.completionTokens()).isEqualTo(50);
    }

    @Test
    void error_factory_marks_isSuccess_false() {
        SpecialistResult r = SpecialistResult.error("oops");
        assertThat(r.isSuccess()).isFalse();
        assertThat(r.error()).isEqualTo("oops");
        assertThat(r.synthesis()).contains("oops");
    }

    @Test
    void truncated_factory_keeps_success_but_marks_truncated() {
        SpecialistResult r = SpecialistResult.truncated("partial", List.of(), 0, 0);
        assertThat(r.isSuccess()).isTrue();
        assertThat(r.truncated()).isTrue();
    }

    @Test
    void synthesis_must_not_be_null() {
        assertThatThrownBy(() -> new SpecialistResult(null, List.of(), 0, 0, false, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void toolCallsExecuted_defaults_to_empty_when_null() {
        SpecialistResult r = new SpecialistResult("text", null, 0, 0, false, null);
        assertThat(r.toolCallsExecuted()).isEmpty();
    }

    @Test
    void toolCallsExecuted_is_copied_defensively() {
        List<String> mutable = new ArrayList<>(List.of("a", "b"));
        SpecialistResult r = new SpecialistResult("text", mutable, 0, 0, false, null);
        mutable.clear();
        assertThat(r.toolCallsExecuted()).hasSize(2);  // intact
    }

    @Test
    void returned_list_is_unmodifiable() {
        SpecialistResult r = SpecialistResult.success("t", List.of("a"), 0, 0);
        assertThatThrownBy(() -> r.toolCallsExecuted().add("b"))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
