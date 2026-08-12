/** Title bar icons: history navigation plus Windows-style window controls. */

import type { ReactNode } from "react";

type IconProps = { size?: number; className?: string };

function Svg({ size = 16, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconChevronLeft({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M14.5 5l-7 7 7 7" />
    </Svg>
  );
}

export function IconChevronRight({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M9.5 5l7 7-7 7" />
    </Svg>
  );
}

/* Window controls use a 10x10 box at 1px so they match native Segoe MDL2 weight. */
function WinSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconWinMinimize() {
  return (
    <WinSvg>
      <path d="M0 5.5h10" />
    </WinSvg>
  );
}

export function IconWinMaximize() {
  return (
    <WinSvg>
      <rect x="0.5" y="0.5" width="9" height="9" />
    </WinSvg>
  );
}

export function IconWinRestore() {
  return (
    <WinSvg>
      <rect x="0.5" y="2.5" width="7" height="7" />
      <path d="M2.5 2.5v-2h7v7h-2" />
    </WinSvg>
  );
}

export function IconWinClose() {
  return (
    <WinSvg>
      <path d="M0.5 0.5l9 9" />
      <path d="M9.5 0.5l-9 9" />
    </WinSvg>
  );
}
