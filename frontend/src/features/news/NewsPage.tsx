import { zodResolver } from "@hookform/resolvers/zod";
import { Newspaper, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import * as newsApi from "../../api/news";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import type { News } from "../../types/models";

const schema = z.object({
  title: z.string().min(1, "Titre requis"),
  content: z.string().min(1, "Contenu requis"),
});

type FormData = z.infer<typeof schema>;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NewsPage({
  eventId,
  isAdmin,
}: {
  eventId: number;
  isAdmin: boolean;
}) {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const data = await newsApi.getEventNews(eventId);
      setNews(data.results);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [eventId]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await newsApi.createNews(eventId, data);
      toast.success("Actualité publiée");
      reset();
      setShowForm(false);
      fetchNews();
    } catch {
      toast.error("Erreur");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette actualité ?")) return;
    try {
      await newsApi.deleteNews(eventId, id);
      setNews((prev) => prev.filter((n) => n.id !== id));
      toast.success("Supprimée");
    } catch {
      toast.error("Erreur");
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Publier
            </Button>
          )}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3"
        >
          <Input
            id="news-title"
            label="Titre"
            error={errors.title?.message}
            {...register("title")}
          />
          <div>
            <label
              htmlFor="news-content"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Contenu
            </label>
            <textarea
              id="news-content"
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              {...register("content")}
            />
            {errors.content && (
              <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Publier
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                reset();
              }}
            >
              Annuler
            </Button>
          </div>
        </form>
      )}

      {news.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <Newspaper className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p>Aucune actualité.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {news.map((n) => (
            <article
              key={n.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">
                    {n.title}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {n.author_name} · {formatDate(n.created_at)}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {n.content}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
