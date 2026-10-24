// Icônes de navigation partagées par la barre mobile et la barre latérale desktop.

export function TripsIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="6" cy="19" r="2.25" />
      <circle cx="18" cy="5" r="2.25" />
      <path d="M8.25 19h9.25a3.25 3.25 0 0 0 0-6.5h-11a3.25 3.25 0 0 1 0-6.5h9.25" />
    </svg>
  );
}

export function SearchIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="10.75" cy="10.75" r="6.25" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function SettingsIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077 1.41-.513m14.095-5.13 1.41-.513M5.106 17.785l1.15-.964m11.49-9.642 1.149-.964M7.501 19.795l.75-1.3m7.5-12.99.75-1.3m-6.063 16.658.26-1.477m2.605-14.772.26-1.477m0 17.726-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205 12 12m6.894 5.785-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495" />
    </svg>
  );
}

export function InfotraficIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 122.88 122.54"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M7.68,107.18h16.25l6.72-23.29H92.3l6.65,23.29h16.25c4.22,0,7.68,3.46,7.68,7.68v0c0,4.22-3.46,7.68-7.68,7.68H7.68c-4.22,0-7.68-3.46-7.68-7.68v0C0,110.64,3.46,107.18,7.68,107.18L7.68,107.18z M35.05,68.64l6.74-23.36h39.49l6.67,23.36H35.05L35.05,68.64z M46.04,30.55l7.45-25.81c2.5-6.31,13.92-6.33,16.23,0.05l7.35,25.76H46.04L46.04,30.55z"
      />
    </svg>
  );
}
