import { useEffect, useRef, useState } from 'react';
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
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/public/booking/widget/concierge/status`, { headers: { 'X-Booking-Key': apiKey } })
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((d) => { if (alive) setAvailable(Boolean(d?.available)); })
      .catch(() => { /* concierge indisponible : on n'affiche rien */ });
    return () => { alive = false; };
  }, [apiKey]);

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, height: 52, flexShrink: 0,
            bgcolor: 'var(--accent, #5453D6)', color: 'var(--on-accent, #fff)' }}>
            <MessageCircle size={18} strokeWidth={2} />
            <Box sx={{ flex: 1, fontWeight: 700, fontSize: 15 }}>Concierge</Box>
            <ButtonBase onClick={() => setOpen(false)} aria-label="Fermer" sx={{ width: 30, height: 30, borderRadius: '50%', color: 'inherit', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' } }}>
              <X size={18} strokeWidth={2} />
            </ButtonBase>
          </Box>

          <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {messages.length === 0 && (
              <Box sx={{ m: 'auto', textAlign: 'center', color: 'var(--muted, #6b7280)', fontSize: 13.5, px: 2, lineHeight: 1.5 }}>
                Bonjour ! Une question sur les logements, l'arrivée, les équipements ? Je suis là pour vous aider.
              </Box>
            )}
            {messages.map((m, i) => (
              <Box key={i} sx={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%', px: 1.5, py: 1, borderRadius: 'var(--radius-md, 12px)',
                fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                bgcolor: m.role === 'user' ? 'var(--accent, #5453D6)' : 'var(--field, #f3f4f6)',
                color: m.role === 'user' ? 'var(--on-accent, #fff)' : 'var(--ink, #14181c)',
              }}>
                {m.content}
              </Box>
            ))}
            {loading && (
              <Box sx={{ alignSelf: 'flex-start', px: 1.5, py: 1 }}>
                <CircularProgress size={16} sx={{ color: 'var(--muted, #6b7280)' }} />
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderTop: '1px solid var(--line, #e5e7eb)', flexShrink: 0 }}>
            <Box
              component="input"
              value={input}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') send(); }}
              placeholder="Posez votre question…"
              aria-label="Votre question"
              sx={{
                flex: 1, height: 40, px: 1.5, fontSize: 14, color: 'var(--ink, #14181c)',
                bgcolor: 'var(--field, #f3f4f6)', border: '1px solid var(--line, #e5e7eb)', borderRadius: 'var(--radius-md, 12px)',
                outline: 'none', '&:focus': { borderColor: 'var(--accent, #5453D6)' },
              }}
            />
            <ButtonBase onClick={send} disabled={loading || !input.trim()} aria-label="Envoyer"
              sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--radius-md, 12px)', bgcolor: 'var(--accent, #5453D6)', color: 'var(--on-accent, #fff)', cursor: 'pointer', '&.Mui-disabled': { opacity: 0.5 }, '&:hover': { bgcolor: 'var(--accent-deep, #4140b0)' } }}>
              <Send size={17} strokeWidth={2} />
            </ButtonBase>
          </Box>
        </Box>
      )}
    </>
  );
}
