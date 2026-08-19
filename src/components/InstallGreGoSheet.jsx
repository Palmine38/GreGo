import { useState } from "react";
import { Sheet } from "react-modal-sheet";
import { GrPowerReset } from "react-icons/gr";
import { useTheme } from "../hooks/useTheme.js";

// ⚠️ Adapte les chemins/textes ci-dessous à tes vrais fichiers dans
// public/iOS (noms + descriptions).
const IOS_STEPS = [
  {
    image: "/iOS/step-1.png",
    description:
      "Appuyez sur le bouton Partager en bas de votre écran sur GreGo.",
  },
  {
    image: "/iOS/step-2.png",
    description:
      "Défilez vers le bas, puis appuyez sur « Sur l'écran d'accueil ».",
  },
  {
    image: "/iOS/step-3.png",
    description:
      "Appuyez sur « Ajouter » en haut à droite pour confirmer l'ajout de GreGo.",
  },
];

// ⚠️ Adapte les chemins/textes ci-dessous à tes vrais fichiers dans
// public/Android (noms + descriptions).
const ANDROID_STEPS = [
  {
    image: "/Android/step-1.png",
    description:
      "Appuyez sur le menu 3 petits points en haut à droite de votre navigateur.",
  },
  {
    image: "/Android/step-2.png",
    description:
      "Appuyez sur « Installer l'application » (ou « Ajouter à l'écran d'accueil »).",
  },
  {
    image: "/Android/step-3.png",
    description: "Appuyez sur « Installer ».",
  },
  {
    image: "/Android/step-4.png",
    description: "Réappuyez sur « Installer ».",
  },
];

const NEXT_BUTTON_STYLE = {
  light: "bg-slate-900 text-white hover:bg-slate-800",
  dark: "bg-white text-slate-900 hover:bg-slate-200",
  gray: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
};

const BACK_BUTTON_STYLE = {
  light: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  dark: "bg-slate-800 text-white hover:bg-slate-700",
  gray: "bg-zinc-700 text-white hover:bg-zinc-600",
};

const DOT_STYLE = {
  light: { active: "bg-slate-900", inactive: "bg-slate-200" },
  dark: { active: "bg-white", inactive: "bg-slate-600" },
  gray: { active: "bg-zinc-100", inactive: "bg-zinc-600" },
};

function StepDots({ total, current, theme }) {
  const style = DOT_STYLE[theme] || DOT_STYLE.light;
  return (
    <div className="mt-3 flex items-center justify-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current ? `w-4 ${style.active}` : `w-1.5 ${style.inactive}`
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Sheet "Comment installer GreGo".
 *
 * Props :
 * - isOpen, onClose : contrôle standard du Sheet
 * - platform : "ios" | "android" (déterminé en amont, ex. via useInstallPrompt)
 */
export function InstallGreGoSheet({ isOpen, onClose, platform = "ios" }) {
  const theme = useTheme();
  const [stepIndex, setStepIndex] = useState(0);

  const steps =
    platform === "ios"
      ? IOS_STEPS
      : platform === "android"
        ? ANDROID_STEPS
        : [];
  const total = steps.length;
  const current = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;

  const handleClose = () => {
    setStepIndex(0);
    onClose();
  };

  const handleBack = () => {
    if (isFirst) return;
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleNext = () => {
    if (isLast) {
      handleClose();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, total - 1));
  };

  if (!total) return null;

  const nextStyle = NEXT_BUTTON_STYLE[theme] || NEXT_BUTTON_STYLE.light;
  const backStyle = BACK_BUTTON_STYLE[theme] || BACK_BUTTON_STYLE.light;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={handleClose}
      snapPoints={[0, 1]}
      initialSnap={1}
    >
      <Sheet.Container
        style={{ borderRadius: "24px 24px 0 0", overflow: "hidden" }}
      >
        <Sheet.Header />
        <Sheet.Content>
          <div className="relative flex h-full flex-col px-5 pb-8 pt-1">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Comment installer GreGo
            </h2>

            {/* ── Carousel image ── */}
            <div className="relative mt-5 w-full overflow-hidden rounded-2xl">
              <div
                className="flex transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${stepIndex * 100}%)` }}
              >
                {steps.map((step, i) => (
                  <div key={i} className="w-full flex-shrink-0">
                    <img
                      src={step.image}
                      alt={`Étape ${i + 1}`}
                      className="mx-auto max-h-[42vh] w-auto object-contain"
                    />
                  </div>
                ))}
              </div>
            </div>

            <StepDots total={total} current={stepIndex} theme={theme} />

            <p className="mt-4 text-left text-xs font-bold uppercase tracking-widest text-slate-400">
              Étape {stepIndex + 1} sur {total}
            </p>

            <p className="mt-2 text-sm text-slate-600">{current.description}</p>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={isFirst}
                aria-label="Étape précédente"
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl transition-colors ${backStyle} disabled:opacity-40 disabled:pointer-events-none`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-6"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                  />
                </svg>
              </button>

              <button
                type="button"
                onClick={handleNext}
                className={`flex-1 rounded-2xl py-3.5 text-sm font-semibold transition-colors ${nextStyle}`}
              >
                {isLast ? "Terminer" : "Étape suivante"}
              </button>
            </div>
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop style={{ pointerEvents: "none" }} />
    </Sheet>
  );
}
