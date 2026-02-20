import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Box, Typography, IconButton, CircularProgress, Alert } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import apiClient from '../services/apiClient';

// ─── Types ────────────────────────────────────────────────────

interface CaptchaChallenge {
  token: string;
  backgroundImage: string; // base64 PNG data URI
  puzzlePiece: string;     // base64 PNG data URI
  puzzleY: number;         // Y position of the puzzle piece
  width: number;           // background width (340)
  height: number;          // background height (200)
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

// ─── Constants ────────────────────────────────────────────────

const PIECE_DISPLAY_SIZE = 50;  // visual piece size (matches backend PIECE_SIZE)
const KNOB_RADIUS = 8;         // matches backend KNOB_RADIUS

// ─── Component ────────────────────────────────────────────────

export default function PuzzleCaptcha({ onVerified, onError }: PuzzleCaptchaProps) {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sliderX, setSliderX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartSliderX = useRef(0);

  // ─── Load challenge ───────────────────────────────────────

  const loadChallenge = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccess(false);
    setSliderX(0);

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

  // ─── Verify answer ────────────────────────────────────────

  const verify = useCallback(async (x: number) => {
    if (!challenge || verifying || success) return;

    setVerifying(true);
    setErrorMsg(null);

    try {
      const result = await apiClient.post<CaptchaVerifyResponse>(
        '/auth/captcha/verify',
        { token: challenge.token, x: Math.round(x) },
        { skipAuth: true }
      );

      if (result.success && result.captchaToken) {
        setSuccess(true);
        onVerified(result.captchaToken);
      } else {
        setErrorMsg(result.message || 'Position incorrecte. Réessayez.');
        // Reset slider position after failed attempt
        setTimeout(() => {
          setSliderX(0);
          setErrorMsg(null);
        }, 1500);
      }
    } catch {
      setErrorMsg('Erreur de vérification. Réessayez.');
      setSliderX(0);
    } finally {
      setVerifying(false);
    }
  }, [challenge, verifying, success, onVerified]);

  // ─── Drag handlers ────────────────────────────────────────

  const getClientX = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): number => {
    if ('touches' in e) {
      return e.touches[0]?.clientX ?? 0;
    }
    return (e as MouseEvent).clientX;
  };

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (success || verifying || !challenge) return;
    e.preventDefault();

    setIsDragging(true);
    dragStartX.current = getClientX(e);
    dragStartSliderX.current = sliderX;
  }, [success, verifying, challenge, sliderX]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !challenge || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const maxX = containerWidth - PIECE_DISPLAY_SIZE - KNOB_RADIUS;
    const deltaX = getClientX(e) - dragStartX.current;
    const newX = Math.max(0, Math.min(maxX, dragStartSliderX.current + deltaX));

    setSliderX(newX);
  }, [isDragging, challenge]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // Submit for verification
    // The sliderX represents the pixel offset from the left edge
    // We need to account for the knob radius offset since the piece image
    // starts at (puzzleX - KNOB_RADIUS) in the backend
    verify(sliderX + KNOB_RADIUS);
  }, [isDragging, sliderX, verify]);

  // ─── Global mouse/touch listeners ─────────────────────────

  useEffect(() => {
    if (isDragging) {
      const moveHandler = (e: MouseEvent | TouchEvent) => handleDragMove(e);
      const endHandler = () => handleDragEnd();

      window.addEventListener('mousemove', moveHandler);
      window.addEventListener('mouseup', endHandler);
      window.addEventListener('touchmove', moveHandler, { passive: false });
      window.addEventListener('touchend', endHandler);

      return () => {
        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('mouseup', endHandler);
        window.removeEventListener('touchmove', moveHandler);
        window.removeEventListener('touchend', endHandler);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // ─── Render ───────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 3 }}>
        <CircularProgress size={24} sx={{ color: 'secondary.main' }} />
        <Typography variant="body2" sx={{ ml: 1, color: 'text.secondary', fontSize: '0.8rem' }}>
          Chargement du CAPTCHA...
        </Typography>
      </Box>
    );
  }

  if (!challenge) {
    return (
      <Alert severity="error" sx={{ py: 0.5 }}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
          {errorMsg || 'Erreur de chargement du CAPTCHA.'}
        </Typography>
      </Alert>
    );
  }

  const containerWidth = challenge.width;
  const containerHeight = challenge.height;

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500 }}>
          🧩 Glissez la pièce pour compléter le puzzle
        </Typography>
        <IconButton
          size="small"
          onClick={loadChallenge}
          disabled={verifying}
          sx={{ color: 'secondary.main', p: 0.5 }}
          title="Nouveau puzzle"
        >
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Puzzle area */}
      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          width: containerWidth,
          height: containerHeight,
          maxWidth: '100%',
          borderRadius: 1,
          overflow: 'hidden',
          border: success ? '2px solid #4caf50' : '1px solid #e0e0e0',
          mx: 'auto',
          userSelect: 'none',
          transition: 'border-color 0.3s ease',
        }}
      >
        {/* Background image with hole */}
        <img
          src={challenge.backgroundImage}
          alt="Puzzle background"
          style={{
            width: containerWidth,
            height: containerHeight,
            display: 'block',
            pointerEvents: 'none',
          }}
          draggable={false}
        />

        {/* Draggable puzzle piece */}
        <Box
          sx={{
            position: 'absolute',
            top: challenge.puzzleY - KNOB_RADIUS,
            left: sliderX,
            width: PIECE_DISPLAY_SIZE + KNOB_RADIUS * 2,
            height: PIECE_DISPLAY_SIZE + KNOB_RADIUS * 2,
            cursor: success ? 'default' : 'grab',
            opacity: success ? 0.9 : 1,
            filter: isDragging ? 'drop-shadow(2px 2px 4px rgba(0,0,0,0.4))' : 'drop-shadow(1px 1px 3px rgba(0,0,0,0.3))',
            transition: isDragging ? 'none' : 'filter 0.2s ease',
            pointerEvents: success ? 'none' : 'auto',
          }}
        >
          <img
            src={challenge.puzzlePiece}
            alt="Puzzle piece"
            style={{
              width: PIECE_DISPLAY_SIZE + KNOB_RADIUS * 2,
              height: PIECE_DISPLAY_SIZE + KNOB_RADIUS * 2,
              display: 'block',
              pointerEvents: 'none',
            }}
            draggable={false}
          />
        </Box>

        {/* Success overlay */}
        {success && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(76, 175, 80, 0.15)',
              borderRadius: 1,
            }}
          >
            <Typography sx={{
              color: '#2e7d32',
              fontWeight: 700,
              fontSize: '1rem',
              backgroundColor: 'rgba(255,255,255,0.85)',
              px: 2,
              py: 0.5,
              borderRadius: 1,
            }}>
              ✓ Vérifié
            </Typography>
          </Box>
        )}
      </Box>

      {/* Slider track */}
      {!success && (
        <Box sx={{ mt: 1, px: 0.5 }}>
          <Box
            sx={{
              position: 'relative',
              width: containerWidth,
              maxWidth: '100%',
              height: 36,
              backgroundColor: '#f5f5f5',
              borderRadius: 18,
              border: '1px solid #e0e0e0',
              mx: 'auto',
              overflow: 'hidden',
            }}
          >
            {/* Progress fill */}
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: sliderX + 36,
                backgroundColor: isDragging ? 'rgba(166, 192, 206, 0.4)' : 'rgba(166, 192, 206, 0.2)',
                borderRadius: 18,
                transition: isDragging ? 'none' : 'background-color 0.2s ease',
              }}
            />

            {/* Slider handle */}
            <Box
              ref={sliderRef}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              sx={{
                position: 'absolute',
                left: sliderX,
                top: 2,
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: isDragging ? 'secondary.dark' : 'secondary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: verifying ? 'wait' : 'grab',
                boxShadow: isDragging ? '0 2px 8px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.2)',
                transition: isDragging ? 'none' : 'background-color 0.2s ease, box-shadow 0.2s ease',
                '&:active': { cursor: 'grabbing' },
                zIndex: 1,
              }}
            >
              {verifying ? (
                <CircularProgress size={16} sx={{ color: 'white' }} />
              ) : (
                <Typography sx={{ color: 'white', fontSize: '0.9rem', fontWeight: 700, userSelect: 'none' }}>
                  ⟩⟩
                </Typography>
              )}
            </Box>

            {/* Hint text */}
            {sliderX === 0 && !isDragging && (
              <Typography sx={{
                position: 'absolute',
                left: 44,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '0.75rem',
                color: '#999',
                userSelect: 'none',
                pointerEvents: 'none',
              }}>
                Glissez vers la droite →
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {/* Error message */}
      {errorMsg && (
        <Alert severity="warning" sx={{ mt: 0.5, py: 0, '& .MuiAlert-message': { py: 0.5 } }}>
          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>{errorMsg}</Typography>
        </Alert>
      )}
    </Box>
  );
}
