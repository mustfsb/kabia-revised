"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Üç konumlu tema düğmesi (aydınlık → karanlık → sistem). Sabit yer tutucu
 * sayesinde sunucu çıktısıyla ilk istemci renderi uyuşur; gerçek yüzey o
 * sırada zaten boyama-öncesi betikle doğrudur. Sistem konumundayken küçük
 * nokta görünür — tek bakışta otomatikte olduğu anlaşılır.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { choice, resolved, toggle } = useTheme();
  const hydrated = useHydrated();
  const isDark = hydrated && resolved === "dark";
  const isSystem = hydrated && choice === "system";

  const currentLabel = !hydrated
    ? "Tema"
    : choice === "system"
      ? `Sistem (${isDark ? "karanlık" : "aydınlık"})`
      : isDark
        ? "Karanlık"
        : "Aydınlık";
  const nextLabel = !hydrated
    ? "Temayı değiştir"
    : choice === "light"
      ? "Karanlık temaya geç"
      : choice === "dark"
        ? "Sistem temasına geç"
        : isDark
          ? "Aydınlık temaya geç"
          : "Karanlık temaya geç";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={nextLabel}
      title={`${currentLabel} tema`}
      className={`flex h-11 w-11 items-center justify-center text-ink/70 transition-colors duration-300 hover:text-ink ${className}`}
    >
      <span className="relative inline-flex">
        {isDark ? (
          <Sun className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Moon className="h-5 w-5" aria-hidden="true" />
        )}
        {isSystem && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-brand"
          />
        )}
      </span>
    </button>
  );
}
