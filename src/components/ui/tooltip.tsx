import * as React from "react";

/**
 * A CSS-only tooltip: adds `data-tip` to its single child (styled in globals.css).
 * Use it only on controls that already have an `aria-label`, so the tip never
 * becomes part of an accessible name and never carries information of its own.
 */
export function Tooltip({ content, children }: { content: string; children: React.ReactElement<{ "data-tip"?: string }> }) {
  return React.cloneElement(children, { "data-tip": content });
}
