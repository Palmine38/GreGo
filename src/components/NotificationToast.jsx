import { useEffect, useRef, useState } from "react";

const styles = {
  error: {
    // Palette strictement identique à DisruptionItem.
    container: "border-amber-200 bg-amber-50 text-amber-800",
    icon: "text-amber-700",
    message: "text-amber-600",
    title: "Erreur de recherche",
  },
  warning: {
    // Les résultats sans trajet utilisent aussi la palette DisruptionItem.
    container: "border-amber-200 bg-amber-50 text-amber-800",
    icon: "text-amber-700",
    message: "text-amber-600",
    title: "Information sur le trajet",
  },
  success: {
    container: "border-emerald-200 bg-emerald-50 text-emerald-950",
    icon: "bg-emerald-100 text-emerald-700",
    title: "Opération terminée",
  },
};

const DisruptionIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    className="size-4"
    style={{ color: "#fcbe03" }}
  >
    <path d="M8 3.5 3 12.5h10L8 3.5Z" fill="white" />
    <path
      fillRule="evenodd"
      fill="currentColor"
      d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 1 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 2Z"
      clipRule="evenodd"
    />
  </svg>
);

export function NotificationToast({
  message,
  onClose,
  variant = "error",
  title,
  duration = 7000,
}) {
  const appearance = styles[variant] || styles.error;
  const dragStartX = useRef(null);
  const dragXRef = useRef(0);
  const pointerId = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!message || !duration) return undefined;
    const timeout = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timeout);
  }, [message, onClose, duration]);

  if (!message) return null;

  const handlePointerDown = (event) => {
    dragStartX.current = event.clientX;
    pointerId.current = event.pointerId;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (pointerId.current !== event.pointerId || dragStartX.current === null) return;
    const nextDragX = event.clientX - dragStartX.current;
    dragXRef.current = nextDragX;
    setDragX(nextDragX);
  };

  const handlePointerEnd = (event) => {
    if (pointerId.current !== event.pointerId) return;
    const shouldDismiss = Math.abs(dragXRef.current) >= 96;
    dragStartX.current = null;
    dragXRef.current = 0;
    pointerId.current = null;
    setIsDragging(false);
    if (shouldDismiss) onClose();
    else setDragX(0);
  };

  return (
    <div
      className="fixed inset-x-4 top-4 z-[100] mx-auto max-w-md"
      role="alert"
      aria-live="assertive"
    >
      <div
        className={`flex touch-pan-y select-none gap-3 rounded-2xl border p-4 shadow-xl ${appearance.container}`}
        style={{
          transform: `translateX(${dragX}px)`,
          opacity: Math.max(0.45, 1 - Math.abs(dragX) / 360),
          transition: isDragging ? "none" : "transform 180ms ease-out, opacity 180ms ease-out",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <span
          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center ${variant === "error" ? "" : "rounded-full text-sm font-bold"} ${appearance.icon}`}
          aria-hidden="true"
        >
          {variant === "success" ? "✓" : <DisruptionIcon />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{title || appearance.title}</p>
          <p className={`mt-0.5 text-sm leading-5 ${appearance.message || ""}`}>{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-1 size-7 shrink-0 rounded-full text-lg leading-none opacity-70 hover:bg-black/5 hover:opacity-100"
          aria-label="Fermer la notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}
