import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Dialog, DialogContent, DialogTitle } from '@mui/material';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { Send, X, Star, Sparkles, ArrowUp, Info, Heart } from 'lucide-react';
import { type PublicUpsell } from '../../services/api/upsellApi';
import {
  parseSections,
  parsePois,
  parseActivities,
  submitGuideDeclaration,
  type GuideActivity,
  type GuestbookEntry,
  type GuideEventType,
  type GuestDeclarant,
  type PublicGuide as PublicGuideData,
} from '../../services/api/welcomeGuideApi';
import { type Activity } from '../../services/api/activitiesApi';
import WelcomeBookView, { type Lang, type WelcomeBookModel } from './WelcomeBookView';
import GuideDeclarationForm from './GuideDeclarationForm';
import { WELCOME_BOOK_THEMES, normalizeTheme, injectWelcomeBookCss } from './welcomeBookThemes';
import { GUIDE_LABELS as LABELS } from './guideLabels';
import { API_CONFIG } from '../../config/api';

// Origine de l'API (SANS le préfixe /api : les chemins ci-dessous et les URLs
// relatives du payload — hero-photo, access-photos — l'incluent déjà).
// Résolution standard de l'app via VITE_API_BASE_URL : dev = http://localhost:8084,
// prod = https://app.clenzy.fr. L'ancien VITE_API_URL n'était défini nulle part :
// en dev les fetch tapaient le serveur Vite (localhost:3000) qui renvoyait index.html.
const API_BASE = API_CONFIG.BASE_URL;

/** Parse le JSON arrivalPhotos ([{key, caption}]) du payload public. */
function parseArrivalPhotos(json: string | null | undefined): Array<{ key: string; caption: string }> {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr)
      ? arr.flatMap((p) =>
          p && typeof p.key === 'string'
            ? [{ key: p.key as string, caption: typeof p.caption === 'string' ? p.caption : '' }]
            : [],
        )
      : [];
  } catch {
    return [];
  }
}

// Clé publishable Stripe (build-time, dispo aussi sur la page publique). Null si non configurée.
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)
  : null;

const guideIconBadge56Style: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 999,
  background: 'var(--terra-bg)',
  color: 'var(--terra-deep)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 16,
};

const guideIconBadge64Style: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 999,
  background: 'var(--terra-bg)',
  color: 'var(--terra-deep)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 16,
};

const conciergeFabStyle: React.CSSProperties = {
  position: 'absolute',
  right: 16,
  bottom: 24,
  zIndex: 40,
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  padding: '12px 18px 12px 15px',
  borderRadius: 999,
  border: 'none',
  cursor: 'pointer',
  background: 'var(--terra)',
  color: '#FFF6EF',
  boxShadow: '0 12px 28px -8px rgba(35,24,14,.5)',
  fontFamily: 'var(--sans)',
  fontWeight: 700,
  fontSize: 13.5,
};

const conciergeSheetStyle: React.CSSProperties = {
  position: 'relative',
  height: '86%',
  background: 'var(--bg)',
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30,
  boxShadow: '0 -20px 50px -20px rgba(35,24,14,.4)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  animation: 'wb-sheet-in .4s cubic-bezier(.16,1,.3,1)',
};

const conciergeAvatarStyle: React.CSSProperties = {
  position: 'relative',
  width: 44,
  height: 44,
  borderRadius: 999,
  background: 'linear-gradient(150deg,var(--terra),var(--terra-deep))',
  color: '#FFF6EF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'var(--serif)',
  fontWeight: 700,
  fontSize: 20,
};

const conciergeAvatarDotStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  bottom: 1,
  width: 12,
  height: 12,
  borderRadius: 999,
  background: 'var(--olive)',
  border: '2px solid var(--bg)',
};

const conciergeCloseButtonStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: '1px solid var(--line)',
  background: 'var(--raised)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink-soft)',
  cursor: 'pointer',
};

const conciergeGreetingBubbleStyle: React.CSSProperties = {
  padding: '11px 15px',
  borderRadius: 20,
  borderBottomLeftRadius: 6,
  fontSize: 14,
  lineHeight: 1.5,
  background: 'var(--raised)',
  color: 'var(--ink)',
  border: '1px solid var(--line)',
};

const conciergeSendButtonStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 38,
  height: 38,
  borderRadius: 999,
  border: 'none',
  background: 'var(--terra)',
  color: '#FFF6EF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

async function fetchPublicGuide(token: string): Promise<PublicGuideData | null> {
  const response = await fetch(`${API_BASE}/api/public/guide/${token}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('fetch_failed');
  return response.json();
}

async function postGuestbook(
  token: string,
  body: { authorName: string; message: string; rating?: number | null },
): Promise<GuestbookEntry | null> {
  const response = await fetch(`${API_BASE}/api/public/guide/${token}/guestbook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) return null;
  return response.json();
}

async function fetchActivities(token: string): Promise<Activity[]> {
  const response = await fetch(`${API_BASE}/api/public/guide/${token}/activities`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) return [];
  return response.json();
}

async function fetchUpsells(token: string): Promise<PublicUpsell[]> {
  const response = await fetch(`${API_BASE}/api/public/guide/${token}/upsells`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) return [];
  return response.json();
}

async function startUpsellCheckout(
  token: string,
  offerId: number,
): Promise<{ clientSecret: string; orderId: number } | null> {
  try {
    const response = await fetch(`${API_BASE}/api/public/guide/${token}/upsells/${offerId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    return data && typeof data.clientSecret === 'string' && typeof data.orderId === 'number'
      ? { clientSecret: data.clientSecret, orderId: data.orderId }
      : null;
  } catch {
    return null;
  }
}

/** Filet de secours : re-vérifie le paiement côté serveur (au cas où le webhook tarde). Best-effort. */
function confirmUpsellPayment(token: string, orderId: number): void {
  void fetch(`${API_BASE}/api/public/guide/${token}/upsells/orders/${orderId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
  }).catch(() => {});
}

async function postChat(token: string, message: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/api/public/guide/${token}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await response.json().catch(() => null);
    return data && typeof data.reply === 'string' ? data.reply : null;
  } catch {
    return null;
  }
}

/** Ouvre la porte (serrure connectée) — true si le déverrouillage a réussi. */
async function postUnlock(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/public/guide/${token}/unlock`, { method: 'POST' });
    return response.ok;
  } catch {
    return false;
  }
}

/** Capture best-effort d'un evenement guest (analytics hote). N'affecte jamais l'UI. */
function recordEvent(token: string, eventType: GuideEventType, detail?: string): void {
  void fetch(`${API_BASE}/api/public/guide/${token}/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, detail: detail ?? null }),
    keepalive: true,
  }).catch(() => {});
}

/** Active note (1..5) clicquable, terracotta/doré. */
function RatingStars({ value, onChange, size = 30 }: { value: number | null; onChange: (v: number) => void; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <button
          key={i}
          type="button"
          className="wb-pressable"
          onClick={() => onChange(i + 1)}
          aria-label={`${i + 1}`}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2 }}
        >
          <Star size={size} strokeWidth={1.5} style={{ color: 'var(--gold)' }} fill={value != null && i < value ? 'var(--gold)' : 'transparent'} />
        </button>
      ))}
    </div>
  );
}

const PublicGuide: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [guide, setGuide] = useState<PublicGuideData | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Livre d'or
  const [gbName, setGbName] = useState('');
  const [gbMessage, setGbMessage] = useState('');
  const [gbRating, setGbRating] = useState<number | null>(null);
  const [gbSubmitting, setGbSubmitting] = useState(false);
  const [gbDone, setGbDone] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [upsells, setUpsells] = useState<PublicUpsell[]>([]);
  const [payingUpsell, setPayingUpsell] = useState<PublicUpsell | null>(null);
  const [payClientSecret, setPayClientSecret] = useState<string | null>(null);
  // Id de commande upsell lu uniquement dans le handler de confirmation : ref.
  const payOrderIdRef = useRef<number | null>(null);
  const [paySuccess, setPaySuccess] = useState(false);
  const [payError, setPayError] = useState(false);
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    injectWelcomeBookCss();
  }, []);

  useEffect(() => {
    let active = true;
    if (!token) {
      setStatus('error');
      return;
    }
    fetchPublicGuide(token)
      .then((data) => {
        if (!active) return;
        if (!data) {
          setStatus('notfound');
        } else {
          setGuide(data);
          setStatus('ready');
        }
      })
      .catch(() => active && setStatus('error'));
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (status === 'ready' && token) {
      fetchActivities(token).then(setActivities).catch(() => {});
      fetchUpsells(token).then(setUpsells).catch(() => {});
      // Ouverture : une seule fois par session guest (dedup sessionStorage, tolere le mode prive).
      let firstOpen = true;
      try {
        const key = `cz_guide_open_${token}`;
        if (sessionStorage.getItem(key)) firstOpen = false;
        else sessionStorage.setItem(key, '1');
      } catch {
        /* mode prive : on compte l'ouverture */
      }
      if (firstOpen) recordEvent(token, 'GUIDE_OPENED');
    }
  }, [status, token]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, conciergeOpen]);

  const copy = useCallback((key: string, value: string) => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
      },
      () => {},
    );
  }, []);

  const submitGuestbook = useCallback(async () => {
    if (!token || !gbName.trim() || !gbMessage.trim()) return;
    setGbSubmitting(true);
    const created = await postGuestbook(token, {
      authorName: gbName.trim(),
      message: gbMessage.trim(),
      rating: gbRating ?? undefined,
    });
    setGbSubmitting(false);
    if (created) {
      setGbDone(true);
    }
  }, [token, gbName, gbMessage, gbRating]);

  const sendChat = useCallback(
    async (explicit?: string) => {
      const msg = (explicit ?? chatInput).trim();
      if (!msg || chatSending || !token) return;
      setChatMessages((prev) => [...prev, { role: 'user', text: msg }]);
      setChatInput('');
      setChatSending(true);
      const reply = await postChat(token, msg);
      setChatSending(false);
      const lang: Lang = (['fr', 'en', 'ar'] as const).includes((guide?.language ?? 'fr') as Lang)
        ? (guide?.language as Lang)
        : 'fr';
      setChatMessages((prev) => [...prev, { role: 'assistant', text: reply ?? LABELS[lang].chatError }]);
    },
    [chatInput, chatSending, token, guide],
  );

  // ── Activités pour le carrousel : curées (mises en avant d'abord), sinon fournisseurs ──
  const activitiesForView: GuideActivity[] = useMemo(() => {
    if (!guide) return [];
    const curated = parseActivities(guide.curatedActivities);
    if (curated.length > 0) {
      return [...curated].sort((a, b) => Number(b.featured) - Number(a.featured));
    }
    return activities.map((a, i) => ({
      id: `prov-${i}`,
      source: 'PROVIDER',
      externalId: null,
      title: a.title ?? '',
      imageUrl: a.imageUrl ?? null,
      price: a.price != null ? `${a.price}${a.currency ? ` ${a.currency}` : ''}` : null,
      bookingUrl: a.bookingUrl ?? '',
      description: '',
      featured: false,
    }));
  }, [guide, activities]);

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: '#F2E9D9' }}>
        <CircularProgress sx={{ color: '#BC5B36' }} />
      </Box>
    );
  }

  // ── Livret non disponible (réservation absente ou révolue) ──
  // Le payload reste habillé (title/theme/brandingColor/logoUrl) mais sans contenu :
  // on affiche un écran dédié, thémé, avec un message selon `unavailableReason`.
  if (status === 'ready' && guide && guide.available === false) {
    const lang: Lang = (['fr', 'en', 'ar'] as const).includes(guide.language as Lang) ? (guide.language as Lang) : 'fr';
    const L = LABELS[lang];
    const theme = normalizeTheme(guide.theme);
    const swatch = WELCOME_BOOK_THEMES.find((t) => t.id === theme)?.swatch;
    const message = guide.unavailableReason === 'EXPIRED' ? L.unavailableExpired : L.unavailableNoReservation;
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', bgcolor: swatch?.bg || '#F2E9D9' }}>
        <div className="wb" data-theme={theme} style={{ width: '100%', maxWidth: 480, minHeight: '100vh', display: 'flex' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div className="wb-card" style={{ maxWidth: 420, textAlign: 'center', padding: 28, background: 'var(--raised)' }}>
              <div style={guideIconBadge56Style}>
                <Info size={26} strokeWidth={1.6} />
              </div>
              {guide.title ? (
                <div className="wb-eyebrow" style={{ marginBottom: 6, color: 'var(--ink-soft)' }}>{guide.title}</div>
              ) : null}
              <div className="wb-h2" style={{ marginBottom: 8 }}>{L.unavailableTitle}</div>
              <div className="wb-lead">{message}</div>
            </div>
          </div>
        </div>
      </Box>
    );
  }

  if (status === 'notfound' || status === 'error' || !guide) {
    const L = LABELS.fr;
    const isNotFound = status === 'notfound';
    return (
      <div className="wb" data-theme="atelier" style={{ height: '100vh' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="wb-card" style={{ maxWidth: 420, textAlign: 'center', padding: 28, background: 'var(--raised)' }}>
            <div style={guideIconBadge56Style}>
              <Info size={26} strokeWidth={1.6} />
            </div>
            <div className="wb-h2" style={{ marginBottom: 8 }}>{isNotFound ? L.notFoundTitle : 'Oups'}</div>
            <div className="wb-lead">{isNotFound ? L.notFoundText : L.errorText}</div>
          </div>
        </div>
      </div>
    );
  }

  const lang: Lang = (['fr', 'en', 'ar'] as const).includes(guide.language as Lang) ? (guide.language as Lang) : 'fr';
  const L = LABELS[lang];
  const theme = normalizeTheme(guide.theme);
  const swatch = WELCOME_BOOK_THEMES.find((t) => t.id === theme)?.swatch;
  const heroImages = (guide.heroImageUrls || []).map((u) =>
    u.startsWith('http') ? u : `${API_BASE}${u}`,
  );

  // ── Gating réglementaire (fiche de police + check-in) ──
  // Si une déclaration est exigée et incomplète, on présente le formulaire de complétion AVANT le
  // livret. Une fois la collecte complète (réponse serveur), on met à jour le state → le livret apparaît
  // sans friction. Si rien n'est requis (dataCollection null ou complete), accès direct.
  const dc = guide.dataCollection;
  if (dc && dc.required && !dc.complete) {
    const handleDeclarationSubmit = async (declarants: GuestDeclarant[]): Promise<boolean> => {
      if (!token) return false;
      const result = await submitGuideDeclaration(API_BASE, token, { declarants });
      setGuide((prev) => (prev ? { ...prev, dataCollection: result } : prev));
      return result.complete;
    };
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', bgcolor: swatch?.bg || '#F2E9D9' }}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 480,
            minHeight: '100vh',
            boxShadow: { xs: 'none', sm: '0 0 80px -20px rgba(35,24,14,0.45)' },
          }}
        >
          <GuideDeclarationForm
            lang={lang}
            labels={L}
            theme={theme}
            missingFields={dc.missingFields}
            onSubmit={handleDeclarationSubmit}
          />
        </Box>
      </Box>
    );
  }

  const model: WelcomeBookModel = {
    title: guide.title,
    welcomeMessage: guide.welcomeMessage,
    hostNames: guide.hostNames,
    logoUrl: guide.logoUrl,
    property: guide.property,
    practical: guide.practical,
    stay: guide.stay,
    checkIn: guide.checkIn,
    accessPhotos: parseArrivalPhotos(guide.practical?.arrivalPhotos),
    sections: parseSections(guide.sections),
    pois: parsePois(guide.pois),
    activities: activitiesForView,
    upsells,
    guestbookEnabled: guide.guestbookEnabled,
    activitiesEnabled: guide.activitiesEnabled,
    upsellsEnabled: guide.upsellsEnabled,
  };

  const payUpsell = async (u: PublicUpsell) => {
    if (!token) return;
    setPayingUpsell(u);
    setPayClientSecret(null);
    payOrderIdRef.current = null;
    setPaySuccess(false);
    setPayError(false);
    const res = await startUpsellCheckout(token, u.offerId);
    if (res) {
      setPayClientSecret(res.clientSecret);
      payOrderIdRef.current = res.orderId;
    } else {
      setPayError(true);
    }
  };

  const onPayComplete = () => {
    setPaySuccess(true);
    const orderId = payOrderIdRef.current;
    if (token && orderId != null) confirmUpsellPayment(token, orderId);
  };

  const closePay = () => {
    setPayingUpsell(null);
    setPayClientSecret(null);
    payOrderIdRef.current = null;
    setPaySuccess(false);
    setPayError(false);
  };

  // ── Avis / livre d'or (sous-page « Noter mon séjour ») ──
  const disabledSubmit = gbSubmitting || !gbName.trim() || !gbMessage.trim();
  const guestbookSlot = guide.guestbookEnabled
    ? gbDone
      ? (
        <div className="wb-rise" style={{ textAlign: 'center', padding: '40px 10px' }}>
          <div style={guideIconBadge64Style}>
            <Heart size={28} strokeWidth={1.6} fill="var(--terra-deep)" />
          </div>
          <div className="wb-h2">{L.guestbookThanks}</div>
        </div>
      )
      : (
        <div>
          <div className="wb-h2" style={{ marginBottom: 6 }}>{L.reviewTitle}</div>
          <div className="wb-lead" style={{ marginBottom: 22 }}>{L.reviewSub}</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
            <RatingStars value={gbRating} onChange={setGbRating} size={38} />
          </div>
          <textarea
            value={gbMessage}
            onChange={(e) => setGbMessage(e.target.value)}
            placeholder={L.reviewPlaceholder}
            rows={4}
            style={{ ...wbInput, resize: 'none', marginBottom: 12 }}
          />
          <input value={gbName} onChange={(e) => setGbName(e.target.value)} placeholder={L.guestbookName} style={{ ...wbInput, marginBottom: 16 }} />
          <button
            type="button"
            className="wb-btn wb-btn--block wb-pressable"
            disabled={disabledSubmit}
            onClick={submitGuestbook}
            style={{ opacity: disabledSubmit ? 0.55 : 1 }}
          >
            <Send size={17} strokeWidth={1.8} /> {L.send}
          </button>
        </div>
      )
    : null;

  return (
    <>
      <Box sx={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', bgcolor: swatch?.bg || '#F2E9D9' }}>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            maxWidth: 480,
            height: '100vh',
            overflow: 'hidden',
            boxShadow: { xs: 'none', sm: '0 0 80px -20px rgba(35,24,14,0.45)' },
          }}
        >
          <WelcomeBookView
            model={model}
            theme={theme}
            lang={lang}
            labels={L}
            heroImages={heroImages}
            interactive
            copiedKey={copied}
            onCopy={copy}
            onActivityClick={(a) => token && recordEvent(token, 'ACTIVITY_CLICK', a.title || undefined)}
            onUpsellClick={payUpsell}
            onCheckinClick={() => token && recordEvent(token, 'CHECKIN_CLICK')}
            onUnlock={token ? () => postUnlock(token) : undefined}
            accessPhotoUrl={(key) => `${API_BASE}/api/public/guide/${token}/access-photos?key=${encodeURIComponent(key)}`}
            guestbookSlot={guestbookSlot}
          >
            {/* ── Concierge IA (bouton flottant + bottom-sheet) ── */}
            {guide.chatbotEnabled ? (
              <>
                {!conciergeOpen ? (
                  <button
                    type="button"
                    className="wb-pressable"
                    onClick={() => setConciergeOpen(true)}
                    aria-label={L.ask}
                    style={conciergeFabStyle}
                  >
                    <Sparkles size={19} strokeWidth={1.6} /> {L.ask}
                  </button>
                ) : (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div
                      onClick={() => setConciergeOpen(false)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setConciergeOpen(false); }}
                      role="button"
                      tabIndex={0}
                      aria-label="Fermer"
                      style={{ position: 'absolute', inset: 0, background: 'rgba(35,24,14,.42)' }}
                    />
                    <div style={conciergeSheetStyle}>
                      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
                        <div style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--line)' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px 14px', borderBottom: '1px solid var(--line)' }}>
                        <div style={conciergeAvatarStyle}>
                          {L.conciergeName.charAt(0)}
                          <span style={conciergeAvatarDotStyle} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 15.5 }}>{L.conciergeName}</div>
                          <div style={{ fontSize: 12, color: 'var(--olive)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Sparkles size={12} strokeWidth={1.7} /> {L.conciergeRole}
                          </div>
                        </div>
                        <button type="button" className="wb-pressable" onClick={() => setConciergeOpen(false)} aria-label="Fermer" style={conciergeCloseButtonStyle}>
                          <X size={18} strokeWidth={1.9} />
                        </button>
                      </div>
                      <div ref={chatScrollRef} className="wb__scroll" style={{ padding: '18px 16px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="wb-bubble" style={{ alignSelf: 'flex-start', maxWidth: '82%' }}>
                          <div style={conciergeGreetingBubbleStyle}>
                            {L.chatGreeting}
                          </div>
                        </div>
                        {chatMessages.map((m, i) => (
                          <div key={i} className="wb-bubble" style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                            <div style={{ padding: '11px 15px', borderRadius: 20, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-line', background: m.role === 'user' ? 'var(--terra)' : 'var(--raised)', color: m.role === 'user' ? '#FFF6EF' : 'var(--ink)', border: m.role === 'user' ? 'none' : '1px solid var(--line)', borderBottomRightRadius: m.role === 'user' ? 6 : 20, borderBottomLeftRadius: m.role === 'user' ? 20 : 6 }}>
                              {m.text}
                            </div>
                          </div>
                        ))}
                        {chatMessages.length === 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                            {[L.suggest1, L.suggest2, L.suggest3].map((q) => (
                              <button key={q} type="button" className="wb-chip wb-pressable" onClick={() => sendChat(q)} style={{ fontSize: 12.5, padding: '8px 13px', borderColor: 'var(--terra-soft)', color: 'var(--terra-deep)', background: 'var(--terra-bg)' }}>
                                {q}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {chatSending ? (
                          <div style={{ alignSelf: 'flex-start', padding: '8px 12px' }}>
                            <CircularProgress size={16} sx={{ color: 'var(--terra)' }} />
                          </div>
                        ) : null}
                      </div>
                      <div style={{ padding: '10px 14px calc(env(safe-area-inset-bottom) + 14px)', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 999, padding: '5px 5px 5px 16px' }}>
                          <input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                void sendChat();
                              }
                            }}
                            placeholder={L.chatPlaceholder}
                            style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)' }}
                          />
                          <button type="button" className="wb-pressable" onClick={() => void sendChat()} disabled={chatSending || !chatInput.trim()} aria-label="Send" style={{ ...conciergeSendButtonStyle, opacity: chatSending || !chatInput.trim() ? 0.55 : 1 }}>
                            <ArrowUp size={19} strokeWidth={1.9} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </WelcomeBookView>
        </Box>
      </Box>

      {/* Paiement d'un service additionnel (upsell) — Stripe embedded */}
      <Dialog open={!!payingUpsell} onClose={closePay} maxWidth="sm" fullWidth>
        <DialogTitle>{payingUpsell?.title}</DialogTitle>
        <DialogContent dividers sx={{ p: payClientSecret && !paySuccess && !payError ? 0 : 3 }}>
          {paySuccess ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{ color: '#BC5B36', fontWeight: 700, mb: 1.5, fontSize: 16 }}>{L.paySuccess}</Box>
              <button type="button" onClick={closePay} style={{ ...solidBtn }}>OK</button>
            </Box>
          ) : payError ? (
            <Box sx={{ color: '#C44E32', py: 1 }}>{L.payError}</Box>
          ) : payClientSecret && stripePromise ? (
            <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret: payClientSecret, onComplete: onPayComplete }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: '#BC5B36' }} />
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const wbInput: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--line)',
  borderRadius: 14,
  padding: '12px 14px',
  fontFamily: 'var(--sans)',
  fontSize: 14,
  color: 'var(--ink)',
  background: 'var(--surface)',
  outline: 'none',
};

const solidBtn: React.CSSProperties = {
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--sans)',
  fontWeight: 700,
  fontSize: 14,
  borderRadius: 12,
  padding: '10px 20px',
  background: '#BC5B36',
  color: '#FFF6EF',
};

export default PublicGuide;
