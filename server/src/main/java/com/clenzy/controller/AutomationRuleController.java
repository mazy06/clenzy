package com.clenzy.controller;

import com.clenzy.dto.AutomationExecutionDto;
import com.clenzy.dto.AutomationRuleDto;
import com.clenzy.dto.CreateAutomationRuleRequest;
import com.clenzy.service.AutomationRuleService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/automation-rules")
@PreAuthorize("isAuthenticated()")
public class AutomationRuleController {

    private final AutomationRuleService automationRuleService;

    public AutomationRuleController(AutomationRuleService automationRuleService) {
        this.automationRuleService = automationRuleService;
    }

    @GetMapping
    public ResponseEntity<List<AutomationRuleDto>> getAll() {
        return ResponseEntity.ok(automationRuleService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AutomationRuleDto> getById(@PathVariable Long id) {
        return automationRuleService.getById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<AutomationRuleDto> create(@Valid @RequestBody CreateAutomationRuleRequest request) {
        return ResponseEntity.ok(automationRuleService.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AutomationRuleDto> update(@PathVariable Long id,
                                                      @Valid @RequestBody CreateAutomationRuleRequest request) {
        return ResponseEntity.ok(automationRuleService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        automationRuleService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/toggle")
    public ResponseEntity<AutomationRuleDto> toggle(@PathVariable Long id) {
        return ResponseEntity.ok(automationRuleService.toggle(id));
    }

    @GetMapping("/{id}/executions")
    public ResponseEntity<Page<AutomationExecutionDto>> getExecutions(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(automationRuleService.getExecutions(id, page, size));
    }
}
