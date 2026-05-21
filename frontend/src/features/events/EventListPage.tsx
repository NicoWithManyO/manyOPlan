import { CalendarDays, Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EventPoster } from "../../components/EventPoster";
import { OrgLogo } from "../../components/OrgLogo";
import { Button } from "../../components/ui/Button";
import { useEventStore } from "../../stores/eventStore";
import { useOrgStore } from "../../stores/orgStore";
import type { Event } from "../../types/models";
import { cn } from "../../utils/cn";
import { PromotedOrgInvitations } from "../organizations/PromotedOrgInvitations";
import { EventPosterModal } from "./EventPosterModal";
import { MyEngagements } from "./MyEngagements";

const eventTypeLabels: Record<string, string> = {
  festival: "Festival",
  conference: "Conférence",
  sport: "Sport",
  charity: "Caritatif",
  other: "Autre",
};

const eventTypeColors: Record<string, string> = {
  festival: "bg-purple-100 text-purple-700",
  conference: "bg-blue-100 text-blue-700",
  sport: "bg-green-100 text-green-700",
  charity: "bg-amber-100 text-amber-700",
  other: "bg-gray-100 text-gray-700",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function EventCard({ event }: { event: Event }) {
  const [posterOpen, setPosterOpen] = useState(false);
  return (
    <>
      <Link
        to={`/events/${event.id}`}
        className="flex gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 transition hover:shadow-md active:scale-[0.99]"
      >
        <EventPoster
          src={event.poster}
          alt={`Affiche de ${event.name}`}
          className="aspect-[2/3] w-20 rounded-md ring-1 ring-gray-200 sm:w-24"
          onClick={() => setPosterOpen(true)}
        />
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <OrgLogo src={event.organization_logo} className="h-8 w-8" />
              <h3 className="min-w-0 text-lg font-semibold leading-tight text-gray-900">
                {event.name}
              </h3>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                eventTypeColors[event.event_type] ?? eventTypeColors.other,
              )}
            >
              {eventTypeLabels[event.event_type] ?? "Autre"}
            </span>
          </div>

          {event.description && (
            <p className="mb-3 text-sm text-gray-600 line-clamp-2">
              {event.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(event.start_date)} — {formatDate(event.end_date)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {event.member_count} membre{event.member_count > 1 ? "s" : ""}
            </span>
          </div>

          {event.my_role && (
            <div className="mt-3">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  event.my_role === "admin"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-emerald-100 text-emerald-700",
                )}
              >
                {event.my_role === "admin" ? "Admin" : "Bénévole"}
              </span>
            </div>
          )}
        </div>
      </Link>
      {posterOpen && event.poster && (
        <EventPosterModal
          src={event.poster}
          alt={`Affiche de ${event.name}`}
          onClose={() => setPosterOpen(false)}
        />
      )}
    </>
  );
}

export function EventListPage() {
  const { events, isLoading, fetchEvents } = useEventStore();
  const currentOrg = useOrgStore((s) => s.currentOrg);

  useEffect(() => {
    if (currentOrg) {
      fetchEvents(currentOrg.id);
    }
  }, [fetchEvents, currentOrg]);

  const canCreate = currentOrg?.my_role === "admin";

  return (
    <div>
      <MyEngagements />

      {currentOrg && (
        <PromotedOrgInvitations
          orgId={currentOrg.id}
          organizationLogo={currentOrg.logo}
        />
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Événements</h2>
          {currentOrg && (
            <p className="text-sm text-gray-500">{currentOrg.name}</p>
          )}
        </div>
        {canCreate && (
          <Link to="/events/new">
            <Button size="md">
              <Plus className="mr-1.5 h-4 w-4" />
              Créer
            </Button>
          </Link>
        )}
      </div>

      {isLoading && events.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl bg-gray-200"
            />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center ring-1 ring-gray-200">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p className="text-gray-600">Aucun événement pour le moment.</p>
          {canCreate && (
            <Link to="/events/new" className="mt-3 inline-block">
              <Button variant="secondary" size="sm">
                Créer un événement
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
