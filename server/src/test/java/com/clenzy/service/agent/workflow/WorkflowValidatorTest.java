package com.clenzy.service.agent.workflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class WorkflowValidatorTest {

    private WorkflowValidator validator;

    @BeforeEach
    void setUp() {
        validator = new WorkflowValidator(new ObjectMapper());
    }

    private static WorkflowDefinition.Step step(String id, Map<String, Object> expects) {
        WorkflowDefinition.Step s = new WorkflowDefinition.Step();
        s.id = id;
        s.expectsData = expects;
        return s;
    }

    // ─── No-op cases ────────────────────────────────────────────────────────

    @Test
    void noExpectsData_allowsAnything() {
        WorkflowDefinition.Step s = step("free", null);
        assertDoesNotThrow(() -> validator.validate(s, "n'importe quoi"));
    }

    @Test
    void blankResponse_allowed() {
        WorkflowDefinition.Step s = step("s", Map.of("name", "string"));
        assertDoesNotThrow(() -> validator.validate(s, ""));
        assertDoesNotThrow(() -> validator.validate(s, "   "));
        assertDoesNotThrow(() -> validator.validate(s, null));
    }

    @Test
    void unknownType_skipsValidation() {
        WorkflowDefinition.Step s = step("s", Map.of("x", "weirdtype"));
        assertDoesNotThrow(() -> validator.validate(s, "anything"));
    }

    // ─── Single field validation ────────────────────────────────────────────

    @Test
    void singleStringField_acceptsNonBlank() {
        WorkflowDefinition.Step s = step("s", Map.of("name", "string"));
        assertDoesNotThrow(() -> validator.validate(s, "Alice"));
    }

    @Test
    void singleNumberField_acceptsIntAndDecimal_andComma() {
        WorkflowDefinition.Step s = step("s", Map.of("price", "number"));
        assertDoesNotThrow(() -> validator.validate(s, "42"));
        assertDoesNotThrow(() -> validator.validate(s, "12.5"));
        assertDoesNotThrow(() -> validator.validate(s, "12,5")); // virgule FR
    }

    @Test
    void singleNumberField_rejectsNonNumeric() {
        WorkflowDefinition.Step s = step("s", Map.of("price", "number"));
        WorkflowValidationException ex = assertThrows(WorkflowValidationException.class,
                () -> validator.validate(s, "trente"));
        assertEquals("s", ex.getStepId());
    }

    @Test
    void singleBooleanField_acceptsTokens() {
        WorkflowDefinition.Step s = step("s", Map.of("ok", "boolean"));
        for (String tok : java.util.List.of("oui", "yes", "true", "1", "ok", "non", "no", "false", "0")) {
            assertDoesNotThrow(() -> validator.validate(s, tok),
                    "Token '" + tok + "' should be accepted");
        }
    }

    @Test
    void singleBooleanField_rejectsAmbiguous() {
        WorkflowDefinition.Step s = step("s", Map.of("ok", "boolean"));
        assertThrows(WorkflowValidationException.class,
                () -> validator.validate(s, "peut-etre"));
    }

    @Test
    void singleArrayField_rejectsEmpty() {
        WorkflowDefinition.Step s = step("s", Map.of("items", "string[]"));
        assertDoesNotThrow(() -> validator.validate(s, "a, b, c"));
        assertDoesNotThrow(() -> validator.validate(s, "single"));
    }

    // ─── Multi-field validation (JSON) ──────────────────────────────────────

    @Test
    void multiField_requiresJsonObject() {
        WorkflowDefinition.Step s = step("multi",
                Map.of("name", "string", "age", "number"));

        WorkflowValidationException ex = assertThrows(WorkflowValidationException.class,
                () -> validator.validate(s, "Alice 30"));
        assertTrue(ex.getMessage().toLowerCase().contains("json"));
    }

    @Test
    void multiField_validJson_passes() {
        WorkflowDefinition.Step s = step("multi",
                Map.of("name", "string", "age", "number", "active", "boolean"));
        assertDoesNotThrow(() -> validator.validate(s,
                "{\"name\":\"Alice\",\"age\":30,\"active\":true}"));
    }

    @Test
    void multiField_missingField_throws() {
        WorkflowDefinition.Step s = step("multi",
                Map.of("name", "string", "age", "number"));
        WorkflowValidationException ex = assertThrows(WorkflowValidationException.class,
                () -> validator.validate(s, "{\"name\":\"Alice\"}"));
        assertTrue(ex.getMessage().contains("age"));
    }

    @Test
    void multiField_wrongType_throws() {
        WorkflowDefinition.Step s = step("multi",
                Map.of("name", "string", "items", "string[]"));
        WorkflowValidationException ex = assertThrows(WorkflowValidationException.class,
                () -> validator.validate(s, "{\"name\":\"Alice\",\"items\":\"not-an-array\"}"));
        assertTrue(ex.getMessage().toLowerCase().contains("array"));
    }

    @Test
    void multiField_jsonNotObject_throws() {
        WorkflowDefinition.Step s = step("multi",
                Map.of("name", "string", "age", "number"));
        WorkflowValidationException ex = assertThrows(WorkflowValidationException.class,
                () -> validator.validate(s, "[1, 2, 3]"));
        assertTrue(ex.getMessage().toLowerCase().contains("objet"));
    }

    // ─── Helpers internes ───────────────────────────────────────────────────

    @Test
    void parseBoolean_handlesAllVariants() {
        assertEquals(Optional.of(true), WorkflowValidator.parseBoolean("oui"));
        assertEquals(Optional.of(true), WorkflowValidator.parseBoolean("YES"));
        assertEquals(Optional.of(false), WorkflowValidator.parseBoolean("Non"));
        assertEquals(Optional.empty(), WorkflowValidator.parseBoolean(""));
        assertEquals(Optional.empty(), WorkflowValidator.parseBoolean(null));
        assertEquals(Optional.empty(), WorkflowValidator.parseBoolean("maybe"));
    }

    @Test
    void splitList_handlesMixedSeparators() {
        assertEquals(java.util.List.of("a", "b", "c"),
                WorkflowValidator.splitList("a, b, c"));
        assertEquals(java.util.List.of("a", "b", "c"),
                WorkflowValidator.splitList("a;b;c"));
        assertEquals(java.util.List.of("a", "b"),
                WorkflowValidator.splitList("a b"));
        assertTrue(WorkflowValidator.splitList("").isEmpty());
        assertTrue(WorkflowValidator.splitList(null).isEmpty());
    }
}
