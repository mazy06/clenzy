package com.clenzy.service.agent;

import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.function.Function;

/** Opt-in boundary: commit admission before work, and receipt before terminal SSE. */
@Service
public class BaitlyChatTurnExecutor {
    private final BaitlyChatCompletionJournal journal;
    public BaitlyChatTurnExecutor(BaitlyChatCompletionJournal journal) { this.journal=journal; }

    public void requireLegacyUntracked(Long org,String user,Long conversation,String pendingId) {
        journal.requireLegacyUntracked(org,user,conversation,pendingId);
    }

    public Long execute(UUID request, Long organization, String user, Long conversation, String pendingId,
                        Function<Consumer<AgentSseEvent>,Long> work, Consumer<AgentSseEvent> downstream) {
        return execute(request,organization,user,conversation,pendingId,work,downstream,false);
    }
    public Long executeWithTools(UUID request, Long organization, String user, Long conversation, String pendingId,
                        Function<Consumer<AgentSseEvent>,Long> work, Consumer<AgentSseEvent> downstream) {
        return execute(request,organization,user,conversation,pendingId,work,downstream,true);
    }
    private Long execute(UUID request, Long organization, String user, Long conversation, String pendingId,
                        Function<Consumer<AgentSseEvent>,Long> work, Consumer<AgentSseEvent> downstream,boolean toolsPolicy) {
        if(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()) throw unavailable();
        var ticket=new AtomicReference<BaitlyChatCompletionJournal.Ticket>();
        try (var observation=BaitlyChatTurnObservation.open()) {
            Long target=conversation;
            if(pendingId!=null) {
                Long owned=journal.pendingConversation(organization,user,pendingId);
                if(target!=null && !target.equals(owned)) throw unavailable();
                target=owned;
            }
            if(target!=null) ticket.set(toolsPolicy?journal.begin(organization,user,target,request,pendingId,true):
                journal.begin(organization,user,target,request,pendingId));
            if(ticket.get()!=null) observation.bind(journal,ticket.get());
            var terminal=new ArrayList<AgentSseEvent>();
            Long result=work.apply(event -> {
                if("conversation_created".equals(event.type())) {
                    if(ticket.get()!=null || event.conversationId()==null) throw unavailable();
                    ticket.set(toolsPolicy?journal.begin(organization,user,event.conversationId(),request,pendingId,true):
                        journal.begin(organization,user,event.conversationId(),request,pendingId));
                    observation.bind(journal,ticket.get());
                }
                observation.observe(event);
                if("done".equals(event.type()) || "paused_awaiting_confirmation".equals(event.type()) || "error".equals(event.type())) {
                    terminal.add("error".equals(event.type())?AgentSseEvent.error("Baitly chat completion unavailable"):event);
                } else {
                    downstream.accept(event);
                }
            });
            if(ticket.get()==null || !ticket.get().conversationId().equals(result)) throw unavailable();
            journal.finish(ticket.get(),observation);
            terminal.forEach(downstream);
            return result;
        } catch (Exception error) {
            if(ticket.get()!=null) {
                try { journal.uncertain(ticket.get()); } catch(Exception ignored) { /* RUNNING remains a fence. */ }
            }
            throw unavailable();
        }
    }
    private static IllegalStateException unavailable() { return new IllegalStateException("Baitly chat completion unavailable"); }
}
