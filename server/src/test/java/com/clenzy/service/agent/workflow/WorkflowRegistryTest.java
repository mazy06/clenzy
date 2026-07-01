package com.clenzy.service.agent.workflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.ResourcePatternResolver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class WorkflowRegistryTest {

    private ObjectMapper yamlMapper;

    @BeforeEach
    void setUp() {
        yamlMapper = new YAMLMapper();
    }

    private WorkflowRegistry registryWith(String... yamlContents) {
        Resource[] resources = new Resource[yamlContents.length];
        for (int i = 0; i < yamlContents.length; i++) {
            final int idx = i;
            resources[i] = new ByteArrayResource(yamlContents[i].getBytes(StandardCharsets.UTF_8)) {
                @Override
                public String getFilename() { return "wf_" + idx + ".yaml"; }
            };
        }
        ResourcePatternResolver resolver = new PathMatchingResourcePatternResolver() {
            @Override
            public Resource[] getResources(String location) { return resources; }
        };
        WorkflowRegistry r = new WorkflowRegistry(yamlMapper, resolver);
        r.loadAll();
        return r;
    }

    @Test
    void loadAll_parsesValidWorkflow() {
        WorkflowRegistry r = registryWith("""
                id: my_wf
                title: Mon workflow
                description: Description
                estimatedDuration: 10
                steps:
                  - id: step1
                    prompt: Premier prompt
                """);

        assertEquals(1, r.size());
        Optional<WorkflowDefinition> def = r.getById("my_wf");
        assertTrue(def.isPresent());
        assertEquals("Mon workflow", def.get().title);
        assertEquals(1, def.get().steps.size());
        assertEquals("step1", def.get().steps.get(0).id);
    }

    @Test
    void loadAll_ignoresWorkflowWithoutId() {
        WorkflowRegistry r = registryWith("""
                title: No id workflow
                steps:
                  - id: a
                    prompt: P
                """);
        assertEquals(0, r.size());
    }

    @Test
    void loadAll_ignoresWorkflowWithoutSteps() {
        WorkflowRegistry r = registryWith("""
                id: empty_wf
                title: Empty
                """);
        assertEquals(0, r.size());
    }

    @Test
    void loadAll_ignoresStepMissingIdOrPrompt() {
        WorkflowRegistry r = registryWith("""
                id: bad_wf
                steps:
                  - prompt: "Step sans id"
                """);
        assertEquals(0, r.size());

        r = registryWith("""
                id: bad_wf_2
                steps:
                  - id: a
                """);
        assertEquals(0, r.size());
    }

    @Test
    void loadAll_skipsDuplicateIds() {
        WorkflowRegistry r = registryWith(
                """
                id: dup
                steps:
                  - id: a
                    prompt: First instance
                """,
                """
                id: dup
                steps:
                  - id: b
                    prompt: Second instance (ignored)
                """
        );
        assertEquals(1, r.size());
        assertEquals("a", r.getById("dup").orElseThrow().steps.get(0).id);
    }

    @Test
    void loadAll_continuesOnInvalidYaml() {
        WorkflowRegistry r = registryWith(
                "this is not valid: yaml: at all: !@#",
                """
                id: good
                steps:
                  - id: only
                    prompt: Toujours la
                """
        );
        assertEquals(1, r.size());
        assertTrue(r.getById("good").isPresent());
    }

    @Test
    void listAll_preservesInsertionOrder() {
        WorkflowRegistry r = registryWith(
                "id: a\nsteps:\n  - id: s\n    prompt: p\n",
                "id: b\nsteps:\n  - id: s\n    prompt: p\n",
                "id: c\nsteps:\n  - id: s\n    prompt: p\n"
        );
        List<String> ids = r.listAll().stream().map(d -> d.id).toList();
        assertEquals(List.of("a", "b", "c"), ids);
    }

    @Test
    void getById_unknownId_returnsEmpty() {
        WorkflowRegistry r = registryWith("id: x\nsteps:\n  - id: s\n    prompt: p\n");
        assertTrue(r.getById("does-not-exist").isEmpty());
        assertTrue(r.getById(null).isEmpty());
    }

    @Test
    void scanFailure_leavesRegistryEmpty() {
        ResourcePatternResolver failing = new PathMatchingResourcePatternResolver() {
            @Override
            public Resource[] getResources(String location) throws IOException {
                throw new IOException("disk full");
            }
        };
        WorkflowRegistry r = new WorkflowRegistry(yamlMapper, failing);
        r.loadAll();
        assertEquals(0, r.size());
    }

    @Test
    void productionDataset_loadsAllWorkflows() {
        // Sanity check : on charge depuis le classpath reel et on verifie les workflows livres.
        WorkflowRegistry r = new WorkflowRegistry();
        r.loadAll();
        assertTrue(r.size() >= 7,
                "Au moins 7 workflows attendus, got " + r.size());
        // Socle historique
        assertTrue(r.getById("onboard_property").isPresent());
        assertTrue(r.getById("end_of_month_closing").isPresent());
        assertTrue(r.getById("prepare_high_season").isPresent());
        // P2-13 : nouveaux workflows guides
        assertTrue(r.getById("incident_resolution").isPresent());
        assertTrue(r.getById("seasonal_repricing").isPresent());
        assertTrue(r.getById("owner_reporting").isPresent());
        assertTrue(r.getById("new_listing_optimization").isPresent());
    }
}
