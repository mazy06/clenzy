import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ─── Mock assistantApi.uploadImage ───────────────────────────────────────────

const uploadImageMock = vi.fn();

vi.mock('../../services/api/assistantApi', () => ({
  assistantApi: {
    uploadImage: (...args: unknown[]) => uploadImageMock(...args),
  },
}));

import { useImageUpload, formatSize } from '../useImageUpload';

describe('useImageUpload', () => {
  beforeEach(() => {
    uploadImageMock.mockReset();
  });

  it('uploads a valid JPEG and returns the AttachmentRef', async () => {
    uploadImageMock.mockResolvedValueOnce({
      storageKey: 'abc123',
      mediaType: 'image/jpeg',
      url: '/api/assistant/attachments/abc123',
      name: 'frigo.jpg',
      size: 1024,
    });

    const { result } = renderHook(() => useImageUpload());
    const file = new File(['fakebytes'], 'frigo.jpg', { type: 'image/jpeg' });

    let ref;
    await act(async () => {
      ref = await result.current.uploadImage(file);
    });

    expect(ref).toEqual({
      storageKey: 'abc123',
      mediaType: 'image/jpeg',
      url: '/api/assistant/attachments/abc123',
      name: 'frigo.jpg',
    });
    expect(uploadImageMock).toHaveBeenCalledTimes(1);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('rejects unsupported MIME type with a clear error', async () => {
    const { result } = renderHook(() => useImageUpload());
    const pdf = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' });

    await act(async () => {
      try {
        await result.current.uploadImage(pdf);
        throw new Error('should have thrown');
      } catch (e) {
        // attendu
      }
    });

    expect(uploadImageMock).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/format/i);
  });

  it('propagates API errors via state', async () => {
    uploadImageMock.mockRejectedValueOnce(new Error('Network down'));
    const { result } = renderHook(() => useImageUpload());
    const file = new File(['bytes'], 'a.jpg', { type: 'image/jpeg' });

    await act(async () => {
      try {
        await result.current.uploadImage(file);
      } catch {
        // attendu
      }
    });

    expect(result.current.error).toBe('Network down');
    expect(result.current.isUploading).toBe(false);
  });

  it('clearError() resets the error state', async () => {
    const { result } = renderHook(() => useImageUpload());
    const pdf = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' });

    await act(async () => {
      try { await result.current.uploadImage(pdf); } catch { /* ignored */ }
    });
    expect(result.current.error).not.toBeNull();

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it('accepts all 4 supported MIME types', async () => {
    uploadImageMock.mockResolvedValue({
      storageKey: 'k', mediaType: 'image/jpeg', url: '/u/k', name: 'x', size: 1,
    });
    const { result } = renderHook(() => useImageUpload());
    for (const mime of ['image/jpeg', 'image/png', 'image/gif', 'image/webp']) {
      const f = new File(['x'], 'x.' + mime.split('/')[1], { type: mime });
      await act(async () => {
        await result.current.uploadImage(f);
      });
    }
    expect(uploadImageMock).toHaveBeenCalledTimes(4);
  });

  it('formatSize formats bytes/KB/MB readable', () => {
    expect(formatSize(500)).toBe('500 B');
    expect(formatSize(2048)).toBe('2 KB');
    expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
