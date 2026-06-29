import { useRef, useState } from "react";
import { tapHaptic } from "./haptics.ts";

const THRESHOLD = 68;
const MAX_PULL = 86;

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  tracking: boolean;
  lockedAxis: "x" | "y" | null;
  thresholdHaptic: boolean;
};

function rubberBand(offset: number) {
  if (offset <= MAX_PULL) return offset;
  return MAX_PULL + (offset - MAX_PULL) * 0.16;
}

export function useSwipeToReply(onTrigger: () => void) {
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const suppressClickRef = useRef(false);
  const dragState = useRef<DragState>({
    pointerId: -1,
    startX: 0,
    startY: 0,
    tracking: false,
    lockedAxis: null,
    thresholdHaptic: false
  });
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [justTriggered, setJustTriggered] = useState(false);

  function resetDragState() {
    dragState.current = {
      pointerId: -1,
      startX: 0,
      startY: 0,
      tracking: false,
      lockedAxis: null,
      thresholdHaptic: false
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      tracking: true,
      lockedAxis: null,
      thresholdHaptic: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    if (!drag.tracking || event.pointerId !== drag.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!drag.lockedAxis) {
      if (absX < 6 && absY < 6) return;
      if (absY > absX + 4) {
        drag.tracking = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }
      if (dx <= 0) {
        drag.tracking = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }
      if (absX > absY + 4) {
        drag.lockedAxis = "x";
        setIsDragging(true);
      } else {
        return;
      }
    }

    if (dx <= 0) {
      setOffset(0);
      return;
    }

    const nextOffset = rubberBand(dx);
    setOffset(nextOffset);

    if (nextOffset >= THRESHOLD && !drag.thresholdHaptic) {
      drag.thresholdHaptic = true;
      tapHaptic(8);
    } else if (nextOffset < THRESHOLD) {
      drag.thresholdHaptic = false;
    }
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    if (!drag.tracking || event.pointerId !== drag.pointerId) return;

    const triggered = offset >= THRESHOLD;

    if (isDragging) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 360);
    }

    if (triggered) {
      tapHaptic(14);
      setJustTriggered(true);
      window.setTimeout(() => setJustTriggered(false), 280);
      onTrigger();
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsDragging(false);
    setOffset(0);
    resetDragState();
  }

  const progress = Math.min(offset / THRESHOLD, 1);

  return {
    zoneRef,
    offset,
    isDragging,
    progress,
    ready: progress >= 1,
    justTriggered,
    suppressClickRef,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd
    },
    onClickCapture(event: React.MouseEvent) {
      if (suppressClickRef.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  };
}