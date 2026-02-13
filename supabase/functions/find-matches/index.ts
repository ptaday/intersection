import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("sessionId required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the hang session
    const { data: session, error: sessErr } = await supabase
      .from("hang_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();
    if (sessErr || !session) throw new Error("Session not found");

    // Get the user's profile
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", session.user_id)
      .single();
    if (!userProfile) throw new Error("Profile not found");

    // Get user's locations
    const { data: userLocations } = await supabase
      .from("user_locations")
      .select("*")
      .eq("user_id", session.user_id);

    // Get user's interests
    const { data: userInterests } = await supabase
      .from("user_interests")
      .select("*")
      .eq("user_id", session.user_id);

    // Get user's friendships
    const { data: friendships } = await supabase
      .from("friendships")
      .select("*")
      .or(`user_id.eq.${session.user_id},friend_id.eq.${session.user_id}`)
      .eq("status", "accepted");

    const friendIds = (friendships || []).map((f: any) =>
      f.user_id === session.user_id ? f.friend_id : f.user_id
    );

    // Get all other active hang sessions in the same 48-hour window
    const { data: otherSessions } = await supabase
      .from("hang_sessions")
      .select("*")
      .neq("user_id", session.user_id)
      .eq("is_active", true)
      .gte("expires_at", new Date().toISOString());

    if (!otherSessions || otherSessions.length === 0) {
      return new Response(JSON.stringify({ matches: [], message: "No active sessions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Score each candidate
    const candidates: any[] = [];

    for (const other of otherSessions) {
      const { data: otherProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", other.user_id)
        .single();
      if (!otherProfile) continue;

      const { data: otherLocations } = await supabase
        .from("user_locations")
        .select("*")
        .eq("user_id", other.user_id);

      const { data: otherInterests } = await supabase
        .from("user_interests")
        .select("*")
        .eq("user_id", other.user_id);

      // --- SCORING ---
      let locationScore = 0;
      let moodScore = 0;
      let timeScore = 0;
      let activityScore = 0;
      let friendBonus = 0;

      // Location overlap (neighborhoods + boroughs + train routes)
      const userNeighborhoods = new Set([
        userProfile.home_neighborhood,
        ...(userProfile.preferred_neighborhoods || []),
        ...(userLocations || []).map((l: any) => l.neighborhood),
      ]);
      const otherNeighborhoods = new Set([
        otherProfile.home_neighborhood,
        ...(otherProfile.preferred_neighborhoods || []),
        ...(otherLocations || []).map((l: any) => l.neighborhood),
      ]);

      const neighborhoodOverlap = [...userNeighborhoods].filter((n) => otherNeighborhoods.has(n)).length;
      const trainOverlap = (userProfile.train_routes || []).filter((r: string) =>
        (otherProfile.train_routes || []).includes(r)
      ).length;

      locationScore = Math.min(100, (neighborhoodOverlap * 20) + (trainOverlap * 10));

      // Mood compatibility
      if (session.mood === other.mood) moodScore = 100;
      else {
        const compatibleMoods: Record<string, string[]> = {
          chill: ["deep_talk", "coworking"],
          deep_talk: ["chill", "explore_nyc"],
          explore_nyc: ["deep_talk", "party"],
          coworking: ["chill"],
          party: ["explore_nyc"],
        };
        if (compatibleMoods[session.mood]?.includes(other.mood)) moodScore = 60;
        else moodScore = 20;
      }

      // Energy compatibility (closer = better)
      const energyDiff = Math.abs((session.energy_level || 5) - (other.energy_level || 5));
      moodScore = Math.round((moodScore + Math.max(0, 100 - energyDiff * 15)) / 2);

      // Time overlap
      const sessionWindows = Array.isArray(session.time_windows) ? session.time_windows : [];
      const otherWindows = Array.isArray(other.time_windows) ? other.time_windows : [];

      for (const sw of sessionWindows) {
        for (const ow of otherWindows) {
          if ((sw as any).date === (ow as any).date) {
            const sStart = (sw as any).start;
            const sEnd = (sw as any).end;
            const oStart = (ow as any).start;
            const oEnd = (ow as any).end;
            if (sStart < oEnd && oStart < sEnd) {
              timeScore = 100;
              break;
            }
          }
        }
        if (timeScore > 0) break;
      }

      // Activity match
      const sessionActivities = new Set(session.activity_types || []);
      const otherActivities = new Set(other.activity_types || []);
      const activityOverlap = [...sessionActivities].filter((a) => otherActivities.has(a)).length;
      activityScore = sessionActivities.size > 0 ? Math.min(100, (activityOverlap / sessionActivities.size) * 100) : 50;

      // Interest overlap bonus
      const userInterestNames = new Set((userInterests || []).map((i: any) => i.interest.toLowerCase()));
      const otherInterestNames = new Set((otherInterests || []).map((i: any) => i.interest.toLowerCase()));
      const interestOverlap = [...userInterestNames].filter((i) => otherInterestNames.has(i)).length;
      activityScore = Math.min(100, activityScore + interestOverlap * 10);

      // Friend bonus
      if (friendIds.includes(other.user_id)) friendBonus = 100;

      // Weighted total
      const totalScore =
        locationScore * 0.3 +
        moodScore * 0.25 +
        timeScore * 0.25 +
        activityScore * 0.15 +
        friendBonus * 0.05;

      // Only include matches above threshold
      if (totalScore >= 20 && timeScore > 0) {
        candidates.push({
          userId: other.user_id,
          sessionId: other.id,
          score: Math.round(totalScore),
          breakdown: {
            location: Math.round(locationScore),
            mood: Math.round(moodScore),
            time: Math.round(timeScore),
            activity: Math.round(activityScore),
            friend: Math.round(friendBonus),
          },
        });
      }
    }

    // Sort by score
    candidates.sort((a, b) => b.score - a.score);
    const topMatches = candidates.slice(0, 10);

    // Search for venues using Tavily
    const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
    let venueResults: any[] = [];

    if (TAVILY_API_KEY && topMatches.length > 0) {
      const moodDescriptions: Record<string, string> = {
        chill: "relaxed chill hangout spots",
        deep_talk: "quiet coffee shops for conversation",
        explore_nyc: "cool things to do activities",
        coworking: "co-working cafes",
        party: "bars nightlife social spots",
      };

      const neighborhood = userProfile.home_neighborhood || "Manhattan";
      const moodDesc = moodDescriptions[session.mood] || "hangout spots";
      const activities = (session.activity_types || []).slice(0, 2).join(", ");
      const searchQuery = `${moodDesc} ${activities} in ${neighborhood} New York City NYC restaurants bars cafes`;

      try {
        const tavilyResponse = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            query: searchQuery,
            max_results: 5,
            search_depth: "basic",
            include_domains: ["yelp.com", "timeout.com", "eater.com", "thrillist.com", "infatuation.com", "google.com/maps"],
          }),
        });

        if (tavilyResponse.ok) {
          const tavilyData = await tavilyResponse.json();
          venueResults = (tavilyData.results || []).map((r: any) => ({
            name: r.title,
            url: r.url,
            snippet: r.content?.slice(0, 100),
          }));
        }
      } catch (e) {
        console.error("Tavily search error:", e);
      }
    }

    // Insert matches into DB
    for (const candidate of topMatches) {
      await supabase.from("matches").insert({
        session_id: sessionId,
        user_id: session.user_id,
        matched_user_id: candidate.userId,
        match_score: candidate.score,
        score_breakdown: candidate.breakdown,
        suggested_venues: venueResults,
      });
    }

    return new Response(
      JSON.stringify({ matches: topMatches, venues: venueResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("find-matches error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
