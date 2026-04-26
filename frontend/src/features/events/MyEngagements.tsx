import { CalendarCheck, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyEngagements } from "../../api/assignments";
import type { MyEngagement } from "../../types/models";
import { cn } from "../../utils/cn";

const INITIAL_VISIBLE = 5;

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeFmt = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) {
    return `${dateFmt.format(s)} · ${timeFmt.format(s)} – ${timeFmt.format(e)}`;
  }
  return `${dateFmt.format(s)} ${timeFmt.format(s)} → ${dateFmt.format(e)} ${timeFmt.format(e)}`;
}

function EngagementCard({ engagement }: { engagement: MyEngagement }) {
  const isBackup = engagement.status === "backup";
  return (
    <Link
      to={`/events/${engagement.event_id}`}
      className="block rounded-lg border border-gray-200 bg-white p-3 transition hover:border-indigo-300 hover:shadow-sm"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-gray-900">
          {engagement.event_name}
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
      </div>
      <div className="mb-1 text-sm text-gray-700">{engagement.task_name}</div>
      <div className="text-xs text-gray-500">
        {formatRange(engagement.start_date, engagement.end_date)}
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-wide text-gray-400">
        {engagement.organization_name}
      </div>
    </Link>
  );
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

  if (!items || items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, INITIAL_VISIBLE);
  const hasMore = items.length > INITIAL_VISIBLE;

  return (
    <section className="mb-6 rounded-xl bg-white p-4 ring-1 ring-gray-200">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <CalendarCheck className="h-4 w-4 text-indigo-600" />
        Mes prochains créneaux
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600">
          {items.length}
        </span>
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {visible.map((eng) => (
          <EngagementCard key={eng.id} engagement={eng} />
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
              Voir les {items.length - INITIAL_VISIBLE} autres
            </>
          )}
        </button>
      )}
    </section>
  );
}
