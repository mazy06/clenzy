package com.clenzy.service.agent.workflow;

import com.clenzy.model.AssistantWorkflowRun;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class WorkflowEngineTest {

    private ObjectMapper om;
    private WorkflowEngine engine;
    private WorkflowValidator validator;

    @BeforeEach
    void setUp() {
        om = new ObjectMapper();
        validator = new WorkflowValidator(om);
        engine = new WorkflowEngine(om, validator);
    }

    private static WorkflowDefinition fixture() {
        WorkflowDefinition def = new WorkflowDefinition();
        def.id = "test_wf";
        def.title = "Test";
        def.steps = new java.util.ArrayList<>();

        WorkflowDefinition.Step s1 = new WorkflowDefinition.Step();
        s1.id = "name";
        s1.prompt = "Quel est ton nom ?";
        s1.expectsData = Map.of("name", "string");
        def.steps.add(s1);

        WorkflowDefinition.Step s2 = new WorkflowDefinition.Step();
        s2.id = "confirm";
        s2.prompt = "Recap : {{summary}}\nOK ?";
        s2.expectsData = Map.of("confirm", "boolean");
        s2.action = "create_something";
        def.steps.add(s2);
        return def;
    }

    private static AssistantWorkflowRun newRun() {
        AssistantWorkflowRun r = new AssistantWorkflowRun(1L, "user-1", null, "test_wf");
        r.setId(42L);
        return r;
    }

    @Test
    void collectData_storesResponseUnderStepId() throws Exception {
        WorkflowDefinition def = fixture();
        AssistantWorkflowRun run = newRun();

        engine.collectData(run, def, "Alice");

        JsonNode collected = om.readTree(run.getCollectedData());
        assertEquals("Alice", collected.path("name").asText());
    }

    @Test
    void collectData_appendsMultipleSteps() throws Exception {
        WorkflowDefinition def = fixture();
        AssistantWorkflowRun run = newRun();

        engine.collectData(run, def, "Alice");
        engine.advanceStep(run, def);
        engine.collectData(run, def, "oui");

        JsonNode collected = om.readTree(run.getCollectedData());
        assertEquals("Alice", collected.path("name").asText());
        assertEquals("oui", collected.path("confirm").asText());
    }

    @Test
    void collectData_blankResponse_noOp() {
        WorkflowDefinition def = fixture();
        AssistantWorkflowRun run = newRun();
        engine.collectData(run, def, "  ");
        assertNull(run.getCollectedData());
    }

    @Test
    void advanceStep_incrementsIndex_thenMarksCompleted() {
        WorkflowDefinition def = fixture();
        AssistantWorkflowRun run = newRun();

        assertEquals(0, run.getCurrentStepIdx());
        engine.advanceStep(run, def);
        assertEquals(1, run.getCurrentStepIdx());
        assertEquals(AssistantWorkflowRun.Status.ACTIVE, run.getStatusEnum());

        // Au dernier step, on marque COMPLETED
        engine.advanceStep(run, def);
        assertEquals(AssistantWorkflowRun.Status.COMPLETED, run.getStatusEnum());
        assertNotNull(run.getCompletedAt());
    }

    @Test
    void advanceStep_idempotentOnCompletedRun() {
        WorkflowDefinition def = fixture();
        AssistantWorkflowRun run = newRun();
        run.setStatusEnum(AssistantWorkflowRun.Status.COMPLETED);
        run.setCurrentStepIdx(1);

        int idx = engine.advanceStep(run, def);
        assertEquals(1, idx);
        assertEquals(AssistantWorkflowRun.Status.COMPLETED, run.getStatusEnum());
    }

    @Test
    void renderPrompt_interpolatesSummary() {
        WorkflowDefinition def = fixture();
        AssistantWorkflowRun run = newRun();
        engine.collectData(run, def, "Alice");
        engine.advanceStep(run, def);

        WorkflowDefinition.Step confirmStep = def.steps.get(1);
        String rendered = engine.renderPrompt(confirmStep, run);

        assertTrue(rendered.contains("name"));
        assertTrue(rendered.contains("Alice"));
        assertFalse(rendered.contains("{{summary}}"),
                "Le placeholder doit etre remplace");
    }

    @Test
    void renderPrompt_summaryEmpty_whenNoData() {
        WorkflowDefinition def = fixture();
        AssistantWorkflowRun run = newRun();
        String rendered = engine.renderPrompt(def.steps.get(1), run);
        assertTrue(rendered.contains("aucune donnee"));
    }

    @Test
    void executeStepAction_returnsToolSuggestionWithCollectedData() throws Exception {
        WorkflowDefinition def = fixture();
        AssistantWorkflowRun run = newRun();
        engine.collectData(run, def, "Alice");
        engine.advanceStep(run, def);
        engine.collectData(run, def, "oui");

        Map<String, Object> suggestion = engine.executeStepAction(def.steps.get(1), run);

        assertEquals("create_something", suggestion.get("toolName"));
        assertNotNull(suggestion.get("collectedData"));
        assertTrue(suggestion.get("reason").toString().contains("confirm"));
    }

    @Test
    void executeStepAction_noActionDeclared_returnsEmptyMap() {
        WorkflowDefinition def = fixture();
        AssistantWorkflowRun run = newRun();
        Map<String, Object> suggestion = engine.executeStepAction(def.steps.get(0), run);
        assertTrue(suggestion.isEmpty());
    }

    @Test
    void currentStep_outOfRange_returnsNull() {
        WorkflowDefinition def = fixture();
        AssistantWorkflowRun run = newRun();
        run.setCurrentStepIdx(99);
        assertNull(engine.currentStep(run, def));

        run.setCurrentStepIdx(-1);
        assertNull(engine.currentStep(run, def));
    }

    @Test
    void emptyDefinitionSteps_advanceMarksCompletedImmediately() {
        WorkflowDefinition def = new WorkflowDefinition();
        def.id = "empty";
        def.steps = List.of();
        AssistantWorkflowRun run = newRun();

        // Avec liste vide, l'index 0 est >= taille (0) → marque COMPLETED
        engine.advanceStep(run, def);
        assertEquals(AssistantWorkflowRun.Status.COMPLETED, run.getStatusEnum());
    }

    // ─── Multilingual ───────────────────────────────────────────────────────

    @Test
    void renderPrompt_selectsByLanguage_whenPromptsMapPresent() {
        WorkflowDefinition.Step step = new WorkflowDefinition.Step();
        step.id = "s1";
        step.prompts = Map.of(
                "fr", "Quel est ton nom ?",
                "en", "What is your name?",
                "ar", "ما اسمك؟"
        );
        AssistantWorkflowRun run = newRun();

        assertEquals("Quel est ton nom ?", engine.renderPrompt(step, run, "fr"));
        assertEquals("What is your name?", engine.renderPrompt(step, run, "en"));
        assertEquals("ما اسمك؟", engine.renderPrompt(step, run, "ar"));
    }

    @Test
    void renderPrompt_unknownLanguage_fallsBackToFr() {
        WorkflowDefinition.Step step = new WorkflowDefinition.Step();
        step.prompts = Map.of("fr", "FR", "en", "EN");
        AssistantWorkflowRun run = newRun();

        assertEquals("FR", engine.renderPrompt(step, run, "de"));
        assertEquals("FR", engine.renderPrompt(step, run, null));
    }

    @Test
    void renderPrompt_noPromptsMap_fallsBackToLegacyPromptField() {
        WorkflowDefinition.Step step = new WorkflowDefinition.Step();
        step.prompt = "Legacy prompt";
        AssistantWorkflowRun run = newRun();

        assertEquals("Legacy prompt", engine.renderPrompt(step, run, "fr"));
        assertEquals("Legacy prompt", engine.renderPrompt(step, run, "en"));
    }

    @Test
    void renderPrompt_interpolatesSummary_inSelectedLanguage() throws Exception {
        WorkflowDefinition def = fixture();
        AssistantWorkflowRun run = newRun();
        engine.collectData(run, def, "Alice");
        engine.advanceStep(run, def);

        WorkflowDefinition.Step multilingualStep = new WorkflowDefinition.Step();
        multilingualStep.prompts = Map.of(
                "fr", "Recap FR : {{summary}}",
                "en", "Recap EN: {{summary}}"
        );
        String fr = engine.renderPrompt(multilingualStep, run, "fr");
        assertTrue(fr.startsWith("Recap FR"));
        assertTrue(fr.contains("Alice"));

        String en = engine.renderPrompt(multilingualStep, run, "en");
        assertTrue(en.startsWith("Recap EN"));
        assertTrue(en.contains("Alice"));
    }

    // ─── Validation (item #11) ──────────────────────────────────────────────

    @Test
    void collectData_validResponse_storesNormally() {
        WorkflowDefinition.Step step = new WorkflowDefinition.Step();
        step.id = "n";
        step.expectsData = Map.of("name", "string");
        WorkflowDefinition def = new WorkflowDefinition();
        def.id = "wf";
        def.steps = List.of(step);
        AssistantWorkflowRun run = newRun();

        // String non vide → OK
        assertDoesNotThrow(() -> engine.collectData(run, def, "Alice"));
    }

    @Test
    void collectData_singleNumberField_rejectsInvalidNumber() {
        WorkflowDefinition.Step step = new WorkflowDefinition.Step();
        step.id = "n";
        step.expectsData = Map.of("price", "number");
        WorkflowDefinition def = new WorkflowDefinition();
        def.steps = List.of(step);
        AssistantWorkflowRun run = newRun();

        WorkflowValidationException ex = assertThrows(WorkflowValidationException.class,
                () -> engine.collectData(run, def, "not-a-number"));
        assertEquals("n", ex.getStepId());
        assertTrue(ex.getMessage().toLowerCase().contains("number"));
    }

    @Test
    void collectData_singleBooleanField_acceptsFrenchTokens() {
        WorkflowDefinition.Step step = new WorkflowDefinition.Step();
        step.id = "b";
        step.expectsData = Map.of("ok", "boolean");
        WorkflowDefinition def = new WorkflowDefinition();
        def.steps = List.of(step);
        AssistantWorkflowRun run = newRun();

        assertDoesNotThrow(() -> engine.collectData(run, def, "oui"));
        assertDoesNotThrow(() -> engine.collectData(newRun(), def, "non"));
        assertDoesNotThrow(() -> engine.collectData(newRun(), def, "true"));

        assertThrows(WorkflowValidationException.class,
                () -> engine.collectData(newRun(), def, "peut-etre"));
    }

    @Test
    void collectData_singleStringArrayField_rejectsEmpty() {
        WorkflowDefinition.Step step = new WorkflowDefinition.Step();
        step.id = "l";
        step.expectsData = Map.of("items", "string[]");
        WorkflowDefinition def = new WorkflowDefinition();
        def.steps = List.of(step);
        AssistantWorkflowRun run = newRun();

        assertDoesNotThrow(() -> engine.collectData(run, def, "a, b, c"));

        // Blank → no-op (pas de validation)
        AssistantWorkflowRun run2 = newRun();
        assertDoesNotThrow(() -> engine.collectData(run2, def, "   "));
    }

    @Test
    void collectData_multiFieldStep_expectsJsonObject() {
        WorkflowDefinition.Step step = new WorkflowDefinition.Step();
        step.id = "multi";
        step.expectsData = Map.of("name", "string", "age", "number");
        WorkflowDefinition def = new WorkflowDefinition();
        def.steps = List.of(step);
        AssistantWorkflowRun run = newRun();

        // Texte libre → throw avec message indiquant le JSON attendu
        WorkflowValidationException ex = assertThrows(WorkflowValidationException.class,
                () -> engine.collectData(run, def, "Alice 30"));
        assertTrue(ex.getMessage().toLowerCase().contains("json"));

        // JSON valide → OK
        AssistantWorkflowRun run2 = newRun();
        assertDoesNotThrow(() -> engine.collectData(run2, def,
                "{\"name\":\"Alice\",\"age\":30}"));

        // JSON avec champ manquant → throw
        AssistantWorkflowRun run3 = newRun();
        WorkflowValidationException ex2 = assertThrows(WorkflowValidationException.class,
                () -> engine.collectData(run3, def, "{\"name\":\"Alice\"}"));
        assertTrue(ex2.getMessage().toLowerCase().contains("age"));

        // JSON avec type incorrect → throw
        AssistantWorkflowRun run4 = newRun();
        WorkflowValidationException ex3 = assertThrows(WorkflowValidationException.class,
                () -> engine.collectData(run4, def,
                        "{\"name\":\"Alice\",\"age\":\"trente\"}"));
        assertTrue(ex3.getMessage().toLowerCase().contains("number"));
    }

    @Test
    void collectData_noExpectsData_acceptsAnyResponse() {
        WorkflowDefinition.Step step = new WorkflowDefinition.Step();
        step.id = "free";
        WorkflowDefinition def = new WorkflowDefinition();
        def.steps = List.of(step);
        AssistantWorkflowRun run = newRun();

        assertDoesNotThrow(() -> engine.collectData(run, def, "n'importe quoi"));
    }
}
