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

// Doivent correspondre au backend CaptchaService
const PIECE_SIZE = 50;
const KNOB_RADIUS = 8;
const PIECE_IMAGE_SIZE = PIECE_SIZE + KNOB_RADIUS * 2; // 66px

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

  // ─── Calcul du ratio d'echelle ─────────────────────────────
  // Le container CSS peut etre plus petit que 340px (responsive),
  // donc on doit convertir les pixels CSS en pixels "natifs" du backend.

  const getScale = useCallback((): number => {
    if (!containerRef.current || !challenge) return 1;
    return containerRef.current.offsetWidth / challenge.width;
  }, [challenge]);

  // ─── Verify answer ────────────────────────────────────────

  const verify = useCallback(async (cssX: number) => {
    if (!challenge || verifying || success) return;

    // Convertir la position CSS en position "native" du backend
    const scale = getScale();
    const nativeX = Math.round(cssX / scale);

    // La position X soumise doit correspondre a puzzleX du backend.
    // L'image de la piece est generee avec un offset de -KNOB_RADIUS
    // (le bord gauche de l'image = puzzleX - KNOB_RADIUS).
    // Quand le CSS left = sliderX, le bord gauche de l'image est a sliderX.
    // Donc puzzleX = sliderX + KNOB_RADIUS (en natif).
    const submittedX = nativeX + KNOB_RADIUS;

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

        // Si trop de tentatives → regenerer automatiquement
        if (msg.includes('regenerer') || msg.includes('Trop de tentatives')) {
          setTimeout(() => {
            loadChallenge();
          }, 2000);
        } else {
          // Reset slider apres un echec simple
          setTimeout(() => {
            setSliderX(0);
            setErrorMsg(null);
          }, 1500);
        }
      }
    } catch {
      setErrorMsg('Erreur de vérification. Nouveau puzzle...');
      // En cas d'erreur reseau, regenerer
      setTimeout(() => {
        loadChallenge();
      }, 2000);
    } finally {
      setVerifying(false);
    }
  }, [challenge, verifying, success, onVerified, getScale, loadChallenge]);

  // ─── Drag handlers ────────────────────────────────────────

  const getClientX = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): number => {
    if ('touches' in e && e.touches.length > 0) {
      return e.touches[0].clientX;
    }
    if ('changedTouches' in e && e.changedTouches.length > 0) {
      return e.changedTouches[0].clientX;
    }
    return (e as MouseEvent).clientX;
  };

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (success || verifying || !challenge) return;
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    dragStartX.current = getClientX(e);
    dragStartSliderX.current = sliderX;
  }, [success, verifying, challenge, sliderX]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !challenge || !containerRef.current) return;
    e.preventDefault(); // Empecher le scroll sur mobile

    const containerWidth = containerRef.current.offsetWidth;
    const scale = containerWidth / challenge.width;
    const scaledPieceImageSize = PIECE_IMAGE_SIZE * scale;
    const maxX = containerWidth - scaledPieceImageSize;
    const deltaX = getClientX(e) - dragStartX.current;
    const newX = Math.max(0, Math.min(maxX, dragStartSliderX.current + deltaX));

    setSliderX(newX);
  }, [isDragging, challenge]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    verify(sliderX);
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

  // L'echelle pour le rendu responsive
  // On fixe la largeur max a challenge.width (340px) mais elle peut etre plus petite
  const scale = containerRef.current
    ? containerRef.current.offsetWidth / challenge.width
    : 1;
  const scaledPieceImageSize = PIECE_IMAGE_SIZE * scale;
  const scaledPuzzleY = (challenge.puzzleY - KNOB_RADIUS) * scale;

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500 }}>
          Glissez la piece pour completer le puzzle
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
          width: challenge.width,
          maxWidth: '100%',
          // Hauteur proportionnelle pour garder le ratio
          aspectRatio: `${challenge.width} / ${challenge.height}`,
          borderRadius: 1,
          overflow: 'hidden',
          border: success ? '2px solid #4caf50' : '1px solid #e0e0e0',
          mx: 'auto',
          userSelect: 'none',
          touchAction: 'none', // Empecher le scroll pendant le drag
          transition: 'border-color 0.3s ease',
        }}
      >
        {/* Background image with hole */}
        <img
          src={challenge.backgroundImage}
          alt="Puzzle background"
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            pointerEvents: 'none',
          }}
          draggable={false}
        />

        {/* Draggable puzzle piece */}
        <Box
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          sx={{
            position: 'absolute',
            top: scaledPuzzleY,
            left: sliderX,
            width: scaledPieceImageSize,
            height: scaledPieceImageSize,
            cursor: success ? 'default' : isDragging ? 'grabbing' : 'grab',
            opacity: success ? 0.9 : 1,
            filter: isDragging
              ? 'drop-shadow(2px 2px 6px rgba(0,0,0,0.5))'
              : 'drop-shadow(1px 1px 3px rgba(0,0,0,0.3))',
            transition: isDragging ? 'none' : 'filter 0.2s ease',
            pointerEvents: success ? 'none' : 'auto',
            zIndex: 2,
          }}
        >
          <img
            src={challenge.puzzlePiece}
            alt="Puzzle piece"
            style={{
              width: '100%',
              height: '100%',
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
              Verifie
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
              width: challenge.width,
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
                cursor: verifying ? 'wait' : isDragging ? 'grabbing' : 'grab',
                boxShadow: isDragging ? '0 2px 8px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.2)',
                transition: isDragging ? 'none' : 'background-color 0.2s ease, box-shadow 0.2s ease',
                zIndex: 1,
                touchAction: 'none',
              }}
            >
              {verifying ? (
                <CircularProgress size={16} sx={{ color: 'white' }} />
              ) : (
                <Typography sx={{ color: 'white', fontSize: '0.9rem', fontWeight: 700, userSelect: 'none' }}>
                  {'>>'}
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
                Glissez vers la droite
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
