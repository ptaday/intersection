import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Send, ArrowLeft, MapPin } from "lucide-react";

interface MatchInfo {
  id: string;
  match_score: number;
  score_breakdown: any;
  suggested_venues: any[];
  session_id: string;
  user_id: string;
  matched_user_id: string;
  other_profile: {
    display_name: string;
    home_neighborhood: string | null;
    preferred_hangout_types: string[];
  };
  my_profile: {
    preferred_hangout_types: string[];
  };
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

const Chat = () => {
  const { matchId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch match info + profiles
  useEffect(() => {
    const fetchMatch = async () => {
      if (!matchId || !user) return;

      const { data: matchData, error } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .maybeSingle();

      if (error || !matchData) {
        toast({ title: "Error", description: "Match not found", variant: "destructive" });
        navigate("/home");
        return;
      }

      const otherId = matchData.user_id === user.id ? matchData.matched_user_id : matchData.user_id;

      const [otherRes, myRes] = await Promise.all([
        supabase.from("profiles").select("display_name, home_neighborhood, preferred_hangout_types").eq("user_id", otherId).maybeSingle(),
        supabase.from("profiles").select("preferred_hangout_types").eq("user_id", user.id).maybeSingle(),
      ]);

      setMatch({
        ...matchData,
        suggested_venues: Array.isArray(matchData.suggested_venues) ? matchData.suggested_venues : [],
        other_profile: otherRes.data || { display_name: "Someone", home_neighborhood: null, preferred_hangout_types: [] },
        my_profile: myRes.data || { preferred_hangout_types: [] },
      });

      // Update match status to accepted
      if (matchData.status === "suggested") {
        await supabase.from("matches").update({ status: "accepted" }).eq("id", matchId);
      }

      setLoading(false);
    };

    fetchMatch();
  }, [matchId, user]);

  // Fetch messages + realtime subscription
  useEffect(() => {
    if (!matchId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) || []);
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat-${matchId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !matchId || sending) return;
    setSending(true);

    const { error } = await supabase.from("messages").insert({
      match_id: matchId,
      sender_id: user.id,
      content: newMessage.trim(),
    });

    if (error) {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    }
    setNewMessage("");
    setSending(false);
  };

  const sharedInterests = match
    ? (match.my_profile.preferred_hangout_types || []).filter((t) =>
        (match.other_profile.preferred_hangout_types || []).includes(t)
      )
    : [];

  const venues = match?.suggested_venues || [];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!match) return null;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="font-serif text-lg font-bold text-foreground">
            {match.other_profile.display_name}
          </h2>
          {match.other_profile.home_neighborhood && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {match.other_profile.home_neighborhood}
            </p>
          )}
        </div>
        <span className="text-sm font-bold text-primary">{Math.round(match.match_score)}% match</span>
      </div>

      {/* Context banner: shared interests + suggested spots */}
      <div className="px-4 py-3 border-b border-border bg-warm-glow space-y-2">
        {sharedInterests.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">🤝 Shared interests</p>
            <div className="flex flex-wrap gap-1.5">
              {sharedInterests.map((interest) => (
                <span key={interest} className="px-2 py-0.5 bg-warm-peach rounded-full text-xs text-foreground">
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}
        {Array.isArray(venues) && venues.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">💡 Suggested spots</p>
            <div className="flex flex-wrap gap-1.5">
              {venues.map((v: any, i: number) => (
                <button
                  key={i}
                  className="px-2 py-0.5 bg-warm-sage rounded-full text-xs text-foreground hover:opacity-80 transition-opacity"
                  onClick={() => setNewMessage(`How about ${typeof v === "string" ? v : v.name || v.title}?`)}
                >
                  📍 {typeof v === "string" ? v : v.name || v.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <span className="text-4xl">👋</span>
            <p className="text-muted-foreground text-sm">
              Say hi to {match.other_profile.display_name}! Tap a suggested spot above to break the ice.
            </p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${
                  isMe
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card text-card-foreground border border-border rounded-bl-md"
                }`}
              >
                {msg.content}
                <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card/80 backdrop-blur-sm">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="flex items-center gap-2"
        >
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-full bg-background"
          />
          <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={!newMessage.trim() || sending}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
