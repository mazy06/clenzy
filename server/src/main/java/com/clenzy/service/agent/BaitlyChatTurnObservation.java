package com.clenzy.service.agent;

/** Thread-bound observation for the opt-in candidate, never an execution permit. */
public final class BaitlyChatTurnObservation implements AutoCloseable {
    private static final ThreadLocal<BaitlyChatTurnObservation> CURRENT = new ThreadLocal<>();
    boolean toolsRequested;
    boolean executed;
    boolean multiAgent;
    boolean error;
    boolean paused;
    int completions;
    Long assistantMessageId;
    String finishReason;
    int doneCount;
    String doneReason;
    final java.util.Set<String> executedIds=new java.util.HashSet<>();
    boolean conflictingExecution;
    private BaitlyChatCompletionJournal journal;
    private BaitlyChatCompletionJournal.Ticket ticket;

    void bind(BaitlyChatCompletionJournal journal, BaitlyChatCompletionJournal.Ticket ticket) {
        this.journal=journal; this.ticket=ticket;
    }
    static void toolStarted(String id, ToolHandler handler, AgentContext context, Long conversationId) {
        var current=CURRENT.get();
        if(current!=null) {
            current.toolsRequested=true;
            if(current.journal==null || current.ticket==null) throw new IllegalStateException("Baitly chat completion unavailable");
            if(context==null || !current.ticket.organizationId().equals(context.organizationId())
                    || !current.ticket.userId().equals(context.keycloakId())
                    || !current.ticket.conversationId().equals(conversationId))
                throw new IllegalStateException("Baitly chat completion unavailable");
            current.journal.startTool(current.ticket,id,handler);
        }
    }
    static void toolPersisted(String id, Long messageId, boolean error) {
        var current=CURRENT.get();
        if(current!=null) {
            if(current.journal==null || current.ticket==null) throw new IllegalStateException("Baitly chat completion unavailable");
            current.journal.finishTool(current.ticket,id,messageId,error);
        }
    }

    private BaitlyChatTurnObservation() { CURRENT.set(this); }
    static BaitlyChatTurnObservation open() {
        if (CURRENT.get() != null) throw new IllegalStateException("Baitly chat completion unavailable");
        return new BaitlyChatTurnObservation();
    }
    static boolean active() { return CURRENT.get()!=null; }
    static void toolsRequested() { var current=CURRENT.get(); if(current!=null) current.toolsRequested=true; }
    static void multiAgent() { var current=CURRENT.get(); if(current!=null) current.multiAgent=true; }
    static void textPersisted(Long id, String reason) {
        var current=CURRENT.get();
        if(current!=null) { current.completions++; current.assistantMessageId=id; current.finishReason=reason; }
    }
    void observe(AgentSseEvent event) {
        if ("error".equals(event.type())) error=true;
        if ("tool_call_executed".equals(event.type())) {
            executed=true;
            if(event.toolCallId()==null || !Boolean.FALSE.equals(event.toolError()) || !executedIds.add(event.toolCallId())) conflictingExecution=true;
        }
        if ("paused_awaiting_confirmation".equals(event.type())) paused=true;
        if ("done".equals(event.type())) { doneCount++; doneReason=event.finishReason(); }
    }
    boolean safeTextCandidate() {
        return !toolsRequested && !executed && !multiAgent && !error && !paused && completions==1
                && doneCount==1 && java.util.Objects.equals(finishReason,doneReason)
                && assistantMessageId!=null && ("end_turn".equals(finishReason) || "stop".equals(finishReason));
    }
    boolean safeToolsCandidate() {
        return toolsRequested && executed && !conflictingExecution && !multiAgent && !error && !paused
                && completions==1 && doneCount==1 && java.util.Objects.equals(finishReason,doneReason)
                && assistantMessageId!=null && ("end_turn".equals(finishReason) || "stop".equals(finishReason));
    }
    @Override public void close() { CURRENT.remove(); }
}
