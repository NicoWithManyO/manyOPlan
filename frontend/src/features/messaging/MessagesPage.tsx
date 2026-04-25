import { ArrowLeft, MessageSquare, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as messagesApi from "../../api/messages";
import { useAuthStore } from "../../stores/authStore";
import type { Conversation, Message } from "../../types/models";
import { cn } from "../../utils/cn";

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ConversationList({
  conversations,
  onSelect,
}: {
  conversations: Conversation[];
  onSelect: (conv: Conversation) => void;
}) {
  if (conversations.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        <MessageSquare className="mx-auto mb-3 h-10 w-10 text-gray-400" />
        <p>Aucune conversation.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {conversations.map((conv) => (
        <li key={conv.user_id}>
          <button
            onClick={() => onSelect(conv)}
            className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-gray-50 transition min-h-[56px]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
              {conv.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {conv.full_name}
                </span>
                <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                  {formatTime(conv.last_date)}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">{conv.last_message}</p>
            </div>
            {conv.unread_count > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
                {conv.unread_count}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ChatThread({
  partnerId,
  partnerName,
  onBack,
}: {
  partnerId: number;
  partnerName: string;
  onBack: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchThread = async () => {
    setLoading(true);
    try {
      const data = await messagesApi.getThread(partnerId);
      setMessages(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThread();
  }, [partnerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const msg = await messagesApi.sendMessage(partnerId, trimmed);
      setMessages((prev) => [...prev, msg]);
      setInput("");
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[500px] flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <button
          onClick={onBack}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 min-h-[36px] min-w-[36px] flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
          {partnerName.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-gray-900">{partnerName}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-8">
            Commencez la conversation !
          </p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender === user?.id;
            return (
              <div
                key={msg.id}
                className={cn("flex", isMine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                    isMine
                      ? "bg-indigo-600 text-white rounded-br-md"
                      : "bg-gray-100 text-gray-900 rounded-bl-md",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p
                    className={cn(
                      "mt-0.5 text-[10px]",
                      isMine ? "text-indigo-200" : "text-gray-400",
                    )}
                  >
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-gray-200 pt-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Votre message..."
          className="min-h-[44px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className={cn(
            "flex h-[44px] w-[44px] items-center justify-center rounded-lg transition",
            input.trim()
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-100 text-gray-400",
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);

  useEffect(() => {
    setLoading(true);
    messagesApi
      .getConversations()
      .then(setConversations)
      .finally(() => setLoading(false));
  }, []);

  const handleBack = () => {
    setActiveConv(null);
    // Refresh conversations to update unread counts
    messagesApi.getConversations().then(setConversations);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
    );
  }

  if (activeConv) {
    return (
      <ChatThread
        partnerId={activeConv.user_id}
        partnerName={activeConv.full_name}
        onBack={handleBack}
      />
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold text-gray-900">Messages</h2>
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <ConversationList
          conversations={conversations}
          onSelect={setActiveConv}
        />
      </div>
    </div>
  );
}
