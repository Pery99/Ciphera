import { useLayoutEffect, useRef, useState } from "react";
import { CornerUpLeft } from "lucide-react";
import { tapHaptic } from "../haptics.ts";

type MessageActionMenuProps = {
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  align: "start" | "end";
  onReply: () => void;
  onClose: () => void;
};

export function MessageActionMenu({ open, anchorRef, align, onReply, onClose }: MessageActionMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !menuRef.current) {
      setPosition(null);
      return;
    }

    function updatePosition() {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (!anchor || !menu) return;

      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const margin = 10;
      const gap = 6;

      let top = anchorRect.bottom + gap;
      let left = align === "end" ? anchorRect.right - menuRect.width : anchorRect.left;

      if (top + menuRect.height > window.innerHeight - margin) {
        top = Math.max(margin, anchorRect.top - menuRect.height - gap);
      }
      if (left < margin) left = margin;
      if (left + menuRect.width > window.innerWidth - margin) {
        left = window.innerWidth - menuRect.width - margin;
      }

      setPosition({ top, left });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, align, anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="bubble-menu bubble-menu--floating"
      style={position ? { top: position.top, left: position.left } : undefined}
      role="menu"
    >
      <button
        type="button"
        className="bubble-menu-item tap-spring"
        role="menuitem"
        onClick={() => {
          tapHaptic();
          onReply();
        }}
      >
        <CornerUpLeft size={16} />
        Reply
      </button>
    </div>
  );
}