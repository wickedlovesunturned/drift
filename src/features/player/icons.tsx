/** Thin line-art icons styled like Apple Music / SF Symbols. */

import type { ReactNode } from "react";

type IconProps = { size?: number; className?: string };

function Svg({
  size = 18,
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconShuffle({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M16 3h5v5" />
      <path d="M4 20L21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </Svg>
  );
}

export function IconPrev({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M5 5v14" />
      <path d="M19 5L9 12l10 7V5z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconNext({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M19 5v14" />
      <path d="M5 5l10 7-10 7V5z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconPlay({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconPause({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M7 5h3v14H7V5zm7 0h3v14h-3V5z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconRepeat({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 12a6 6 0 0 1 6-6h12" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 12a6 6 0 0 1-6 6H3" />
    </Svg>
  );
}

/** Repeat icon only — the small "1" badge is rendered by CSS on the button. */
export function IconRepeatOne({ size }: IconProps) {
  return <IconRepeat size={size} />;
}

export function IconSpeaker({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4 10v4h3l4 3.5V6.5L7 10H4z" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a3.5 3.5 0 0 1 0 7" />
      <path d="M17.8 6a6.5 6.5 0 0 1 0 12" />
    </Svg>
  );
}

export function IconSpeakerMute({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4 10v4h3l4 3.5V6.5L7 10H4z" fill="currentColor" stroke="none" />
      <path d="M15 9.5l5 5" />
      <path d="M20 9.5l-5 5" />
    </Svg>
  );
}

export function IconQueue({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3.5 6h.01" strokeWidth="2.4" />
      <path d="M3.5 12h.01" strokeWidth="2.4" />
      <path d="M3.5 18h.01" strokeWidth="2.4" />
    </Svg>
  );
}

export function IconLyrics({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M6 6h12" />
      <path d="M6 10h8" />
      <path d="M6 14h10" />
      <path d="M6 18h6" />
      <path d="M17 14v6" />
      <path d="M14 17h6" />
    </Svg>
  );
}

export function IconStar({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16l-4.8 2.4.9-5.4L4.2 9.2l5.4-.8L12 3.5z" />
    </Svg>
  );
}

export function IconStarFilled({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16l-4.8 2.4.9-5.4L4.2 9.2l5.4-.8L12 3.5z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function IconMore({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconClose({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </Svg>
  );
}
