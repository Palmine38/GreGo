// components/TrajetTabBar.jsx
import React, { useState, useRef } from "react";

export function TrajetTabBar({
  trajetKeys,
  trajets,
  currentTrajet,
  isConfigured,
  onSelect,
  onAdd,
  onDelete,
  onReorder,
}) {
  const MAX = 5;
  const [editMode, setEditMode] = useState(false);
  const [dragOver, setDragOver] = useState(null);
  const dragItem = useRef(null);

  const handleDragStart = (e, key) => {
    dragItem.current = key;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, key) => {
    e.preventDefault();
    setDragOver(key);
  };

  const handleDrop = (e, targetKey) => {
    e.preventDefault();
    const from = dragItem.current;
    if (!from || from === targetKey) return;
    const newKeys = [...trajetKeys];
    const fromIdx = newKeys.indexOf(from);
    const toIdx = newKeys.indexOf(targetKey);
    newKeys.splice(fromIdx, 1);
    newKeys.splice(toIdx, 0, from);
    onReorder?.(newKeys);
    setDragOver(null);
    dragItem.current = null;
  };

  const handleDragEnd = () => {
    setDragOver(null);
    dragItem.current = null;
  };

  return (
    <>
      {editMode && (
        <div
          className="fixed inset-0 z-30 pointer-events-none"
          style={{ background: "rgba(0,0,0,0.35)" }}
        />
      )}

      <div className="relative z-40 bg-white border-b border-gray-200 p-4">
        <div className="flex gap-3 items-center">
          {/* Onglets — scrollable si besoin */}
          <div className="flex gap-3 items-center flex-1 overflow-x-auto">
            {trajetKeys.map((t) => {
              const trajetName = trajets[t]?.name || t;
              const isTruncated = trajetName.length > 8;
              const isActive = currentTrajet === t;
              const configured = isConfigured(t);
              const isTarget = dragOver === t;

              return (
                <button
                  key={t}
                  draggable={editMode}
                  onDragStart={(e) => editMode && handleDragStart(e, t)}
                  onDragOver={(e) => editMode && handleDragOver(e, t)}
                  onDrop={(e) => editMode && handleDrop(e, t)}
                  onDragEnd={handleDragEnd}
                  onClick={() => !editMode && onSelect(t)}
                  title={trajetName}
                  className={`w-24 py-2 px-3 font-semibold transition-all text-center rounded-lg overflow-hidden flex-shrink-0 select-none
                    ${editMode ? "cursor-grab active:cursor-grabbing" : ""}
                    ${isTarget ? "ring-2 ring-blue-300 scale-105" : ""}
                    ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : configured
                          ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  {isTruncated ? (
                    <div
                      style={{
                        position: "relative",
                        overflow: "hidden",
                        width: "100%",
                        height: "1.2em",
                      }}
                    >
                      <style>{`
                        @keyframes marqueeSlide { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
                        .marquee-track { display: inline-block; white-space: nowrap; animation: marqueeSlide 11s linear infinite; padding-right: 2rem; }
                        .marquee-track-delayed { display: inline-block; white-space: nowrap; animation: marqueeSlide 11s linear infinite; animation-delay: -5.5s; position: absolute; top: 0; left: 0; padding-right: 1.5rem; }
                      `}</style>
                      <span className="marquee-track">{trajetName}</span>
                      <span className="marquee-track-delayed">
                        {trajetName}
                      </span>
                    </div>
                  ) : (
                    <span>{trajetName}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Boutons fixes à droite */}
          <div className="flex gap-2 flex-shrink-0">
            {/* Bouton + (caché en mode édition) */}
            {!editMode && trajetKeys.length < MAX && (
              <button
                onClick={onAdd}
                title="Ajouter un trajet"
                className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700 flex items-center justify-center transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="size-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
              </button>
            )}

            {/* Bouton éditer / terminer */}
            <button
              onClick={() => setEditMode((v) => !v)}
              title={editMode ? "Terminer" : "Modifier"}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors
                ${
                  editMode
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700"
                }`}
            >
              {editMode ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="size-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="size-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Zone poubelle en mode édition */}
        {editMode && trajetKeys.length > 1 && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver("__trash__");
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              const key = dragItem.current;
              if (key) onDelete(key);
              setDragOver(null);
              dragItem.current = null;
            }}
            className={`mt-3 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed transition-all
              ${
                dragOver === "__trash__"
                  ? "border-red-400 bg-red-50 scale-105"
                  : "border-gray-300 bg-white"
              }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className={`size-5 transition-colors ${dragOver === "__trash__" ? "text-red-500" : "text-gray-400"}`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
              />
            </svg>
            <span
              className={`text-sm font-semibold transition-colors ${dragOver === "__trash__" ? "text-red-500" : "text-gray-400"}`}
            >
              Déposer ici pour supprimer
            </span>
          </div>
        )}
      </div>
    </>
  );
}
