import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Rating,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Wifi, VpnKey, LocationOn, Phone, ContentCopy, OpenInNew, CalendarMonth, Info } from '../../icons';
import { Send, MessageCircle, X } from 'lucide-react';
import {
  parseSections,
  type GuestbookEntry,
  type PublicGuide as PublicGuideData,
} from '../../services/api/welcomeGuideApi';
import { type Activity } from '../../services/api/activitiesApi';

type Lang = 'fr' | 'en' | 'ar';

const LABELS: Record<Lang, Record<string, string>> = {
  fr: {
    stay: 'Votre séjour', arrival: 'Arrivée', departure: 'Départ', guests: 'voyageur(s)',
    wifi: 'Wi-Fi', network: 'Réseau', password: 'Mot de passe', accessCode: "Code d'accès",
    arrivalInstr: "Instructions d'arrivée", departureInstr: 'Instructions de départ',
    parking: 'Parking', houseRules: 'Règlement intérieur', notes: 'Bon à savoir',
    useful: 'Numéro utile', location: 'Adresse', viewMap: 'Voir sur la carte',
    copy: 'Copier', copied: 'Copié', poweredBy: 'Propulsé par',
    guestbookTitle: "Livre d'or", guestbookName: 'Votre nom', guestbookMessage: 'Votre message',
    guestbookRating: 'Note', guestbookSend: 'Envoyer', guestbookThanks: 'Merci pour votre message !',
    activitiesTitle: 'Activités à proximité', book: 'Réserver',
    checkinTitle: 'Check-in en ligne', checkinCta: 'Effectuer mon check-in', checkinDone: 'Check-in déjà effectué ✓',
    chatTitle: 'Assistant du livret', chatPlaceholder: 'Posez votre question…',
    chatGreeting: 'Bonjour ! Je réponds à vos questions sur le logement (wifi, accès, infos pratiques…).',
    chatError: "Désolé, je n'ai pas pu répondre. Réessayez.",
    notFoundTitle: 'Lien indisponible',
    notFoundText: "Ce livret n'est pas disponible. Le lien a peut-être expiré ou le séjour est terminé.",
    errorText: 'Une erreur est survenue. Réessayez plus tard.',
  },
  en: {
    stay: 'Your stay', arrival: 'Check-in', departure: 'Check-out', guests: 'guest(s)',
    wifi: 'Wi-Fi', network: 'Network', password: 'Password', accessCode: 'Access code',
    arrivalInstr: 'Arrival instructions', departureInstr: 'Departure instructions',
    parking: 'Parking', houseRules: 'House rules', notes: 'Good to know',
    useful: 'Useful number', location: 'Address', viewMap: 'View on map',
    copy: 'Copy', copied: 'Copied', poweredBy: 'Powered by',
    guestbookTitle: 'Guestbook', guestbookName: 'Your name', guestbookMessage: 'Your message',
    guestbookRating: 'Rating', guestbookSend: 'Send', guestbookThanks: 'Thank you for your message!',
    activitiesTitle: 'Activities nearby', book: 'Book',
    checkinTitle: 'Online check-in', checkinCta: 'Complete my check-in', checkinDone: 'Check-in already completed ✓',
    chatTitle: 'Welcome book assistant', chatPlaceholder: 'Ask a question…',
    chatGreeting: 'Hi! I can answer questions about the place (wifi, access, practical info…).',
    chatError: 'Sorry, I could not answer. Please try again.',
    notFoundTitle: 'Link unavailable',
    notFoundText: 'This guide is not available. The link may have expired or the stay is over.',
    errorText: 'Something went wrong. Please try again later.',
  },
  ar: {
    stay: 'إقامتك', arrival: 'الوصول', departure: 'المغادرة', guests: 'ضيف/ضيوف',
    wifi: 'واي فاي', network: 'الشبكة', password: 'كلمة المرور', accessCode: 'رمز الدخول',
    arrivalInstr: 'تعليمات الوصول', departureInstr: 'تعليمات المغادرة',
    parking: 'موقف السيارات', houseRules: 'قواعد المنزل', notes: 'معلومات مفيدة',
    useful: 'رقم مفيد', location: 'العنوان', viewMap: 'عرض على الخريطة',
    copy: 'نسخ', copied: 'تم النسخ', poweredBy: 'بدعم من',
    guestbookTitle: 'سجل الزوار', guestbookName: 'اسمك', guestbookMessage: 'رسالتك',
    guestbookRating: 'التقييم', guestbookSend: 'إرسال', guestbookThanks: 'شكرًا على رسالتك!',
    activitiesTitle: 'أنشطة قريبة', book: 'احجز',
    checkinTitle: 'تسجيل الوصول عبر الإنترنت', checkinCta: 'أكمل تسجيل وصولي', checkinDone: 'تم تسجيل الوصول ✓',
    chatTitle: 'مساعد الدليل', chatPlaceholder: 'اطرح سؤالك…',
    chatGreeting: 'مرحبًا! أجيب عن أسئلتك حول الإقامة (واي فاي، الدخول، معلومات مفيدة…).',
    chatError: 'عذرًا، لم أتمكن من الإجابة. حاول مرة أخرى.',
    notFoundTitle: 'الرابط غير متاح',
    notFoundText: 'هذا الدليل غير متاح. ربما انتهت صلاحية الرابط أو انتهت الإقامة.',
    errorText: 'حدث خطأ ما. يرجى المحاولة لاحقًا.',
  },
};

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '';

async function fetchPublicGuide(token: string): Promise<PublicGuideData | null> {
  const response = await fetch(`${API_BASE}/api/public/guide/${token}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('fetch_failed');
  return response.json();
}

async function fetchGuestbook(token: string): Promise<GuestbookEntry[]> {
  const response = await fetch(`${API_BASE}/api/public/guide/${token}/guestbook`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) return [];
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

function formatDate(iso: string | null, lang: Lang): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(lang, { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

const PublicGuide: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [guide, setGuide] = useState<PublicGuideData | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Livre d'or
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [gbName, setGbName] = useState('');
  const [gbMessage, setGbMessage] = useState('');
  const [gbRating, setGbRating] = useState<number | null>(null);
  const [gbSubmitting, setGbSubmitting] = useState(false);
  const [gbDone, setGbDone] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);

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
      fetchGuestbook(token).then(setEntries).catch(() => {});
      fetchActivities(token).then(setActivities).catch(() => {});
    }
  }, [status, token]);

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
      setEntries((prev) => [created, ...prev]);
      setGbDone(true);
    }
  }, [token, gbName, gbMessage, gbRating]);

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (status === 'notfound' || status === 'error' || !guide) {
    const L = LABELS.fr;
    const isNotFound = status === 'notfound';
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Card variant="outlined" sx={{ maxWidth: 420, textAlign: 'center' }}>
          <CardContent>
            <Info size={32} strokeWidth={1.5} />
            <Typography variant="h6" sx={{ mt: 1, mb: 0.5 }}>
              {isNotFound ? L.notFoundTitle : 'Erreur'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isNotFound ? L.notFoundText : L.errorText}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const lang: Lang = (['fr', 'en', 'ar'] as const).includes(guide.language as Lang)
    ? (guide.language as Lang)
    : 'fr';
  const L = LABELS[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const color = guide.brandingColor || '#6B8A9A';
  const sections = parseSections(guide.sections);
  const { property, practical, stay, checkIn } = guide;

  const mapsUrl =
    property?.latitude != null && property?.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`
      : property?.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            [property.address, property.city, property.country].filter(Boolean).join(', '),
          )}`
        : null;

  const copyBtn = (key: string, value: string) => (
    <Tooltip title={copied === key ? L.copied : L.copy}>
      <IconButton size="small" onClick={() => copy(key, value)}>
        <ContentCopy size={16} strokeWidth={1.75} />
      </IconButton>
    </Tooltip>
  );

  const block = (title: string, content: React.ReactNode) => (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Typography variant="overline" sx={{ color, fontWeight: 700, letterSpacing: 0.5 }}>
          {title}
        </Typography>
        <Box sx={{ mt: 0.5 }}>{content}</Box>
      </CardContent>
    </Card>
  );

  const textRow = (value: string) => (
    <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
      {value}
    </Typography>
  );

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatSending || !token) return;
    setChatMessages((prev) => [...prev, { role: 'user', text: msg }]);
    setChatInput('');
    setChatSending(true);
    const reply = await postChat(token, msg);
    setChatSending(false);
    setChatMessages((prev) => [...prev, { role: 'assistant', text: reply ?? L.chatError }]);
  };

  return (
    <Box dir={dir} sx={{ minHeight: '100vh', bgcolor: '#F5F6F7', pb: 6 }}>
      {/* Header brandé */}
      <Box sx={{ bgcolor: color, color: '#fff', px: 3, py: 4, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <Box sx={{ maxWidth: 560, mx: 'auto', textAlign: 'center' }}>
          {guide.logoUrl ? (
            <Box
              component="img"
              src={guide.logoUrl}
              alt=""
              sx={{ maxHeight: 56, maxWidth: 180, mb: 1.5, objectFit: 'contain' }}
            />
          ) : null}
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {guide.title}
          </Typography>
          {property?.name ? (
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
              {property.name}
            </Typography>
          ) : null}
        </Box>
      </Box>

      <Box sx={{ maxWidth: 560, mx: 'auto', px: 2, mt: -2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Séjour */}
        {stay && (stay.checkIn || stay.checkOut) ? (
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CalendarMonth size={18} strokeWidth={1.75} style={{ color }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {L.stay}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {L.arrival}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatDate(stay.checkIn, lang)} {stay.checkInTime ? `· ${stay.checkInTime}` : ''}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: dir === 'rtl' ? 'left' : 'right' }}>
                  <Typography variant="caption" color="text.secondary">
                    {L.departure}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatDate(stay.checkOut, lang)} {stay.checkOutTime ? `· ${stay.checkOutTime}` : ''}
                  </Typography>
                </Box>
              </Box>
              {stay.guestName ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {stay.guestName}
                  {stay.guestCount ? ` · ${stay.guestCount} ${L.guests}` : ''}
                </Typography>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Check-in en ligne */}
        {checkIn
          ? block(
              L.checkinTitle,
              checkIn.status === 'COMPLETED' ? (
                <Typography variant="body2" sx={{ color, fontWeight: 600 }}>
                  {L.checkinDone}
                </Typography>
              ) : (
                <Button
                  variant="contained"
                  href={checkIn.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  endIcon={<OpenInNew size={14} strokeWidth={1.75} />}
                  sx={{ bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.95)' } }}
                >
                  {L.checkinCta}
                </Button>
              ),
            )
          : null}

        {/* Wifi */}
        {practical?.wifiName ? (
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Wifi size={18} strokeWidth={1.75} style={{ color }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {L.wifi}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {L.network}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {practical.wifiName}
                  </Typography>
                </Box>
                {copyBtn('wifiName', practical.wifiName)}
              </Box>
              {practical.wifiPassword ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {L.password}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                      {practical.wifiPassword}
                    </Typography>
                  </Box>
                  {copyBtn('wifiPassword', practical.wifiPassword)}
                </Box>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Code d'accès */}
        {practical?.accessCode ? (
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VpnKey size={18} strokeWidth={1.75} style={{ color }} />
                  <Box>
                    <Typography variant="overline" sx={{ color, fontWeight: 700 }}>
                      {L.accessCode}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'monospace', lineHeight: 1.1 }}>
                      {practical.accessCode}
                    </Typography>
                  </Box>
                </Box>
                {copyBtn('accessCode', practical.accessCode)}
              </Box>
            </CardContent>
          </Card>
        ) : null}

        {/* Localisation */}
        {(property?.address || mapsUrl) &&
          block(
            L.location,
            <Box>
              {property?.address ? (
                <Typography variant="body2">
                  {[property.address, property.postalCode, property.city, property.country]
                    .filter(Boolean)
                    .join(', ')}
                </Typography>
              ) : null}
              {mapsUrl ? (
                <Button
                  size="small"
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<LocationOn size={16} strokeWidth={1.75} />}
                  endIcon={<OpenInNew size={14} strokeWidth={1.75} />}
                  sx={{ mt: 1, color }}
                >
                  {L.viewMap}
                </Button>
              ) : null}
            </Box>,
          )}

        {/* Infos pratiques */}
        {practical?.arrivalInstructions ? block(L.arrivalInstr, textRow(practical.arrivalInstructions)) : null}
        {practical?.departureInstructions ? block(L.departureInstr, textRow(practical.departureInstructions)) : null}
        {practical?.parkingInfo ? block(L.parking, textRow(practical.parkingInfo)) : null}
        {practical?.houseRules ? block(L.houseRules, textRow(practical.houseRules)) : null}
        {practical?.additionalNotes ? block(L.notes, textRow(practical.additionalNotes)) : null}

        {/* Numéro utile */}
        {practical?.emergencyContact
          ? block(
              L.useful,
              <Button
                href={`tel:${practical.emergencyContact}`}
                startIcon={<Phone size={16} strokeWidth={1.75} />}
                sx={{ color }}
              >
                {practical.emergencyContact}
              </Button>,
            )
          : null}

        {/* Sections éditoriales (autour de moi, message d'accueil, bons plans…) */}
        {sections
          .filter((s) => s.title || s.body)
          .map((s) => (
            <React.Fragment key={s.id}>{block(s.title, textRow(s.body))}</React.Fragment>
          ))}

        {/* Activités à proximité */}
        {activities.length > 0
          ? block(
              L.activitiesTitle,
              <Stack spacing={1.25}>
                {activities.map((a, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    {a.imageUrl ? (
                      <Box
                        component="img"
                        src={a.imageUrl}
                        alt=""
                        sx={{ width: 64, height: 64, borderRadius: 1.5, objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : null}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {a.title}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {a.rating ? <Rating value={a.rating} readOnly size="small" precision={0.5} /> : null}
                        {a.price ? (
                          <Typography variant="caption" color="text.secondary">
                            {a.price} {a.currency || ''}
                          </Typography>
                        ) : null}
                      </Box>
                    </Box>
                    {a.bookingUrl ? (
                      <Button
                        size="small"
                        href={a.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        endIcon={<OpenInNew size={14} strokeWidth={1.75} />}
                        sx={{ color, flexShrink: 0 }}
                      >
                        {L.book}
                      </Button>
                    ) : null}
                  </Box>
                ))}
              </Stack>,
            )
          : null}

        {/* Livre d'or */}
        {block(
          L.guestbookTitle,
          <Box>
            {entries.length > 0 ? (
              <Stack spacing={1} sx={{ mb: 2 }}>
                {entries.map((e) => (
                  <Box key={e.id} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {e.authorName || '—'}
                      </Typography>
                      {e.rating ? <Rating value={e.rating} readOnly size="small" /> : null}
                    </Box>
                    {e.message ? (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                        {e.message}
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            ) : null}

            {gbDone ? (
              <Typography variant="body2" sx={{ color, fontWeight: 600 }}>
                {L.guestbookThanks}
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                <TextField
                  label={L.guestbookName}
                  value={gbName}
                  onChange={(e) => setGbName(e.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label={L.guestbookMessage}
                  value={gbMessage}
                  onChange={(e) => setGbMessage(e.target.value)}
                  size="small"
                  fullWidth
                  multiline
                  minRows={2}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {L.guestbookRating}
                  </Typography>
                  <Rating value={gbRating} onChange={(_, v) => setGbRating(v)} size="small" />
                </Box>
                <Button
                  variant="contained"
                  disabled={gbSubmitting || !gbName.trim() || !gbMessage.trim()}
                  onClick={submitGuestbook}
                  startIcon={<Send size={16} strokeWidth={1.75} />}
                  sx={{ alignSelf: 'flex-start', bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.95)' } }}
                >
                  {L.guestbookSend}
                </Button>
              </Stack>
            )}
          </Box>,
        )}

        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
          {L.poweredBy} Clenzy
        </Typography>
      </Box>

      {/* Chatbot guest (assistant du livret) */}
      {chatOpen ? (
        <Box
          sx={{
            position: 'fixed',
            bottom: { xs: 0, sm: 16 },
            right: { xs: 0, sm: 16 },
            width: { xs: '100%', sm: 360 },
            height: { xs: '80vh', sm: 480 },
            maxHeight: '80vh',
            bgcolor: 'background.paper',
            boxShadow: 6,
            borderRadius: { xs: 0, sm: 3 },
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1300,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              bgcolor: color,
              color: '#fff',
              px: 2,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {L.chatTitle}
            </Typography>
            <IconButton size="small" onClick={() => setChatOpen(false)} sx={{ color: '#fff' }}>
              <X size={18} strokeWidth={2} />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ alignSelf: 'flex-start', bgcolor: 'action.hover', px: 1.5, py: 1, borderRadius: 2, maxWidth: '85%' }}>
              <Typography variant="body2">{L.chatGreeting}</Typography>
            </Box>
            {chatMessages.map((m, i) => (
              <Box
                key={i}
                sx={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  bgcolor: m.role === 'user' ? color : 'action.hover',
                  color: m.role === 'user' ? '#fff' : 'text.primary',
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  maxWidth: '85%',
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {m.text}
                </Typography>
              </Box>
            ))}
            {chatSending ? (
              <Box sx={{ alignSelf: 'flex-start', px: 1.5, py: 1 }}>
                <CircularProgress size={16} />
              </Box>
            ) : null}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, p: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <TextField
              fullWidth
              size="small"
              placeholder={L.chatPlaceholder}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendChat();
                }
              }}
            />
            <IconButton onClick={() => void sendChat()} disabled={chatSending || !chatInput.trim()} sx={{ color }}>
              <Send size={18} strokeWidth={1.75} />
            </IconButton>
          </Box>
        </Box>
      ) : (
        <IconButton
          onClick={() => setChatOpen(true)}
          aria-label={L.chatTitle}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            bgcolor: color,
            color: '#fff',
            width: 56,
            height: 56,
            boxShadow: 4,
            zIndex: 1300,
            '&:hover': { bgcolor: color, filter: 'brightness(0.95)' },
          }}
        >
          <MessageCircle size={24} strokeWidth={1.75} />
        </IconButton>
      )}
    </Box>
  );
};

export default PublicGuide;
