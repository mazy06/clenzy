package com.clenzy.service.agent;

import com.clenzy.config.ai.ToolDescriptor;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ToolRegistryTest {

    private static final ObjectMapper OM = new ObjectMapper();

    private static ToolHandler fakeTool(String name) {
        return new ToolHandler() {
            @Override public String name() { return name; }
            @Override public ToolDescriptor descriptor() {
                try {
                    JsonNode schema = OM.readTree("{\"type\":\"object\",\"properties\":{}}");
                    return ToolDescriptor.readOnly(name, "fake " + name, schema);
                } catch (Exception e) { throw new RuntimeException(e); }
            }
            @Override public ToolResult execute(JsonNode args, AgentContext context) {
                return ToolResult.success("{}");
            }
        };
    }

    @Test
    void emptyList_registryIsEmpty() {
        ToolRegistry reg = new ToolRegistry(List.of());
        assertEquals(0, reg.size());
        assertTrue(reg.listDescriptors().isEmpty());
        assertTrue(reg.find("anything").isEmpty());
    }

    @Test
    void registersHandlersByName_andResolvesThem() {
        ToolRegistry reg = new ToolRegistry(List.of(fakeTool("a"), fakeTool("b")));
        assertEquals(2, reg.size());
        assertTrue(reg.find("a").isPresent());
        assertTrue(reg.find("b").isPresent());
        assertTrue(reg.find("missing").isEmpty());
    }

    @Test
    void listDescriptors_returnsOneDescriptorPerHandler() {
        ToolRegistry reg = new ToolRegistry(List.of(fakeTool("x"), fakeTool("y"), fakeTool("z")));
        List<ToolDescriptor> desc = reg.listDescriptors();
        assertEquals(3, desc.size());
        assertEquals("x", desc.get(0).name());
        assertEquals("y", desc.get(1).name());
        assertEquals("z", desc.get(2).name());
    }

    @Test
    void duplicateName_throwsAtBoot() {
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> new ToolRegistry(List.of(fakeTool("dup"), fakeTool("dup"))));
        assertTrue(ex.getMessage().contains("Duplicate"));
    }

    @Test
    void blankName_throwsAtBoot() {
        ToolHandler bad = new ToolHandler() {
            @Override public String name() { return "  "; }
            @Override public ToolDescriptor descriptor() {
                try {
                    return ToolDescriptor.readOnly("", "", OM.readTree("{}"));
                } catch (Exception e) { throw new RuntimeException(e); }
            }
            @Override public ToolResult execute(JsonNode args, AgentContext ctx) { return null; }
        };
        assertThrows(IllegalStateException.class, () -> new ToolRegistry(List.of(bad)));
    }

    @Test
    void mismatchedNameAndDescriptor_throwsAtBoot() {
        ToolHandler bad = new ToolHandler() {
            @Override public String name() { return "actual_name"; }
            @Override public ToolDescriptor descriptor() {
                try {
                    return ToolDescriptor.readOnly("different_name", "", OM.readTree("{}"));
                } catch (Exception e) { throw new RuntimeException(e); }
            }
            @Override public ToolResult execute(JsonNode args, AgentContext ctx) { return null; }
        };
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> new ToolRegistry(List.of(bad)));
        assertTrue(ex.getMessage().contains("mismatched"));
    }
}
