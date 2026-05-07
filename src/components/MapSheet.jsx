import React, { useRef, useState } from "react";

export function MapSheet({
  isOpen,
  onClose,
  title,
  children,
  initialHeight = 40,
}) {
  const [height, setHeight] = useState(initialHeight);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(null);
  const dragStartHeight = useRef(null);

  const handleClose = () => {
    setHeight(initialHeight);
    onClose();
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-[10000] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={handleClose}
      />

      {/* Logo en bas à gauche */}
      <img
        src="/bygrelines.png"
        alt="Bygrelines"
        className="fixed bottom-8 left-1 z-[9999] pointer-events-none opacity-60"
        style={{ height: "55px", width: "auto" }}
      />

      <div
        className={`${isOpen ? "translate-y-0" : "translate-y-full"} fixed inset-x-0 bottom-0 z-[10001] rounded-t-3xl border border-slate-200 bg-white shadow-2xl flex flex-col`}
        style={{
          height: `${height}vh`,
          transition: isDragging
            ? "transform 0.3s"
            : "height 0.35s cubic-bezier(0.32, 0.72, 0, 1), transform 0.3s",
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-4 pb-2 flex-shrink-0">
          <span className="font-bold text-lg">{title}</span>
          <button
            className="text-slate-400 hover:text-slate-700"
            onClick={handleClose}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m19.5 8.25-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>
        </div>

        {/* Contenu */}
        <div className="overflow-y-auto flex-1 px-4 pb-10">{children}</div>
      </div>
    </>
  );
}
