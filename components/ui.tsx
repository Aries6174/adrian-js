import type { CSSProperties, ReactNode } from "react";

export const stagger = (step: number) => ({ "--d": step }) as CSSProperties;

export function Eyebrow({ lines, step = 0 }: { lines: string[]; step?: number }) {
  return (
    <p className="label rise leading-[1.65] text-soft" style={stagger(step)}>
      {lines.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </p>
  );
}

export function PageTitle({
  children,
  accent,
  size = "3.3rem",
  step = 1,
}: {
  children: ReactNode;
  accent?: string;
  size?: string;
  step?: number;
}) {
  return (
    <h1 className="display rise mt-6 text-text" style={{ ...stagger(step), fontSize: size }}>
      {children}
      {accent && <span className="text-gold">{accent}</span>}
      <span className="caret text-gold">_</span>
    </h1>
  );
}

export function SectionLabel({ no, children }: { no: string; children: ReactNode }) {
  return (
    <p className="label flex gap-2 text-soft">
      <span className="text-muted">{`// ${no}`}</span>
      {children}
    </p>
  );
}

export function FootNote({ lines }: { lines: string[] }) {
  return (
    <div className="rise hidden lg:absolute lg:bottom-[2.2rem] lg:left-[calc(var(--gutter)+1.5rem)] lg:block" style={stagger(9)}>
      <p className="label leading-[1.7] text-soft">
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
      <span className="rule mt-2" />
    </div>
  );
}

export function Arrow({ className = "w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 10" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden className={className}>
      <path d="M0 5h23M18.5.8 23 5l-4.5 4.2" />
    </svg>
  );
}

export function External({ className = "size-2.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden className={className}>
      <path d="M2 8 8.5 1.5M3 1.5h5.5V7" />
    </svg>
  );
}

const paths: Record<string, ReactNode> = {
  react: (
    <>
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
    </>
  ),
  next: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9 16.5v-9l7.5 10.4M15.5 7.5v6" />
    </>
  ),
  tailwind: (
    <path d="M3 10.5c1.5-4 4-5.5 6.8-4.2 1.7.8 2.4 2.9 4.4 3.3 2 .4 3.9-.7 5.8-3.1-1.5 4-4 5.5-6.8 4.2-1.7-.8-2.4-2.9-4.4-3.3-2-.4-3.9.7-5.8 3.1Zm0 7c1.5-4 4-5.5 6.8-4.2 1.7.8 2.4 2.9 4.4 3.3 2 .4 3.9-.7 5.8-3.1-1.5 4-4 5.5-6.8 4.2-1.7-.8-2.4-2.9-4.4-3.3-2-.4-3.9.7-5.8 3.1Z" />
  ),
  java: (
    <>
      <path d="M5.5 14.5h10.8v3.3a3 3 0 0 1-3 3H8.5a3 3 0 0 1-3-3v-3.3Z" />
      <path d="M16.3 15.5h1.5a2 2 0 0 1 0 4h-1.7M4 22.5h13" />
      <path d="M10 3c1.8 2-1.4 3.2.3 5.3.8 1 .9 2.1.2 3.2M13.6 7.2c1 1.4-.8 2-.1 3.4" />
    </>
  ),
  python: (
    <>
      <path d="M12 2.5c-3.6 0-4.6 1.3-4.6 3v2.1H12v1H5.8c-2 0-3.3 1.4-3.3 3.8s1.3 3.9 3.1 3.9h1.9v-2.5c0-1.7 1.4-3.1 3.2-3.1h4.5c1.4 0 2.5-1.1 2.5-2.5V5.5c0-1.7-2-3-5.7-3Z" />
      <path d="M12 21.5c3.6 0 4.6-1.3 4.6-3v-2.1H12v-1h6.2c2 0 3.3-1.4 3.3-3.8s-1.3-3.9-3.1-3.9h-1.9v2.5c0 1.7-1.4 3.1-3.2 3.1H8.800c-1.4 0-2.5 1.1-2.5 2.5v2.700c0 1.7 2 3 5.7 3Z" />
    </>
  ),
  postgres: (
    <>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.500v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  gamepad: (
    <>
      <path d="M7.5 7h9a5.5 5.5 0 0 1 5.3 4.100l.9 3.800a3 3 0 0 1-5.2 2.700L15.7 15.500H8.300l-1.8 2.100a3 3 0 0 1-5.2-2.700l.9-3.800A5.5 5.5 0 0 1 7.5 7Z" />
      <path d="M7.5 9.500v3.500M5.7 11.200h3.6" />
      <circle cx="15.5" cy="12.5" r=".6" fill="currentColor" />
      <circle cx="17.8" cy="10.3" r=".6" fill="currentColor" />
    </>
  ),
  palette: (
    <>
      <path d="M12 2.500a9.5 9.5 0 0 0 0 19c1.4 0 2-.9 2-1.8 0-1.3-1.1-1.7-1.1-2.8 0-1 .8-1.7 1.9-1.700h2.400c2.6 0 4.3-1.8 4.3-4.2 0-4.8-4.2-8.5-9.5-8.500Z" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" />
      <circle cx="10" cy="7" r="1" fill="currentColor" />
      <circle cx="15" cy="7" r="1" fill="currentColor" />
      <circle cx="18" cy="11" r="1" fill="currentColor" />
    </>
  ),
  code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  book: <path d="M12 6.500C10 4.8 7 4.2 3 4.500v14c4-.3 7 .3 9 2 2-1.7 5-2.3 9-2v-14c-4-.3-7 .3-9 2Zm0 0v14" />,
  world: <path d="M12 2.5 22 21H2L12 2.500Zm0 0v8m0 0-5.5 10.500m5.5-10.500L17.5 21M7 12.500l5-2 5 2" />,
  mail: <path d="M2.5 5.500h19v13h-19v-13Zm0 0L12 13l9.5-7.5" />,
  resume: <path d="M6 2.500h8l5 5v14H6v-19Zm8 0v5h5M9 12h7M9 15.500h7M9 19h4" />,
  x: <path d="m3 3 18 18M21 3 3 21M3 3h4.500L21 21h-4.500L3 3Z" />,
  discord: (
    <>
      <path d="M8 5.500c-1.7.3-3 .8-4.3 1.600C1.7 10.5 1 14 1.3 17.600c1.6 1.1 3.2 1.8 4.7 2.200l1.1-2c1.8.6 3.3.8 4.9.8s3.1-.2 4.9-.8l1.1 2c1.5-.4 3.1-1.1 4.7-2.2.3-3.6-.4-7.1-2.4-10.5-1.3-.8-2.6-1.3-4.3-1.600l-.7 1.300c-2.2-.4-4.4-.4-6.6 0L8 5.500Z" />
      <circle cx="8.5" cy="13" r="1.6" />
      <circle cx="15.5" cy="13" r="1.6" />
    </>
  ),
};

export function Icon({ name, className = "size-6" }: { name: string; className?: string }) {
  if (name === "typescript") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M3 3h18v18H3z" />
        <text x="12" y="17" textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor" stroke="none">
          TS
        </text>
      </svg>
    );
  }
  if (name === "github") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
      </svg>
    );
  }
  if (name === "linkedin") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
        <path d="M20.4 2H3.600C2.7 2 2 2.7 2 3.600v16.800c0 .9.7 1.6 1.6 1.600h16.800c.9 0 1.6-.7 1.6-1.600V3.600c0-.9-.7-1.6-1.6-1.600ZM8 19H5V9.500h3V19ZM6.5 8.200a1.7 1.7 0 1 1 0-3.5 1.7 1.7 0 0 1 0 3.500ZM19 19h-3v-4.600c0-1.2-.4-2-1.5-2-.8 0-1.3.6-1.5 1.1-.1.2-.1.5-.1.800V19h-3V9.500h3v1.300c.4-.6 1.1-1.5 2.7-1.5 2 0 3.4 1.3 3.4 4.100V19Z" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {paths[name]}
    </svg>
  );
}
