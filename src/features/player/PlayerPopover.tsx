import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

const OPEN_EVENT = "drift:player-popover-open";

type Position = { top: number; left: number; minWidth: number };

export function usePlayerPopover(id: string) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onOtherPopover(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (detail !== id) setOpen(false);
    }
    window.addEventListener(OPEN_EVENT, onOtherPopover);
    return () => window.removeEventListener(OPEN_EVENT, onOtherPopover);
  }, [id]);

  function toggle() {
    setOpen((value) => {
      const next = !value;
      if (next) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
      return next;
    });
  }

  return { open, setOpen, close: () => setOpen(false), toggle, buttonRef };
}

export function PlayerPopover({
  open,
  buttonRef,
  onClose,
  label,
  className = "",
  children,
}: {
  open: boolean;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setPosition(null);
      return;
    }

    function place() {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const panel = panelRef.current;
      const width = Math.min(panel?.offsetWidth || 280, window.innerWidth - 16);
      const height = panel?.offsetHeight || 280;
      const gap = 8;
      const opensBelow = rect.bottom + height + gap <= window.innerHeight;
      const top = opensBelow ? rect.bottom + gap : Math.max(8, rect.top - height - gap);
      const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
      setPosition({ top, left, minWidth: width });
    }

    place();
    const frame = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
    };
  }, [open, buttonRef]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open, buttonRef, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      ref={panelRef}
      className={`player-popover player-popover-portal ${className}`}
      role="dialog"
      aria-label={label}
      style={position ? { top: position.top, left: position.left, minWidth: position.minWidth } : { visibility: "hidden", top: 8, left: 8 }}
    >
      {children}
    </div>,
    document.body,
  );
}
