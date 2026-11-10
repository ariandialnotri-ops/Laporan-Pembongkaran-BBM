import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { AMBANG } from "./use-pull-segarkan";

/** Indikator bulat di bawah header; berputar mengikuti tarikan, lalu berputar terus saat menyegarkan. */
export function IndikatorSegarkan({
  tarik,
  sibuk,
  tertutup,
}: {
  tarik: number;
  sibuk: boolean;
  tertutup: boolean;
}) {
  const siap = tarik >= AMBANG;
  const tampil = tarik > 0 || sibuk;
  return (
    <>
      {/* Lajur selebar area konten (mengikuti sidebar di layar lebar) agar bulatan tepat di tengah konten. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top,0px))] z-30 flex justify-center print:hidden",
          !tertutup && "lg:left-72",
        )}
      >
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-full bg-surface shadow-lg ring-1 ring-outline-variant",
            tarik === 0 &&
              "transition-[transform,opacity] duration-200 motion-reduce:transition-none",
          )}
          style={{
            transform: `translateY(${tampil ? Math.max(tarik, sibuk ? AMBANG : 0) - 24 : -24}px)`,
            opacity: tampil ? Math.min(1, tarik / AMBANG + (sibuk ? 1 : 0)) : 0,
          }}
        >
          <RefreshCw
            className={cn(
              "size-5",
              siap || sibuk ? "text-primary" : "text-on-surface-variant",
              sibuk && "animate-spin motion-reduce:animate-none",
            )}
            style={
              sibuk
                ? undefined
                : { transform: `rotate(${(tarik / AMBANG) * 270}deg)` }
            }
          />
        </div>
      </div>
      <span role="status" className="sr-only">
        {sibuk ? "Menyegarkan data…" : ""}
      </span>
    </>
  );
}
