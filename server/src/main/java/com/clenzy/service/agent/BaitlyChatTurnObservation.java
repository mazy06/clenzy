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
        if ("tool_call_executed".equals(event.type())) executed=true;
        if ("paused_awaiting_confirmation".equals(event.type())) paused=true;
        if ("done".equals(event.type())) { doneCount++; doneReason=event.finishReason(); }
    }
    boolean safeTextCandidate() {
        return !toolsRequested && !executed && !multiAgent && !error && !paused && completions==1
                && doneCount==1 && java.util.Objects.equals(finishReason,doneReason)
                && assistantMessageId!=null && ("end_turn".equals(finishReason) || "stop".equals(finishReason));
    }
    @Override public void close() { CURRENT.remove(); }
}
