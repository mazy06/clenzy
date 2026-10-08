import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { AgentPortrait } from '../renderers/AgentPortrait';

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(false);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) }),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());

describe('AgentPortrait motion media', () => {
  it('shows a fallback immediately and prioritises the still before requesting motion', () => {
    const { container } = render(<AgentPortrait agentId="rep" receiving />);
    const still = container.querySelector('img')!;
    expect(still).toHaveAttribute('loading', 'eager');
    expect(still).toHaveAttribute('fetchpriority', 'high');
    expect(container.querySelector('.baitly-agent-portrait__placeholder')).not.toBeNull();
    expect(container.querySelector('video')).toBeNull();
    fireEvent.load(still);
    expect(container.querySelector('.baitly-agent-portrait__placeholder')).toBeNull();
    expect(container.querySelector('video')).not.toBeNull();
  });
  it('loads only when aligned, synchronises after decoding, and releases video on pause', () => {
    const { container, rerender } = render(<AgentPortrait agentId="gro" />);
    expect(container.querySelector('video')).toBeNull();
    rerender(<AgentPortrait agentId="gro" receiving />);
    fireEvent.load(container.querySelector('img')!);
    const video = container.querySelector('video')!;
    expect(video.getAttribute('src')).toContain('/gro.webm');
    expect(video.muted).toBe(true);
    expect(container.querySelector('.baitly-agent-portrait__image')).not.toBeNull();
    vi.spyOn(performance, 'now').mockReturnValue(9100);
    fireEvent.loadedData(video);
    expect(video.currentTime).toBeCloseTo(2.7);
    expect(video.play).toHaveBeenCalledOnce();
    fireEvent.playing(video);
    expect(video.hasAttribute('data-ready')).toBe(true);
    expect(container.querySelector('.baitly-agent-portrait__image')).not.toBeNull();
    rerender(<AgentPortrait agentId="gro" receiving={false} />);
    expect(video.pause).toHaveBeenCalled();
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('[data-receiving]')).toBeNull();
    expect(container.querySelector('img')?.src).toContain('/gro.webp');
  });

  it('uses animated WebP when the browser discards video transparency', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({
      drawImage: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
    } as unknown as CanvasRenderingContext2D);
    const { container } = render(<AgentPortrait agentId="fin" receiving />);
    fireEvent.load(container.querySelector('img')!);
    fireEvent.loadedData(container.querySelector('video')!);
    expect(container.querySelector('video')).toBeNull();
    const fallback = container.querySelector<HTMLImageElement>('.baitly-agent-portrait__motion')!;
    expect(fallback.src).toContain('/fin-animated.webp');
    fireEvent.load(fallback);
    expect(fallback.hasAttribute('data-ready')).toBe(true);
    expect(container.querySelector('.baitly-agent-portrait__image')).not.toBeNull();
  });

  it('retains the still portrait if both motion formats fail', () => {
    const { container } = render(<AgentPortrait agentId="ops" receiving />);
    fireEvent.load(container.querySelector('img')!);
    fireEvent.error(container.querySelector('video')!);
    fireEvent.error(container.querySelector('.baitly-agent-portrait__motion')!);
    expect(container.querySelector('.baitly-agent-portrait__motion')).toBeNull();
    expect(container.querySelector('img')?.src).toContain('/ops.webp');
  });

  it('handles denied autoplay without leaving an empty agent', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new DOMException('Autoplay denied', 'NotAllowedError'));
    const { container } = render(<AgentPortrait agentId="com" receiving />);
    fireEvent.load(container.querySelector('img')!);
    fireEvent.loadedData(container.querySelector('video')!);
    await waitFor(() => expect(container.querySelector('video')).toBeNull());
    expect(container.querySelector('.baitly-agent-portrait__motion')).toBeNull();
    expect(container.querySelector('.baitly-agent-portrait__image')).toHaveAttribute('data-ready');
  });

  it('does not reuse a decoded movie for another specialist', () => {
    const { container, rerender } = render(<AgentPortrait agentId="gro" receiving />);
    fireEvent.load(container.querySelector('img')!);
    const oldVideo = container.querySelector('video')!;
    fireEvent.playing(oldVideo);
    rerender(<AgentPortrait agentId="com" receiving />);
    expect(oldVideo.pause).toHaveBeenCalled();
    expect(container.querySelector('video')).toBeNull();
    fireEvent.load(container.querySelector('img')!);
    expect(container.querySelector('video')?.getAttribute('src')).toContain('/com.webm');
    expect(container.querySelector('.baitly-agent-portrait__image')).not.toBeNull();
  });
});
