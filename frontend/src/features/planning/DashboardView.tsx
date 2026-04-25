import {
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Clock,
  ShieldAlert,
  UserMinus,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDashboard, type DashboardData } from "../../api/dashboard";
import { cn } from "../../utils/cn";

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className={cn("rounded-lg p-2", color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function DashboardView({ eventId }: { eventId: number }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDashboard(eventId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const chartData = data.task_stats.map((t) => ({
    name: t.name.length > 12 ? t.name.slice(0, 12) + "…" : t.name,
    confirmed: t.total_confirmed,
    capacity: t.total_capacity ?? 0,
    fill:
      t.total_capacity && t.total_confirmed >= t.total_capacity
        ? "#f59e0b"
        : "#6366f1",
  }));

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label="Tâches"
          value={data.total_tasks}
          color="bg-indigo-100 text-indigo-600"
        />
        <StatCard
          icon={Clock}
          label="Créneaux"
          value={data.total_slots}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          icon={CheckCircle}
          label="Confirmés"
          value={data.total_confirmed}
          color="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          icon={ShieldAlert}
          label="En secours"
          value={data.total_backup}
          color="bg-amber-100 text-amber-600"
        />
      </div>

      {/* Fill rate chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="mb-3 text-sm font-semibold text-gray-900">
            Remplissage par tâche
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: number, name: string) => [
                  value,
                  name === "confirmed" ? "Inscrits" : "Capacité",
                ]}
              />
              <Bar dataKey="capacity" fill="#e5e7eb" radius={[4, 4, 0, 0]} name="capacity" />
              <Bar dataKey="confirmed" radius={[4, 4, 0, 0]} name="confirmed">
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Incomplete slots warning */}
      {data.task_stats.some((t) => t.incomplete_slots > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Créneaux incomplets
          </h4>
          <ul className="space-y-1">
            {data.task_stats
              .filter((t) => t.incomplete_slots > 0)
              .map((t) => (
                <li key={t.id} className="text-xs text-amber-700">
                  <span className="font-medium">{t.name}</span> — {t.incomplete_slots}{" "}
                  créneau{t.incomplete_slots > 1 ? "x" : ""} à compléter
                  ({t.total_confirmed}/{t.total_capacity ?? "∞"} inscrits)
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Free volunteers */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <UserMinus className="h-4 w-4 text-gray-400" />
          Bénévoles sans affectation
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {data.free_volunteer_count}
          </span>
        </h4>
        {data.free_volunteers.length === 0 ? (
          <p className="text-xs text-gray-500">
            Tous les bénévoles sont affectés.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.free_volunteers.map((v) => (
              <span
                key={v.id}
                className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
              >
                {v.full_name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
