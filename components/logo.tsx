import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Wordmark.
 *
 * The mark is a raster asset extracted from the brand sheet, not a hand-traced
 * SVG. It is two interlocking chevrons whose overlap produces specific negative
 * shapes; approximating that by eye would produce something V-shaped but not
 * *this* mark, and a subtly wrong logo is worse than a heavier one. Replace
 * `public/mark.png` with the vector source when it is available and this can
 * become an inline SVG that inherits `currentColor`.
 *
 * Two files rather than a CSS filter: the mark is black, so dark mode needs the
 * white variant. `filter: invert()` would also invert any future colour in the
 * mark, and is a lie the moment the brand stops being monochrome.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative size-[18px] shrink-0">
        <Image
          src="/mark.png"
          alt=""
          width={18}
          height={18}
          priority
          className="size-[18px] object-contain dark:hidden"
        />
        <Image
          src="/mark-light.png"
          alt=""
          width={18}
          height={18}
          priority
          className="absolute inset-0 hidden size-[18px] object-contain dark:block"
        />
      </span>
      <span className="text-sm font-semibold tracking-tight text-fg">Vantage</span>
    </span>
  );
}
