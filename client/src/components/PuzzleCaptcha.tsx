import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Box, Typography, IconButton, CircularProgress, Alert } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import apiClient from '../services/apiClient';

// ─── Types ────────────────────────────────────────────────────

interface CaptchaChallenge {
  token: string;
  backgroundImage: string;
  puzzlePiece: string;
  puzzleY: number;
  width: number;
  height: number;
}

interface CaptchaVerifyResponse {
  success: boolean;
  captchaToken?: string;
  message?: string;
}

interface PuzzleCaptchaProps {
  onVerified: (captchaToken: string) => void;
  onError?: (message: string) => void;
}

// Backend constants
const PIECE_SIZE = 50;
const KNOB_RADIUS = 8;
const PIECE_IMG_SIZE = PIECE_SIZE + KNOB_RADIUS * 2; // 66

export default function PuzzleCaptcha({ onVerified, onError }: PuzzleCaptchaProps) {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // pieceX = position CSS "left" de la piece (en pixels CSS du container)
  const [pieceX, setPieceX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartClientX = useRef(0);
  const dragStartPieceX = useRef(0);

  // ─── Load challenge ───────────────────────────────────────

  const loadChallenge = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccess(false);
    setPieceX(0);

    try {
      const data = await apiClient.post<CaptchaChallenge>(
        '/auth/captcha/generate',
        {},
        { skipAuth: true }
      );
      setChallenge(data);
    } catch {
      setErrorMsg('Impossible de charger le CAPTCHA. Réessayez.');
      onError?.('Impossible de charger le CAPTCHA.');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    loadChallenge();
  }, [loadChallenge]);

  // ─── Verify ────────────────────────────────────────────────

  const verify = useCallback(async (cssPieceX: number) => {
    if (!challenge || verifying || success || !containerRef.current) return;

    // Convertir la position CSS en position native (340px)
    const containerW = containerRef.current.offsetWidth;
    const scale = containerW / challenge.width;

    // cssPieceX = position CSS "left" de l'image piece dans le container
    // L'image piece commence a (puzzleX - KNOB_RADIUS) dans le systeme natif
    // Donc: puzzleX = (cssPieceX / scale) + KNOB_RADIUS
    const nativePieceLeft = cssPieceX / scale;
    const submittedX = Math.round(nativePieceLeft + KNOB_RADIUS);

    setVerifying(true);
    setErrorMsg(null);

    try {
      const result = await apiClient.post<CaptchaVerifyResponse>(
        '/auth/captcha/verify',
        { token: challenge.token, x: submittedX },
        { skipAuth: true }
      );

      if (result.success && result.captchaToken) {
        setSuccess(true);
        onVerified(result.captchaToken);
      } else {
        const msg = result.message || 'Position incorrecte. Réessayez.';
        setErrorMsg(msg);

        if (msg.toLowerCase().includes('regenerer') || msg.toLowerCase().includes('trop de tentatives')) {
          setTimeout(() => loadChallenge(), 2000);
        } else {
          setTimeout(() => {
            setPieceX(0);
            setErrorMsg(null);
          }, 1200);
        }
      }
    } catch {
      setErrorMsg('Erreur de vérification. Nouveau puzzle...');
      setTimeout(() => loadChallenge(), 2000);
    } finally {
      setVerifying(false);
    }
  }, [challenge, verifying, success, onVerified, loadChallenge]);

  // ─── Drag handlers ────────────────────────────────────────

  const getClientX = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): number => {
    if ('touches' in e && e.touches.length > 0) return e.touches[0].clientX;
    if ('changedTouches' in e && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
    return (e as MouseEvent).clientX;
  };

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (success || verifying || !challenge) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartClientX.current = getClientX(e);
    dragStartPieceX.current = pieceX;
  }, [success, verifying, challenge, pieceX]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !challenge || !containerRef.current) return;
    e.preventDefault();

    const containerW = containerRef.current.offsetWidth;
    const scale = containerW / challenge.width;
    const scaledPieceImgSize = PIECE_IMG_SIZE * scale;
    const maxX = containerW - scaledPieceImgSize;

    const delta = getClientX(e) - dragStartClientX.current;
    const newX = Math.max(0, Math.min(maxX, dragStartPieceX.current + delta));
    setPieceX(newX);
  }, [isDragging, challenge]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    verify(pieceX);
  }, [isDragging, pieceX, verify]);

  // ─── Global listeners ─────────────────────────────────────

  useEffect(() => {
    if (!isDragging) return;

    const move = (e: MouseEvent | TouchEvent) => handleDragMove(e);
    const end = () => handleDragEnd();

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);

    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // ─── Render ───────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 3 }}>
        <CircularProgress size={24} sx={{ color: 'secondary.main' }} />
        <Typography variant="body2" sx={{ ml: 1, color: 'text.secondary', fontSize: '0.8rem' }}>
          Chargement...
        </Typography>
      </Box>
    );
  }

  if (!challenge) {
    return (
      <Alert severity="error" sx={{ py: 0.5 }}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
          {errorMsg || 'Erreur de chargement.'}
        </Typography>
      </Alert>
    );
  }

  // Calcul d'echelle pour l'affichage
  const containerW = containerRef.current?.offsetWidth || challenge.width;
  const scale = containerW / challenge.width;
  const scaledPieceImgSize = PIECE_IMG_SIZE * scale;
  const scaledPieceY = (challenge.puzzleY - KNOB_RADIUS) * scale;

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500 }}>
          Glissez la piece dans le trou
        </Typography>
        <IconButton
          size="small"
          onClick={loadChallenge}
          disabled={verifying || loading}
          sx={{ color: 'secondary.main', p: 0.5 }}
          title="Nouveau puzzle"
        >
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Puzzle image + piece draggable */}
      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          width: challenge.width,
          maxWidth: '100%',
          aspectRatio: `${challenge.width} / ${challenge.height}`,
          borderRadius: 1,
          overflow: 'hidden',
          border: success ? '2px solid #4caf50' : '1px solid #ddd',
          mx: 'auto',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {/* Background with hole */}
        <img
          src={challenge.backgroundImage}
          alt=""
          style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
          draggable={false}
        />

        {/* Draggable piece */}
        <Box
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          sx={{
            position: 'absolute',
            top: scaledPieceY,
            left: pieceX,
            width: scaledPieceImgSize,
            height: scaledPieceImgSize,
            cursor: success ? 'default' : isDragging ? 'grabbing' : 'grab',
            filter: isDragging
              ? 'drop-shadow(3px 3px 6px rgba(0,0,0,0.5))'
              : 'drop-shadow(1px 1px 3px rgba(0,0,0,0.3))',
            transition: isDragging ? 'none' : 'filter 0.2s, left 0.15s ease-out',
            pointerEvents: success ? 'none' : 'auto',
            zIndex: 2,
          }}
        >
          <img
            src={challenge.puzzlePiece}
            alt=""
            style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
            draggable={false}
          />
        </Box>

        {/* Success overlay */}
        {success && (
          <Box sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(76,175,80,0.15)',
          }}>
            <Typography sx={{
              color: '#2e7d32',
              fontWeight: 700,
              fontSize: '1rem',
              bgcolor: 'rgba(255,255,255,0.85)',
              px: 2, py: 0.5,
              borderRadius: 1,
            }}>
              Verifie
            </Typography>
          </Box>
        )}
      </Box>

      {/* Instruction / slider hint (pas un vrai slider, juste un indicateur visuel) */}
      {!success && (
        <Box sx={{
          mt: 0.75,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
        }}>
          <Typography sx={{ fontSize: '0.7rem', color: '#aaa' }}>
            {'◀ '}Glissez la piece sur l'image{' ▶'}
          </Typography>
        </Box>
      )}

      {/* Error */}
      {errorMsg && (
        <Alert severity="warning" sx={{ mt: 0.5, py: 0, '& .MuiAlert-message': { py: 0.5 } }}>
          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>{errorMsg}</Typography>
        </Alert>
      )}
    </Box>
  );
}
