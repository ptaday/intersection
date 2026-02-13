import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Warm background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-20 w-80 h-80 rounded-full bg-warm-peach opacity-40 blur-3xl animate-float" />
        <div className="absolute bottom-32 left-16 w-96 h-96 rounded-full bg-warm-sage opacity-30 blur-3xl animate-float" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/3 left-1/3 w-72 h-72 rounded-full bg-warm-lavender opacity-25 blur-3xl animate-float" style={{ animationDelay: "2s" }} />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 md:px-12">
        <h1 className="font-serif text-2xl font-bold text-foreground tracking-tight">
          intersection
        </h1>
        <div className="flex gap-3">
          {user ? (
            <Button onClick={() => navigate("/home")}>Open App</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate("/auth")}>Sign In</Button>
              <Button onClick={() => navigate("/auth")}>Get Started</Button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="max-w-2xl space-y-6">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            NYC Hangout Matching
          </p>
          <h2 className="font-serif text-5xl md:text-6xl font-bold text-foreground leading-tight">
            Find your people,<br />
            <span className="text-primary">right now.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Real connection happens when proximity, availability, and energy align. 
            Intersection matches you with the right person to hang out with — based on how you feel right now.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button size="lg" className="text-base px-8" onClick={() => navigate(user ? "/home" : "/auth")}>
              Start Connecting
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>
              How It Works
            </Button>
          </div>
        </div>

      </main>

      {/* How It Works */}
      <section id="how-it-works" className="relative z-10 scroll-mt-8 px-6 py-20">
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { emoji: "📍", title: "Proximity", desc: "Matches based on real NYC neighborhoods & transit" },
            { emoji: "🧠", title: "Intent", desc: "Your mood and energy shape every suggestion" },
            { emoji: "⏰", title: "Availability", desc: "48-hour windows — no more 'let's hang sometime'" },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-6 text-center space-y-2">
              <span className="text-3xl">{item.emoji}</span>
              <h3 className="font-serif text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center text-sm text-muted-foreground">
        Made for New York City 🗽
      </footer>
    </div>
  );
};

export default Index;
