/* AUTO-COPIED from the design system. DO NOT EDIT HERE.
   Source: design/src/cn.ts
   Change it there, then run: npm run sync -- <app>
   Check every app for drift with: npm run check:drift */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Join class names, with later Tailwind utilities beating earlier ones.
 *
 * tailwind-merge is what makes `<Button className="rounded-none" />` actually
 * win over the component's own `rounded-pill`. A naive join would emit both
 * and let source order in the stylesheet decide, which is why overrides on a
 * component kit silently fail without it.
 *
 * Seven of the nine apps already have clsx + tailwind-merge. The other two
 * need `npm i clsx tailwind-merge` once; both are tiny.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
