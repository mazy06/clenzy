import { useEffect, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '../../../components/ui';
import { MessageCircle, X, Send } from 'lucide-react';
import { API_CONFIG } from '../../../config/api';

/**
 * Concierge IA du site public (2.13) — bulle de chat flottante. Réponses en RAG côté serveur
 * (POST /concierge), org résolue par la clé API publique. Affiché seulement si l'org a activé
 * l'IA conversationnelle (GET /concierge/status). Hérite des CSS vars de thème (--accent, --card…)
 * car rendu DANS le conteneur thémé de la page publique.
 */

const API_BASE = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}`;

interface Msg { role: 'user' | 'assistant'; content: string }

export default function PublicConcierge({ apiKey }: { apiKey: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Statut du concierge — one-shot best-effort (indisponible => on n'affiche rien).
  const statusQuery = useQuery({
    queryKey: ['public-concierge-status', apiKey],
    queryFn: async (): Promise<{ available?: boolean }> => {
      const r = await fetch(`${API_BASE}/public/booking/widget/concierge/status`, {
        headers: { 'X-Booking-Key': apiKey },
      });
      return r.ok ? r.json() : { available: false };
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const available = Boolean(statusQuery.data?.available);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    const history = messages.slice(-6);
    setMessages((m) => [...m, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/public/booking/widget/concierge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Booking-Key': apiKey },
        body: JSON.stringify({ question, history }),
      });
      const data = res.ok ? await res.json() : null;
      const answer = data?.answer || "Désolé, je n'ai pas pu répondre. Réessayez ou contactez l'hôte.";
      setMessages((m) => [...m, { role: 'assistant', content: answer }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: "Désolé, une erreur est survenue. Réessayez plus tard." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!available) return null;

  return (
    <>
      {/* Bulle */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le concierge"
          className={
            'fixed bottom-6 end-6 z-[2147483600] w-[56px] h-[56px] rounded-full cursor-pointer '
            + 'inline-flex items-center justify-center border-none '
            + 'bg-[var(--accent,_#5453D6)] text-[var(--on-accent,_#fff)] shadow-[0_8px_28px_rgba(20,24,28,0.28)] '
            + '[transition:transform_var(--duration-fast,.15s)_ease,background-color_.15s_ease] motion-reduce:transition-none '
            + 'hover:bg-[var(--accent-deep,_#4140b0)] '
            + 'focus-visible:[outline:2px_solid_var(--accent,#5453D6)] focus-visible:[outline-offset:3px]'
          }
        >
          <MessageCircle size={26} strokeWidth={2} />
        </button>
      )}

      {/* Panneau */}
      {open && (
        <div
          role="dialog"
          aria-label="Concierge"
          className="fixed bottom-6 end-6 z-[2147483600] w-[calc(100vw-32px)] min-[600px]:w-[380px] max-w-[380px] h-[520px] max-h-[calc(100vh-48px)] flex flex-col overflow-hidden bg-[var(--card,_#fff)] text-[var(--ink,_#14181c)] border border-solid border-[var(--line,_#e5e7eb)] rounded-[var(--radius-lg,_16px)] shadow-[0_18px_48px_rgba(20,24,28,0.28)]"
        >
          <div className="flex items-center gap-1.5 px-3 h-[52px] shrink-0 bg-[var(--accent,_#5453D6)] text-[var(--on-accent,_#fff)]">
            <MessageCircle size={18} strokeWidth={2} />
            <div className="flex-1 font-bold text-[15px]">Concierge</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="w-[30px] h-[30px] shrink-0 rounded-full inline-flex items-center justify-center border-none bg-transparent text-inherit cursor-pointer transition-colors duration-150 hover:bg-[rgba(255,255,255,0.18)]"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="m-auto text-center text-[var(--muted,_#6b7280)] text-[13.5px] px-3 leading-[1.5]">
                Bonjour ! Une question sur les logements, l'arrivée, les équipements ? Je suis là pour vous aider.
              </div>
            )}
            {messages.map((m, i) => (
              <div className={cn('max-w-[85%] px-[9px] py-1.5 rounded-[var(--radius-md,_12px)] text-[14px] leading-[1.5] whitespace-pre-wrap', m.role === 'user' ? 'self-end' : 'self-start', m.role === 'user' ? 'bg-[var(--accent,_#5453D6)]' : 'bg-[var(--field,_#f3f4f6)]', m.role === 'user' ? 'text-[var(--on-accent,_#fff)]' : 'text-[var(--ink,_#14181c)]')} key={i}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="self-start px-2 py-1.5">
                <Spinner className="size-4 text-[var(--muted,_#6b7280)]" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 p-[7.5px] shrink-0" style={{ borderTop: '1px solid var(--line, #e5e7eb)' }}>
            <input className="flex-1 h-[40px] px-[9px] text-[14px] text-[var(--ink,_#14181c)] bg-[var(--field,_#f3f4f6)] border border-solid border-[var(--line,_#e5e7eb)] rounded-[var(--radius-md,_12px)] focus:border-[var(--accent,_#5453D6)]" style={{ outline: 'none' }} value={input} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') send(); }} placeholder="Posez votre question…" aria-label="Votre question" />
            <button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Envoyer"
              className={
                'w-[40px] h-[40px] shrink-0 inline-flex items-center justify-center border-none cursor-pointer '
                + 'rounded-[var(--radius-md,_12px)] bg-[var(--accent,_#5453D6)] text-[var(--on-accent,_#fff)] '
                + 'transition-colors duration-150 hover:bg-[var(--accent-deep,_#4140b0)] '
                + 'disabled:opacity-50 disabled:pointer-events-none'
              }
            >
              <Send size={17} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
