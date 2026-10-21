/** Native hospitality interactions. Template HTML carries settings, never executable scripts. */
const active = new WeakMap<ParentNode, () => void>();

export function enhanceHospitality(root: ParentNode = document, options: { imageSource?: (link: HTMLAnchorElement) => string } = {}): () => void {
  const existing = active.get(root);
  if (existing) return existing;
  const doc = root.nodeType === 9 ? root as Document : (root as Node).ownerDocument;
  const win = doc?.defaultView;
  if (!doc || !win) return () => {};
  const sites = [...root.querySelectorAll<HTMLElement>('[data-baitly-template]')];
  if (!sites.length) return () => {};
  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
  const cleanups: Array<() => void> = [];
  const animations: Animation[] = [];
  const listen = (target: EventTarget, event: string, handler: EventListener) => {
    target.addEventListener(event, handler, { passive: event === 'scroll' });
    cleanups.push(() => target.removeEventListener(event, handler));
  };
  if (!reduced && win.IntersectionObserver) {
    const observer = new win.IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const element = entry.target as HTMLElement;
      const mode = element.dataset.baitlyReveal;
      if (mode && mode !== 'none' && element.animate) {
        const duration = Math.min(1200, Math.max(200, Number(element.dataset.baitlySpeed) || 700));
        animations.push(element.animate([
          { opacity: 0, transform: mode === 'fade' ? 'none' : 'translateY(24px)' },
          { opacity: 1, transform: 'none' },
        ], { duration, easing: 'cubic-bezier(.22,1,.36,1)' }));
      }
      observer.unobserve(element);
    }), { threshold: 0.12 });
    sites.forEach((site) => site.querySelectorAll('[data-baitly-reveal]').forEach((element) => observer.observe(element)));
    cleanups.push(() => observer.disconnect());
  }
  let frame = 0;
  const parallax = sites.flatMap((site) => [...site.querySelectorAll<HTMLElement>('[data-baitly-parallax="true"]')]);
  const transforms = new Map<HTMLElement, string>();
  const updateScroll = () => {
    frame = 0;
    sites.forEach((site) => site.toggleAttribute('data-baitly-scrolled', win.scrollY > 32));
    if (reduced || win.innerWidth < 800) return;
    parallax.forEach((section) => {
      const image = section.querySelector<HTMLElement>('.bt-hero__photo');
      if (!image) return;
      const rect = section.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= win.innerHeight) return;
      if (!transforms.has(image)) transforms.set(image, image.style.transform);
      image.style.transform = `translateY(${Math.max(-22, Math.min(22, -rect.top * .045))}px) scale(1.045)`;
    });
  };
  listen(win, 'scroll', () => { if (!frame) frame = win.requestAnimationFrame(updateScroll); });
  updateScroll();

  // Gallery links remain ordinary image links when JS is unavailable.
  let dialog: HTMLDialogElement | null = null;
  let previousFocus: HTMLElement | null = null;
  const closeImage = () => { dialog?.close(); dialog?.remove(); dialog = null; previousFocus?.focus(); };
  sites.forEach((site) => listen(site, 'click', (event) => {
    const target = event.target as Element;
    const scrollButton = target.closest<HTMLElement>('[data-baitly-gallery-step]');
    if (scrollButton) {
      const track = scrollButton.closest('[data-baitly-gallery]')?.querySelector<HTMLElement>('.bt-photo-track');
      track?.scrollBy({ left: (Number(scrollButton.dataset.baitlyGalleryStep) || 1) * track.clientWidth * .8, behavior: reduced ? 'instant' : 'smooth' });
      return;
    }
    const link = target.closest<HTMLAnchorElement>('a[data-baitly-image]');
    if (!link || !doc.createElement('dialog').showModal) return;
    event.preventDefault();
    previousFocus = link;
    dialog = doc.createElement('dialog');
    dialog.className = 'bt-lightbox';
    dialog.setAttribute('aria-label', link.querySelector('img')?.alt || 'Photo');
    const image = doc.createElement('img');
    image.src = options.imageSource?.(link) || link.href;
    image.alt = link.querySelector('img')?.alt || '';
    const close = doc.createElement('button');
    close.type = 'button';
    close.textContent = 'Fermer';
    close.className = 'bt-lightbox__close';
    close.addEventListener('click', closeImage);
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); closeImage(); });
    dialog.append(image, close);
    doc.body.appendChild(dialog);
    dialog.showModal();
    close.focus();
  }));
  const cleanup = () => {
    cleanups.forEach((stop) => stop());
    animations.forEach((animation) => animation.cancel());
    if (frame) win.cancelAnimationFrame(frame);
    transforms.forEach((transform, image) => { image.style.transform = transform; });
    sites.forEach((site) => site.removeAttribute('data-baitly-scrolled'));
    dialog?.remove();
    active.delete(root);
  };
  active.set(root, cleanup);
  return cleanup;
}
