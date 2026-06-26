"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { addWeeks, subWeeks, format, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AgendaWeekNav({ currentDate }: { currentDate: string }) {
  const router = useRouter();
  const date = new Date(currentDate);
  const weekStart = startOfWeek(date, { weekStartsOn: 0 });

  function navigate(weeks: number) {
    const newDate = weeks > 0 ? addWeeks(date, weeks) : subWeeks(date, Math.abs(weeks));
    router.push(`/agenda?date=${format(newDate, "yyyy-MM-dd")}`);
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium text-white capitalize">
        {format(weekStart, "MMMM yyyy")}
      </span>
      <div className="flex gap-2">
        <Link href="/agenda">
          <Button variant="secondary" size="sm">
            Hoje
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={() => navigate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
