/**
 * The play view is always landscape (T2). Browsers cannot lock orientation
 * outside an installed PWA, so when the window is portrait the canvas is
 * rotated 90 degrees clockwise by CSS and client coordinates are mapped back.
 */
export interface LandscapeViewport {
  /** Landscape width and height in CSS px. */
  readonly width: number;
  readonly height: number;
  readonly rotated: boolean;
}

export function landscapeViewport(innerWidth: number, innerHeight: number): LandscapeViewport {
  const rotated = innerHeight > innerWidth;
  return rotated
    ? { width: innerHeight, height: innerWidth, rotated }
    : { width: innerWidth, height: innerHeight, rotated };
}

/** Client (window) coordinates to normalised device coordinates of the landscape view. */
export function clientToNdc(
  viewport: LandscapeViewport,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  // Rotated canvas: translateX(innerWidth) rotate(90deg) about its top-left corner.
  const u = viewport.rotated ? clientY : clientX;
  const v = viewport.rotated ? viewport.height - clientX : clientY;
  return { x: (2 * u) / viewport.width - 1, y: 1 - (2 * v) / viewport.height };
}
