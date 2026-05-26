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

    @BeforeEach
    void setUp() {
        om = new ObjectMapper();
        engine = new WorkflowEngine(om);
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
}
