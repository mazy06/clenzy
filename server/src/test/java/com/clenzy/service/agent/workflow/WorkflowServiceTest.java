package com.clenzy.service.agent.workflow;

import com.clenzy.model.AssistantWorkflowRun;
import com.clenzy.repository.AssistantWorkflowRunRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class WorkflowServiceTest {

    private WorkflowRegistry registry;
    private WorkflowEngine engine;
    private AssistantWorkflowRunRepository repository;
    private WorkflowService service;

    @BeforeEach
    void setUp() {
        registry = mock(WorkflowRegistry.class);
        ObjectMapper om = new ObjectMapper();
        engine = new WorkflowEngine(om, new WorkflowValidator(om));
        repository = mock(AssistantWorkflowRunRepository.class);
        service = new WorkflowService(registry, engine, repository);
        when(repository.save(any(AssistantWorkflowRun.class)))
                .thenAnswer(inv -> {
                    AssistantWorkflowRun run = inv.getArgument(0);
                    if (run.getId() == null) run.setId(1L);
                    return run;
                });
    }

    private static WorkflowDefinition twoStepDef() {
        WorkflowDefinition def = new WorkflowDefinition();
        def.id = "wf";
        def.title = "Two step";
        def.estimatedDuration = 5;
        def.steps = new java.util.ArrayList<>();

        WorkflowDefinition.Step s1 = new WorkflowDefinition.Step();
        s1.id = "name";
        s1.title = "Nom";
        s1.prompt = "Quel est ton nom ?";
        s1.expectsData = Map.of("name", "string");
        def.steps.add(s1);

        WorkflowDefinition.Step s2 = new WorkflowDefinition.Step();
        s2.id = "confirm";
        s2.title = "Confirmer";
        s2.prompt = "Recap : {{summary}}\nOn y va ?";
        s2.expectsData = Map.of("confirm", "boolean");
        s2.action = "create_thing";
        def.steps.add(s2);

        return def;
    }

    @Test
    void startWorkflow_createsRun_andReturnsFirstStep() {
        when(registry.getById("wf")).thenReturn(Optional.of(twoStepDef()));

        WorkflowService.WorkflowRunSnapshot snapshot = service.startWorkflow(
                "wf", 1L, "user-1", null);

        assertEquals("wf", snapshot.workflowId);
        assertEquals(0, snapshot.currentStepIdx);
        assertEquals("ACTIVE", snapshot.status);
        assertNotNull(snapshot.currentStep);
        assertEquals("name", snapshot.currentStep.id);
        assertEquals("Quel est ton nom ?", snapshot.currentStep.prompt);
        assertEquals(2, snapshot.totalSteps);
        verify(repository).save(any(AssistantWorkflowRun.class));
    }

    @Test
    void startWorkflow_unknownId_throws() {
        when(registry.getById("ghost")).thenReturn(Optional.empty());
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.startWorkflow("ghost", 1L, "u", null));
        assertTrue(ex.getMessage().contains("ghost"));
    }

    @Test
    void advanceWorkflow_storesResponse_movesToNextStep_interpolatesSummary() {
        WorkflowDefinition def = twoStepDef();
        when(registry.getById("wf")).thenReturn(Optional.of(def));

        AssistantWorkflowRun run = new AssistantWorkflowRun(1L, "user-1", null, "wf");
        run.setId(7L);
        when(repository.findByIdAndUser(7L, "user-1")).thenReturn(Optional.of(run));

        WorkflowService.WorkflowRunSnapshot snapshot = service.advanceWorkflow(
                7L, "user-1", "Alice");

        assertEquals(1, snapshot.currentStepIdx);
        assertEquals("confirm", snapshot.currentStep.id);
        // {{summary}} doit avoir ete interpole avec la valeur "Alice"
        assertTrue(snapshot.currentStep.prompt.contains("Alice"));
        assertFalse(snapshot.currentStep.prompt.contains("{{summary}}"));
        // collected_data persiste
        assertNotNull(snapshot.collectedDataJson);
        assertTrue(snapshot.collectedDataJson.contains("Alice"));
    }

    @Test
    void advanceWorkflow_lastStepWithAction_includesSuggestedAction() {
        WorkflowDefinition def = twoStepDef();
        when(registry.getById("wf")).thenReturn(Optional.of(def));

        AssistantWorkflowRun run = new AssistantWorkflowRun(1L, "user-1", null, "wf");
        run.setId(7L);
        run.setCurrentStepIdx(1); // sur le dernier step
        when(repository.findByIdAndUser(7L, "user-1")).thenReturn(Optional.of(run));

        WorkflowService.WorkflowRunSnapshot snapshot = service.advanceWorkflow(
                7L, "user-1", "oui");

        assertEquals("COMPLETED", snapshot.status);
        assertNull(snapshot.currentStep, "Plus de step a faire");
        assertNotNull(snapshot.suggestedAction);
        assertEquals("create_thing", snapshot.suggestedAction.get("toolName"));
    }

    @Test
    void advanceWorkflow_unknownRunId_throws() {
        when(repository.findByIdAndUser(99L, "user-1")).thenReturn(Optional.empty());
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.advanceWorkflow(99L, "user-1", "x"));
        assertTrue(ex.getMessage().contains("99"));
    }

    @Test
    void advanceWorkflow_completedRun_throwsIllegalState() {
        AssistantWorkflowRun run = new AssistantWorkflowRun(1L, "user-1", null, "wf");
        run.setId(5L);
        run.setStatusEnum(AssistantWorkflowRun.Status.COMPLETED);
        when(repository.findByIdAndUser(5L, "user-1")).thenReturn(Optional.of(run));

        assertThrows(IllegalStateException.class,
                () -> service.advanceWorkflow(5L, "user-1", "x"));
    }

    @Test
    void advanceWorkflow_definitionMissing_throwsIllegalState() {
        AssistantWorkflowRun run = new AssistantWorkflowRun(1L, "user-1", null, "wf");
        run.setId(5L);
        when(repository.findByIdAndUser(5L, "user-1")).thenReturn(Optional.of(run));
        when(registry.getById("wf")).thenReturn(Optional.empty());

        assertThrows(IllegalStateException.class,
                () -> service.advanceWorkflow(5L, "user-1", "x"));
    }

    @Test
    void abandonWorkflow_marksAbandoned_idempotent() {
        AssistantWorkflowRun run = new AssistantWorkflowRun(1L, "user-1", null, "wf");
        run.setId(5L);
        when(repository.findByIdAndUser(5L, "user-1")).thenReturn(Optional.of(run));

        service.abandonWorkflow(5L, "user-1");
        assertEquals(AssistantWorkflowRun.Status.ABANDONED, run.getStatusEnum());
        assertNotNull(run.getCompletedAt());

        // Second appel : no-op
        service.abandonWorkflow(5L, "user-1");
        // Toujours ABANDONED, pas de RuntimeException
        assertEquals(AssistantWorkflowRun.Status.ABANDONED, run.getStatusEnum());
    }

    @Test
    void abandonWorkflow_unknownRun_noOp() {
        when(repository.findByIdAndUser(eq(99L), anyString())).thenReturn(Optional.empty());
        assertDoesNotThrow(() -> service.abandonWorkflow(99L, "u"));
    }
}
