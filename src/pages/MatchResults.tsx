import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface MatchData {
  id: string;
  match_score: number;
  score_breakdown: any;
  suggested_venues: any[];
  status: string;
  matched_profile: {
    display_name: string;
    home_neighborhood: string | null;
    preferred_apps: string[];
    trust_score: number;
  };
}

const MatchResults = () => {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      if (!sessionId || !user) return;

      const { data, error } = await supabase
        .from("matches")
        .select("id, match_score, score_breakdown, suggested_venues, status, matched_user_id")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .order("match_score", { ascending: false });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      // Fetch matched profiles
      const enriched: MatchData[] = [];
      for (const match of (data || []) as any[]) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, home_neighborhood, preferred_apps, trust_score")
          .eq("user_id", match.matched_user_id)
          .maybeSingle();

        enriched.push({
          ...match,
          matched_profile: profile || { display_name: "Someone", home_neighborhood: null, preferred_apps: [], trust_score: 10 },
        });
      }

      setMatches(enriched);
      setLoading(false);
    };

    fetchMatches();
  }, [sessionId, user]);

  const handleReachOut = (match: MatchData) => {
    navigate(`/chat/${match.id}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-muted-foreground">Finding your matches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-20 w-80 h-80 rounded-full bg-warm-peach opacity-30 blur-3xl" />
        <div className="absolute bottom-20 left-10 w-64 h-64 rounded-full bg-warm-sage opacity-20 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center px-4 py-8">
        <button onClick={() => navigate("/home")} className="self-start text-sm text-muted-foreground hover:text-foreground mb-6">
          ← Back to Home
        </button>

        <h2 className="font-serif text-3xl font-bold text-foreground mb-2">Your Matches</h2>
        <p className="text-muted-foreground mb-8">
          {matches.length > 0 ? `We found ${matches.length} match${matches.length > 1 ? "es" : ""} for you!` : "No matches found right now."}
        </p>

        {matches.length === 0 && (
          <Card className="w-full max-w-md bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="p-8 text-center space-y-4">
              <span className="text-5xl">😔</span>
              <p className="text-muted-foreground">
                No one with overlapping availability and vibe right now. Try again later or adjust your time windows!
              </p>
              <Button onClick={() => navigate("/lets-hang")}>Try Again</Button>
            </CardContent>
          </Card>
        )}

        <div className="w-full max-w-md space-y-4">
          {matches.map((match) => (
            <Card key={match.id} className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
              <CardContent className="p-0">
                {/* Match header */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-xl font-bold text-foreground">
                        {match.matched_profile.display_name}
                      </h3>
                      {match.matched_profile.home_neighborhood && (
                        <p className="text-sm text-muted-foreground">📍 {match.matched_profile.home_neighborhood}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{Math.round(match.match_score)}%</p>
                      <p className="text-xs text-muted-foreground">match</p>
                    </div>
                  </div>

                  {/* Score breakdown */}
                  {match.score_breakdown && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(match.score_breakdown).map(([key, value]) => (
                        <span key={key} className="px-2 py-1 bg-warm-glow rounded-full text-xs text-foreground">
                          {key}: {String(value)}%
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Trust score */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Trust Score:</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${Math.min(match.matched_profile.trust_score, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-accent">{match.matched_profile.trust_score}</span>
                  </div>
                </div>

                {/* Suggested venues */}
                {Array.isArray(match.suggested_venues) && match.suggested_venues.length > 0 && (
                  <div className="px-5 pb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">💡 Suggested spots:</p>
                    <div className="flex flex-wrap gap-2">
                      {match.suggested_venues.map((venue: any, i: number) => (
                        <span key={i} className="px-2 py-1 bg-warm-sage rounded-full text-xs text-foreground">
                          {typeof venue === "string" ? venue : venue.name || venue.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action */}
                <div className="p-5 pt-2">
                  <Button
                    className="w-full"
                    onClick={() => handleReachOut(match)}
                    disabled={match.status === "accepted"}
                  >
                    {match.status === "accepted" ? "✅ Reached Out" : "👋 Reach Out"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MatchResults;
