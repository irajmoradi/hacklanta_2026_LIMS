import { useLayoutEffect, useRef, useState, type ReactNode, type Ref, type PointerEventHandler } from 'react';
import { X } from 'lucide-react';
import './ModalHeader.css';

/** Place first in a scrolling surface. Also observes independently scrolling bodies. */
export function ModalHeader({ title, titleId, eyebrow, onClose, closeLabel = 'Close dialog', disabled = false, closeRef, className = '', onPointerDown, children }: {
  title: ReactNode; titleId?: string; eyebrow?: string; onClose: () => void;
  closeLabel?: string; disabled?: boolean; closeRef?: Ref<HTMLButtonElement>;
  className?: string; onPointerDown?: PointerEventHandler<HTMLElement>; children?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [scroll, setScroll] = useState({ scrolled: false, compact: false });
  useLayoutEffect(() => {
    const header = ref.current!, surface = header.parentElement!;
    let scrollOwner = surface;
    // Read the surface's existing responsive padding instead of duplicating each layout.
    const measure = () => {
      const style = getComputedStyle(surface);
      for (const edge of ['top', 'left', 'right'] as const)
        header.style.setProperty(`--header-${edge}`, style.getPropertyValue(`padding-${edge}`));
    };
    const update = (event?: Event) => {
      const target = event?.target instanceof HTMLElement ? event.target : surface;
      // Nested dialogs own their own scroll state.
      if (target.closest('dialog') !== surface.closest('dialog')) return;
      scrollOwner = target;
      const next = { scrolled: target.scrollTop > 0, compact: target.scrollTop > 40 };
      setScroll(old => old.scrolled === next.scrolled && old.compact === next.compact ? old : next);
    };
    measure(); update();
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    // A tab switch can replace a scrolled body with a fresh one without a scroll event.
    const contentObserver = new MutationObserver(() => {
      if (scrollOwner !== surface && !surface.contains(scrollOwner)) update();
    });
    contentObserver.observe(surface, { childList: true, subtree: true });
    surface.addEventListener('scroll', update, true);
    return () => { observer.disconnect(); contentObserver.disconnect(); surface.removeEventListener('scroll', update, true); };
  }, []);
  return <header ref={ref} className={`modal-header ${className}`} data-scrolled={scroll.scrolled} data-compact={scroll.compact} onPointerDown={onPointerDown}>
    <button ref={closeRef} type="button" className="icon-button modal-close" aria-label={closeLabel} disabled={disabled} onClick={onClose}><X size={20} /></button>
    <div className="modal-header-copy">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={titleId}>{title}</h2>{children}</div>
  </header>;
}
