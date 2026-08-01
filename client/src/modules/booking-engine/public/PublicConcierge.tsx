import { useEffect, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { useQuery } from '@tanstack/react-query';
import { Box, ButtonBase, CircularProgress } from '@mui/material';
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
        <ButtonBase
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le concierge"
          sx={{
            position: 'fixed', bottom: 24, insetInlineEnd: 24, zIndex: 2147483600,
            width: 56, height: 56, borderRadius: '50%', bgcolor: 'var(--accent, #5453D6)', color: 'var(--on-accent, #fff)',
            boxShadow: '0 8px 28px rgba(20,24,28,0.28)', cursor: 'pointer',
            transition: 'transform var(--duration-fast, .15s) ease, background .15s ease',
            '&:hover': { bgcolor: 'var(--accent-deep, #4140b0)' },
            '&:focus-visible': { outline: '2px solid var(--accent, #5453D6)', outlineOffset: 3 },
          }}
        >
          <MessageCircle size={26} strokeWidth={2} />
        </ButtonBase>
      )}

      {/* Panneau */}
      {open && (
        <Box
          role="dialog"
          aria-label="Concierge"
          sx={{
            position: 'fixed', bottom: 24, insetInlineEnd: 24, zIndex: 2147483600,
            width: { xs: 'calc(100vw - 32px)', sm: 380 }, maxWidth: 380, height: 520, maxHeight: 'calc(100vh - 48px)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            bgcolor: 'var(--card, #fff)', color: 'var(--ink, #14181c)',
            border: '1px solid var(--line, #e5e7eb)', borderRadius: 'var(--radius-lg, 16px)',
            boxShadow: '0 18px 48px rgba(20,24,28,0.28)',
          }}
        >
          <div className="flex items-center gap-1.5 px-3 h-[52px] shrink-0 bg-[var(--accent,_#5453D6)] text-[var(--on-accent,_#fff)]">
            <MessageCircle size={18} strokeWidth={2} />
            <div className="flex-1 font-bold text-[15px]">Concierge</div>
            <ButtonBase onClick={() => setOpen(false)} aria-label="Fermer" sx={{ width: 30, height: 30, borderRadius: '50%', color: 'inherit', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' } }}>
              <X size={18} strokeWidth={2} />
            </ButtonBase>
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
                <CircularProgress size={16} sx={{ color: 'var(--muted, #6b7280)' }} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 p-[7.5px] shrink-0" style={{ borderTop: '1px solid var(--line, #e5e7eb)' }}>
            <input className="flex-1 h-[40px] px-[9px] text-[14px] text-[var(--ink,_#14181c)] bg-[var(--field,_#f3f4f6)] border border-solid border-[var(--line,_#e5e7eb)] rounded-[var(--radius-md,_12px)] focus:border-[var(--accent,_#5453D6)]" style={{ outline: 'none' }} value={input} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') send(); }} placeholder="Posez votre question…" aria-label="Votre question" />
            <ButtonBase onClick={send} disabled={loading || !input.trim()} aria-label="Envoyer"
              sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--radius-md, 12px)', bgcolor: 'var(--accent, #5453D6)', color: 'var(--on-accent, #fff)', cursor: 'pointer', '&.Mui-disabled': { opacity: 0.5 }, '&:hover': { bgcolor: 'var(--accent-deep, #4140b0)' } }}>
              <Send size={17} strokeWidth={2} />
            </ButtonBase>
          </div>
        </Box>
      )}
    </>
  );
}
