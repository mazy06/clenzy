import React, { useState } from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import { ArrowBack } from '../../../icons';
import type { ResolvedTokens, PreviewPage } from '../types/bookingEngine';
import type { BookingI18n } from '../sdk/i18n';

interface BookingAuthPageProps {
  tk: ResolvedTokens;
  i18n: BookingI18n;
  btnSx: Record<string, unknown>;
  authTab: 'login' | 'register';
  setAuthTab: (tab: 'login' | 'register') => void;
  setPage: (page: PreviewPage) => void;
  /** Called on auth submit — receives form data for real Keycloak auth */
  onAuthenticate?: (data: { email: string; password: string; firstName?: string; lastName?: string; phone?: string }) => Promise<void> | void;
  isLoading?: boolean;
  error?: string | null;
}

const BookingAuthPage: React.FC<BookingAuthPageProps> = ({
  tk, i18n, btnSx, authTab, setAuthTab, setPage, onAuthenticate, isLoading = false, error = null,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = () => {
    if (onAuthenticate) {
      onAuthenticate({ email, password, firstName, lastName, phone });
    } else {
      setPage('validation');
    }
  };
  const inputSx = {
    width: '100%', p: '12px 14px', borderRadius: tk.radius, border: `1px solid ${tk.border}`,
    fontSize: 13, fontFamily: tk.font, color: tk.text, bgcolor: tk.surface, outline: 'none',
    '&:focus': { borderColor: tk.primary },
  };

  const cardSx = {
    bgcolor: tk.surface, borderRadius: tk.cardRadius, border: `1px solid ${tk.border}`,
    overflow: 'hidden',
  };

  return (
    <Box sx={{ flex: 1, overflow: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 2, maxWidth: 500, mx: 'auto', width: '100%', boxSizing: 'border-box' }}>
        <IconButton size="small" onClick={() => setPage('results')} sx={{ color: tk.textLabel, mr: 1 }}>
          <ArrowBack size={18} strokeWidth={1.75} />
        </IconButton>
        <Typography sx={{ fontFamily: tk.headingFont, fontWeight: 700, fontSize: 18, color: tk.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {authTab === 'login' ? i18n.t('identification.login') : i18n.t('identification.register')}
        </Typography>
      </Box>

      {/* Single centered form */}
      <Box sx={{ px: 3, pb: 3, maxWidth: 500, mx: 'auto', width: '100%', boxSizing: 'border-box' }}>
        <Box sx={{ ...cardSx, p: 3, boxShadow: tk.cardShadow }}>
          <Typography sx={{ fontSize: 13, color: tk.textLabel, mb: 3 }}>
            {authTab === 'login' ? i18n.t('identification.loginSubtitle') : i18n.t('identification.registerSubtitle')}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {authTab === 'register' && (
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: tk.text, mb: 0.5 }}>{i18n.t('identification.firstName')}</Typography>
                  <Box component="input" value={firstName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)} placeholder={i18n.t('identification.firstNamePlaceholder')} sx={inputSx} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: tk.text, mb: 0.5 }}>{i18n.t('identification.lastName')}</Typography>
                  <Box component="input" value={lastName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)} placeholder={i18n.t('identification.lastNamePlaceholder')} sx={inputSx} />
                </Box>
              </Box>
            )}

            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: tk.text, mb: 0.5 }}>{i18n.t('identification.email')}</Typography>
              <Box component="input" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder={i18n.t('identification.emailPlaceholder')} type="email" sx={inputSx} />
            </Box>

            {authTab === 'register' && (
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: tk.text, mb: 0.5 }}>{i18n.t('identification.phone')}</Typography>
                <Box component="input" value={phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} placeholder={i18n.t('identification.phonePlaceholder')} type="tel" sx={inputSx} />
              </Box>
            )}

            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: tk.text, mb: 0.5 }}>{i18n.t('identification.password')}</Typography>
              <Box component="input" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} placeholder={'••••••••'} type="password" sx={inputSx} />
            </Box>

            {error && (
              <Typography sx={{ fontSize: 12, color: '#d32f2f', textAlign: 'center' }}>{error}</Typography>
            )}

            {authTab === 'login' && (
              <Typography sx={{ fontSize: 11, color: tk.primary, cursor: 'pointer', textAlign: 'right', mt: -0.5 }}>
                {i18n.t('identification.forgotPassword')}
              </Typography>
            )}

            <Box onClick={isLoading ? undefined : handleSubmit} sx={{
              ...btnSx, py: 1.25, borderRadius: tk.radiusSm, cursor: isLoading ? 'default' : 'pointer', textAlign: 'center',
              fontSize: 13, fontWeight: 700, textTransform: tk.btnTransform, opacity: isLoading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
            }}>
              {isLoading && <CircularProgress size={14} sx={{ color: 'inherit' }} />}
              {authTab === 'login' ? i18n.t('identification.loginButton') : i18n.t('identification.registerButton')}
            </Box>
          </Box>

          {/* Divider + switch link */}
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 3 }}>
            <Box sx={{ flex: 1, height: 1, bgcolor: tk.border }} />
            <Typography sx={{ px: 2, fontSize: 11, color: tk.textLabel, textTransform: 'uppercase', fontWeight: 600 }}>
              {i18n.t('common.or')}
            </Typography>
            <Box sx={{ flex: 1, height: 1, bgcolor: tk.border }} />
          </Box>

          <Typography
            onClick={() => setAuthTab(authTab === 'login' ? 'register' : 'login')}
            sx={{
              mt: 2, fontSize: 13, color: tk.primary, cursor: 'pointer', textAlign: 'center', fontWeight: 600,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {authTab === 'login' ? i18n.t('identification.noAccount') : i18n.t('identification.hasAccount')}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default BookingAuthPage;
