import com from '../../../../public/images/supervision-agents/com.webp';
import rev from '../../../../public/images/supervision-agents/rev.webp';
import ops from '../../../../public/images/supervision-agents/ops.webp';
import fin from '../../../../public/images/supervision-agents/fin.webp';
import rep from '../../../../public/images/supervision-agents/rep.webp';
import sync from '../../../../public/images/supervision-agents/sync.webp';
import cmp from '../../../../public/images/supervision-agents/cmp.webp';
import gst from '../../../../public/images/supervision-agents/gst.webp';
import own from '../../../../public/images/supervision-agents/own.webp';
import gro from '../../../../public/images/supervision-agents/gro.webp';
import type { AgentId } from '../types';

/** One cacheable, content-hashed URL per portrait, shared with the public demos. */
export const AGENT_PORTRAITS = { com, rev, ops, fin, rep, sync, cmp, gst, own, gro } satisfies Record<AgentId, string>;

const warming = new Map<string, Promise<void>>();

/** Warm only the ten small stills (~190 KB), never videos or animated WebP. */
export function preloadAgentPortraits(): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  return Promise.all(Object.values(AGENT_PORTRAITS).map(src => {
    const cached = warming.get(src);
    if (cached) return cached;
    const image = new Image();
    image.decoding = 'async';
    const ready = new Promise<void>(resolve => {
      image.onload = () => {
        if (typeof image.decode === 'function') void image.decode().catch(() => {}).then(resolve);
        else resolve();
      };
      image.onerror = () => { warming.delete(src); resolve(); };
    });
    warming.set(src, ready);
    image.src = src;
    return ready;
  })).then(() => {});
}
