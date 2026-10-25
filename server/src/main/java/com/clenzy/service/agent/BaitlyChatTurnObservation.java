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
    boolean duplicateExecution;
    int pauseCount;
    final java.util.Set<String> erroredIds=new java.util.HashSet<>();
    final java.util.Set<String> declinedIds=new java.util.HashSet<>();
    private BaitlyChatCompletionJournal journal;
    private BaitlyChatCompletionJournal.Ticket ticket;
    private String writeCallId;
    private String writeKind;

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
            current.writeCallId=id;
            current.writeKind=handler!=null && handler.getClass()==com.clenzy.service.agent.tools.UpdatePropertyStatusTool.class
                ?"PROPERTY_STATUS_V1":handler!=null && handler.getClass()==com.clenzy.service.agent.tools.ForgetFactTool.class
                ?"MEMORY_DELETE_V1":null;
        }
    }
    static void toolPersisted(String id, Long messageId, boolean error) {
        var current=CURRENT.get();
        if(current!=null) {
            if(current.journal==null || current.ticket==null) throw new IllegalStateException("Baitly chat completion unavailable");
            try { current.journal.finishTool(current.ticket,id,messageId,error); }
            finally { current.writeCallId=null; current.writeKind=null; }
        }
    }
    /** Called at the business mutation boundary, inside its own database transaction. */
    public static void internalWriteCommitted(String kind,Long org,String user,Long resource,String targetState) {
        var current=CURRENT.get();
        if(current==null || current.writeKind==null) return;
        if(!current.writeKind.equals(kind) || !current.ticket.organizationId().equals(org)
                || (user!=null && !current.ticket.userId().equals(user))) {
            // Existing business authorization remains authoritative (including staff).
            // A different scope cannot obtain a certificate for this conversation.
            current.writeKind=null;
            return;
        }
        current.journal.recordWrite(current.ticket,current.writeCallId,kind,resource,targetState);
    }

    private BaitlyChatTurnObservation() { CURRENT.set(this); }
    static BaitlyChatTurnObservation open() {
        if (CURRENT.get() != null) throw new IllegalStateException("Baitly chat completion unavailable");
        return new BaitlyChatTurnObservation();
    }
    static boolean active() { return CURRENT.get()!=null; }
    static boolean writesPolicy() { var current=CURRENT.get(); return current!=null && current.ticket!=null && current.ticket.writesPolicy(); }
    static void declinedPersisted(String id,Long resultId) {
        var current=CURRENT.get();
        if(current!=null && current.ticket!=null && current.ticket.writesPolicy()) {
            current.journal.recordDecline(current.ticket,id,resultId);
            current.declinedIds.add(id);
        }
    }
    boolean continuationCandidate(boolean pause) {
        if(multiAgent || error || duplicateExecution || !declinedIds.containsAll(erroredIds)) return false;
        if(pause) return paused && pauseCount==1 && completions==0 && doneCount==0;
        return !paused && completions==1 && doneCount==1 && assistantMessageId!=null
            && java.util.Objects.equals(finishReason,doneReason)
            && java.util.Set.of("stop","end_turn").contains(java.util.Objects.toString(finishReason,""));
    }
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
            if(event.toolCallId()==null || !executedIds.add(event.toolCallId())) { conflictingExecution=true; duplicateExecution=true; }
            if(!Boolean.FALSE.equals(event.toolError())) { conflictingExecution=true; erroredIds.add(event.toolCallId()); }
        }
        if ("paused_awaiting_confirmation".equals(event.type())) { paused=true; pauseCount++; }
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
