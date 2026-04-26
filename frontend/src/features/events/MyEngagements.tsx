import { CalendarCheck, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getMyEngagements } from "../../api/assignments";
import type { MyEngagement } from "../../types/models";
import { cn } from "../../utils/cn";

const INITIAL_VISIBLE = 6;

const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});
const dayHeaderFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(d: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dayKey(d) === dayKey(today)) return "Aujourd'hui";
  if (dayKey(d) === dayKey(tomorrow)) return "Demain";
  // Capitalize first letter (Intl gives lowercase weekday in fr)
  const raw = dayHeaderFmt.format(d);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function timeRange(start: Date, end: Date) {
  const sameDay = dayKey(start) === dayKey(end);
  if (sameDay) {
    return `${timeFmt.format(start)} – ${timeFmt.format(end)}`;
  }
  // Multi-day slot: show end with short date hint
  const endShort = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(end);
  return `${timeFmt.format(start)} → ${endShort}`;
}

function EngagementRow({ engagement }: { engagement: MyEngagement }) {
  const isBackup = engagement.status === "backup";
  const start = new Date(engagement.start_date);
  const end = new Date(engagement.end_date);
  return (
    <Link
      to={`/events/${engagement.event_id}`}
      className="group flex items-center gap-3 rounded-md px-2 py-2 transition hover:bg-gray-50"
    >
      <span className="w-28 shrink-0 font-mono text-xs tabular-nums text-gray-600">
        {timeRange(start, end)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
        <span className="font-medium">{engagement.task_name}</span>
        <span className="text-gray-400"> · </span>
        <span className="text-gray-600">{engagement.event_name}</span>
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
          isBackup
            ? "bg-amber-100 text-amber-700"
            : "bg-emerald-100 text-emerald-700",
        )}
      >
        {isBackup ? "Secours" : "Confirmé"}
      </span>
    </Link>
  );
}

function groupByDay(items: MyEngagement[]) {
  const groups = new Map<string, { date: Date; items: MyEngagement[] }>();
  for (const it of items) {
    const d = new Date(it.start_date);
    const key = dayKey(d);
    const group = groups.get(key);
    if (group) {
      group.items.push(it);
    } else {
      groups.set(key, { date: d, items: [it] });
    }
  }
  return Array.from(groups.values());
}

export function MyEngagements() {
  const [items, setItems] = useState<MyEngagement[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyEngagements()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleGroups = useMemo(() => {
    if (!items) return [];
    const slice = expanded ? items : items.slice(0, INITIAL_VISIBLE);
    return groupByDay(slice);
  }, [items, expanded]);

  if (!items || items.length === 0) return null;

  const hasMore = items.length > INITIAL_VISIBLE;
  const hiddenCount = items.length - INITIAL_VISIBLE;

  return (
    <section className="mb-6 rounded-xl bg-white p-4 ring-1 ring-gray-200">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <CalendarCheck className="h-4 w-4 text-indigo-600" />
        Mes prochains créneaux
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600">
          {items.length}
        </span>
      </h3>

      <div className="space-y-3">
        {visibleGroups.map((group) => (
          <div key={dayKey(group.date)}>
            <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {dayLabel(group.date)}
            </div>
            <div className="divide-y divide-gray-100">
              {group.items.map((eng) => (
                <EngagementRow key={eng.id} engagement={eng} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Réduire
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Voir les {hiddenCount} autres
            </>
          )}
        </button>
      )}
    </section>
  );
}
