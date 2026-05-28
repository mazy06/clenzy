package com.clenzy.service.agent.multiagent;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SpecialistRegistryTest {

    private static AgentSpecialist mockSpec(String name, String domain, String desc, Set<String> tools) {
        AgentSpecialist spec = mock(AgentSpecialist.class);
        when(spec.name()).thenReturn(name);
        when(spec.domain()).thenReturn(domain);
        when(spec.description()).thenReturn(desc);
        when(spec.toolNames()).thenReturn(tools);
        return spec;
    }

    @SuppressWarnings("unchecked")
    private static SpecialistRegistry registryWith(AgentSpecialist... specs) {
        ObjectProvider<AgentSpecialist> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenAnswer(inv -> Stream.of(specs));
        SpecialistRegistry registry = new SpecialistRegistry(provider);
        registry.initialize();
        return registry;
    }

    @Test
    void empty_registry_initializes_without_error() {
        SpecialistRegistry registry = registryWith();
        assertThat(registry.size()).isZero();
        assertThat(registry.all()).isEmpty();
        assertThat(registry.find("anything")).isEmpty();
    }

    @Test
    void finds_specialist_by_name() {
        AgentSpecialist a = mockSpec("a", "d", "desc", Set.of("t1"));
        AgentSpecialist b = mockSpec("b", "d", "desc", Set.of("t2"));
        SpecialistRegistry registry = registryWith(a, b);
        assertThat(registry.find("a")).contains(a);
        assertThat(registry.find("b")).contains(b);
        assertThat(registry.find("unknown")).isEmpty();
    }

    @Test
    void find_with_null_returns_empty() {
        SpecialistRegistry registry = registryWith();
        assertThat(registry.find(null)).isEmpty();
    }

    @Test
    void duplicate_name_fails_initialization_fast() {
        AgentSpecialist a1 = mockSpec("same", "d", "desc", Set.of("t1"));
        AgentSpecialist a2 = mockSpec("same", "d", "desc", Set.of("t2"));
        @SuppressWarnings("unchecked")
        ObjectProvider<AgentSpecialist> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenAnswer(inv -> Stream.of(a1, a2));
        SpecialistRegistry registry = new SpecialistRegistry(provider);
        assertThatThrownBy(registry::initialize)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Duplicate AgentSpecialist name");
    }

    @Test
    void blank_name_fails_fast() {
        AgentSpecialist bad = mockSpec("", "d", "desc", Set.of("t"));
        @SuppressWarnings("unchecked")
        ObjectProvider<AgentSpecialist> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenAnswer(inv -> Stream.of(bad));
        SpecialistRegistry registry = new SpecialistRegistry(provider);
        assertThatThrownBy(registry::initialize)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("blank name");
    }

    @Test
    void empty_tool_set_fails_fast() {
        AgentSpecialist bad = mockSpec("a", "d", "desc", Set.of());
        @SuppressWarnings("unchecked")
        ObjectProvider<AgentSpecialist> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenAnswer(inv -> Stream.of(bad));
        SpecialistRegistry registry = new SpecialistRegistry(provider);
        assertThatThrownBy(registry::initialize)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("empty tool set");
    }

    @Test
    void tool_set_over_limit_logs_warning_but_does_not_fail() {
        // 11 tools > MAX_TOOLS_PER_SPECIALIST (10) → warning seulement
        Set<String> tooMany = Set.of("t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10", "t11");
        AgentSpecialist a = mockSpec("a", "d", "desc", tooMany);
        SpecialistRegistry registry = registryWith(a);  // ne throw pas
        assertThat(registry.size()).isEqualTo(1);
    }

    @Test
    void all_returns_immutable_map() {
        AgentSpecialist a = mockSpec("a", "d", "desc", Set.of("t1"));
        SpecialistRegistry registry = registryWith(a);
        assertThatThrownBy(() -> registry.all().clear())
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
