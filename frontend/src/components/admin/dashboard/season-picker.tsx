"use client";

import { Calendar } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The shell (`.season-picker`) draws the one visible box; the trigger inside
 * is invisible so the whole control opens the list, not just the value text.
 */
export function SeasonPicker({ season, seasons }: { season: number | null; seasons: number[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function select(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("season", next);
    router.push(`/admin/dashboard?${params.toString()}`);
  }

  return (
    <div className="season-picker">
      <Select value={season === null ? "" : String(season)} onValueChange={select} disabled={!seasons.length}>
        <SelectTrigger
          aria-label="Placement season"
          className="h-auto w-auto gap-2 rounded-none border-0 bg-transparent p-0 text-[14px] font-semibold text-[var(--ink)] normal-case shadow-none hover:transform-none focus-visible:ring-0"
        >
          <Calendar className="size-4 text-[var(--ink)]" />
          <span className="text-[14px] font-semibold text-[var(--ink)]">Season</span>
          <SelectValue placeholder="No seasons yet" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          sideOffset={6}
          className="w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)]"
        >
          {seasons.map((value) => (
            <SelectItem key={value} value={String(value)}>
              {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
