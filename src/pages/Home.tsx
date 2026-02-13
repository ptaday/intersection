import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Home = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile(data);
      setLoading(false);

      // Redirect to intake if not completed
      if (data && !data.intake_completed) {
        navigate("/intake");
      }
    };
    fetchProfile();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Warm blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-20 w-80 h-80 rounded-full bg-warm-peach opacity-30 blur-3xl" />
        <div className="absolute bottom-20 left-10 w-64 h-64 rounded-full bg-warm-sage opacity-20 blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 md:px-12">
        <h1 className="font-serif text-2xl font-bold text-foreground tracking-tight">
          intersection
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Hey, {profile?.display_name || "friend"} 👋
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
            Settings
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </nav>

      {/* Main */}
      <main className="relative z-10 flex flex-col items-center px-6 pt-16 pb-20">
        <div className="max-w-lg w-full space-y-8 text-center">
          <div className="space-y-3">
            <h2 className="font-serif text-4xl font-bold text-foreground">
              Ready to hang?
            </h2>
            <p className="text-muted-foreground">
              Tell us how you're feeling and we'll find the perfect match nearby.
            </p>
          </div>

          <Button
            size="lg"
            className="w-full max-w-xs mx-auto text-lg py-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => navigate("/lets-hang")}
          >
            🤝 Let's Hang
          </Button>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-4 pt-8">
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <CardContent className="p-5 text-center">
                <p className="text-2xl font-serif font-bold text-primary">{profile?.trust_score || 10}</p>
                <p className="text-xs text-muted-foreground mt-1">Trust Score</p>
              </CardContent>
            </Card>
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <CardContent className="p-5 text-center">
                <p className="text-2xl font-serif font-bold text-accent">0</p>
                <p className="text-xs text-muted-foreground mt-1">Hangouts</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
