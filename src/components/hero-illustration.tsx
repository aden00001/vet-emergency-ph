export function HeroIllustration() {
  return (
    <div
      className="relative mx-auto w-full max-w-[280px] sm:max-w-none"
      aria-hidden
    >
      <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-primary/20 via-chart-2/10 to-transparent blur-2xl" />
      <svg
        viewBox="0 0 360 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative w-full drop-shadow-soft"
      >
        <rect
          x="40"
          y="48"
          width="280"
          height="184"
          rx="24"
          className="fill-card stroke-border"
          strokeWidth="1.5"
        />
        <rect
          x="56"
          y="64"
          width="248"
          height="152"
          rx="16"
          className="fill-muted/60"
        />

        {/* Map grid lines */}
        <path
          d="M80 96h200M80 128h200M80 160h200M120 64v152M200 64v152M280 64v152"
          className="stroke-border/80"
          strokeWidth="1"
          strokeDasharray="4 6"
        />

        {/* Route path */}
        <path
          d="M96 176 C130 140, 170 148, 200 120 S260 100, 288 88"
          className="stroke-primary"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="6 4"
          opacity="0.7"
        />

        {/* User location pin */}
        <circle cx="96" cy="176" r="10" className="fill-primary/20" />
        <circle cx="96" cy="176" r="5" className="fill-primary" />

        {/* Clinic pin */}
        <g transform="translate(272, 72)">
          <path
            d="M16 0C24.837 0 32 7.163 32 16c0 12-16 28-16 28S0 28 0 16C0 7.163 7.163 0 16 0z"
            className="fill-primary"
          />
          <circle cx="16" cy="16" r="6" className="fill-primary-foreground" />
          <path
            d="M13 16h6M16 13v6"
            className="stroke-primary"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>

        {/* Pet silhouette — dog */}
        <g transform="translate(118, 168)">
          <ellipse cx="32" cy="28" rx="28" ry="22" className="fill-card stroke-primary/40" strokeWidth="1.5" />
          <circle cx="18" cy="18" r="3" className="fill-foreground/70" />
          <circle cx="46" cy="18" r="3" className="fill-foreground/70" />
          <ellipse cx="32" cy="30" rx="5" ry="3" className="fill-foreground/50" />
          <path
            d="M8 14c-6-2-10 2-8 8 2 4 8 2 10-2M56 14c6-2 10 2 8 8-2 4-8 2-10-2"
            className="stroke-primary/50"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* Floating status card */}
        <g transform="translate(200, 148)">
          <rect
            width="120"
            height="44"
            rx="12"
            className="fill-card stroke-border shadow-soft"
            strokeWidth="1"
          />
          <circle cx="20" cy="22" r="6" className="fill-primary" />
          <rect x="34" y="14" width="56" height="6" rx="3" className="fill-muted-foreground/30" />
          <rect x="34" y="26" width="40" height="5" rx="2.5" className="fill-primary/40" />
        </g>

        {/* Pulse ring */}
        <circle
          cx="288"
          cy="88"
          r="22"
          className="stroke-primary/30"
          strokeWidth="2"
          fill="none"
        >
          <animate
            attributeName="r"
            values="18;28;18"
            dur="2.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.6;0;0.6"
            dur="2.5s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Decorative dots */}
        <circle cx="52" cy="40" r="4" className="fill-chart-2/50" />
        <circle cx="320" cy="220" r="6" className="fill-primary/30" />
        <circle cx="48" cy="220" r="3" className="fill-chart-3/40" />
      </svg>
    </div>
  );
}
