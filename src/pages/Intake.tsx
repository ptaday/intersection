import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  NYC_BOROUGHS,
  NYC_NEIGHBORHOODS,
  NYC_TRAIN_ROUTES,
  LOCATION_TYPES,
  PREFERRED_APPS,
  HANGOUT_TYPES,
} from "@/lib/nyc-data";

type LocationEntry = {
  label: string;
  location_type: string;
  neighborhood: string;
  borough: string;
};

const Intake = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0: Location
  const [homeNeighborhood, setHomeNeighborhood] = useState("");
  const [homeBoroughIdx, setHomeBoroughIdx] = useState(0);
  const [preferredNeighborhoods, setPreferredNeighborhoods] = useState<string[]>([]);
  const [trainRoutes, setTrainRoutes] = useState<string[]>([]);
  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [newLocLabel, setNewLocLabel] = useState("");
  const [newLocType, setNewLocType] = useState("office");
  const [newLocNeighborhood, setNewLocNeighborhood] = useState("");
  const [newLocBorough, setNewLocBorough] = useState("Manhattan");

  // Step 1: Interests
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [hobbyInput, setHobbyInput] = useState("");
  const [regularActivities, setRegularActivities] = useState<string[]>([]);
  const [activityInput, setActivityInput] = useState("");

  // Step 2: Social
  const [socialPref, setSocialPref] = useState("both");
  const [hangoutTypes, setHangoutTypes] = useState<string[]>([]);
  const [preferredApps, setPreferredApps] = useState<string[]>([]);

  const steps = [
    { title: "📍 Your NYC", desc: "Where do you spend your time?" },
    { title: "🎯 Interests", desc: "What do you love doing?" },
    { title: "🤝 Social Style", desc: "How do you like to hang?" },
  ];

  const toggleItem = (arr: string[], item: string, setter: (v: string[]) => void) => {
    setter(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  };

  const addLocation = () => {
    if (!newLocLabel || !newLocNeighborhood) return;
    setLocations([...locations, { label: newLocLabel, location_type: newLocType, neighborhood: newLocNeighborhood, borough: newLocBorough }]);
    setNewLocLabel("");
    setNewLocNeighborhood("");
  };

  const addHobby = () => {
    if (!hobbyInput.trim()) return;
    setHobbies([...hobbies, hobbyInput.trim()]);
    setHobbyInput("");
  };

  const addActivity = () => {
    if (!activityInput.trim()) return;
    setRegularActivities([...regularActivities, activityInput.trim()]);
    setActivityInput("");
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          home_neighborhood: homeNeighborhood,
          preferred_neighborhoods: preferredNeighborhoods,
          train_routes: trainRoutes,
          social_preference: socialPref,
          preferred_hangout_types: hangoutTypes,
          preferred_apps: preferredApps,
          intake_completed: true,
        })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // Insert locations
      if (locations.length > 0) {
        const { error: locError } = await supabase
          .from("user_locations")
          .insert(locations.map((l) => ({ ...l, user_id: user.id })));
        if (locError) throw locError;
      }

      // Insert interests
      const allInterests = [
        ...hobbies.map((i) => ({ user_id: user.id, interest: i, interest_type: "hobby" as const })),
        ...regularActivities.map((i) => ({ user_id: user.id, interest: i, interest_type: "regular_activity" as const })),
      ];
      if (allInterests.length > 0) {
        const { error: intError } = await supabase.from("user_interests").insert(allInterests);
        if (intError) throw intError;
      }

      // Trust signal for profile completion
      await supabase.from("trust_signals").insert({
        user_id: user.id,
        signal_type: "profile_complete",
        points: 15,
      });

      toast({ title: "Profile complete! 🎉", description: "You're ready to find your next hangout." });
      navigate("/home");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Warm blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-20 w-80 h-80 rounded-full bg-warm-peach opacity-30 blur-3xl" />
        <div className="absolute bottom-20 left-10 w-64 h-64 rounded-full bg-warm-sage opacity-20 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center px-4 py-8 flex-1">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-2">intersection</h1>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-16 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <Card className="w-full max-w-lg bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">{steps[step].title}</CardTitle>
            <CardDescription>{steps[step].desc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === 0 && (
              <>
                {/* Home neighborhood */}
                <div className="space-y-2">
                  <Label>Home Borough</Label>
                  <div className="flex flex-wrap gap-2">
                    {NYC_BOROUGHS.map((b, i) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => {
                          setHomeBoroughIdx(i);
                          setHomeNeighborhood("");
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                          i === homeBoroughIdx
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Home Neighborhood</Label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {NYC_NEIGHBORHOODS[NYC_BOROUGHS[homeBoroughIdx]].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setHomeNeighborhood(n)}
                        className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                          homeNeighborhood === n
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preferred neighborhoods */}
                <div className="space-y-2">
                  <Label>Preferred Hangout Neighborhoods (select multiple)</Label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {Object.values(NYC_NEIGHBORHOODS).flat().map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => toggleItem(preferredNeighborhoods, n, setPreferredNeighborhoods)}
                        className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                          preferredNeighborhoods.includes(n)
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Train routes */}
                <div className="space-y-2">
                  <Label>Your Regular Train Routes</Label>
                  <div className="flex flex-wrap gap-2">
                    {NYC_TRAIN_ROUTES.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleItem(trainRoutes, r, setTrainRoutes)}
                        className={`w-9 h-9 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                          trainRoutes.includes(r)
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frequent locations */}
                <div className="space-y-2">
                  <Label>Frequent Spots</Label>
                  {locations.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-muted rounded-lg px-3 py-2">
                      <span>{LOCATION_TYPES.find((t) => t.value === l.location_type)?.emoji}</span>
                      <span className="font-medium">{l.label}</span>
                      <span className="text-muted-foreground">— {l.neighborhood}</span>
                      <button
                        type="button"
                        onClick={() => setLocations(locations.filter((_, j) => j !== i))}
                        className="ml-auto text-muted-foreground hover:text-destructive"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Spot name" value={newLocLabel} onChange={(e) => setNewLocLabel(e.target.value)} />
                    <select
                      value={newLocType}
                      onChange={(e) => setNewLocType(e.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {LOCATION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <select
                      value={newLocBorough}
                      onChange={(e) => setNewLocBorough(e.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {NYC_BOROUGHS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    <select
                      value={newLocNeighborhood}
                      onChange={(e) => setNewLocNeighborhood(e.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select neighborhood</option>
                      {NYC_NEIGHBORHOODS[newLocBorough]?.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addLocation}>
                    + Add Spot
                  </Button>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Hobbies — things you love doing in your free time</Label>
                  <div className="flex flex-wrap gap-2">
                    {hobbies.map((h) => (
                      <span key={h} className="px-3 py-1 rounded-full text-sm bg-warm-peach text-foreground flex items-center gap-1">
                        {h}
                        <button type="button" onClick={() => setHobbies(hobbies.filter((x) => x !== h))} className="hover:text-destructive">✕</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Photography, Reading, Hiking..."
                      value={hobbyInput}
                      onChange={(e) => setHobbyInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHobby())}
                    />
                    <Button type="button" variant="outline" onClick={addHobby}>Add</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Regular NYC Activities — things you do frequently</Label>
                  <div className="flex flex-wrap gap-2">
                    {regularActivities.map((a) => (
                      <span key={a} className="px-3 py-1 rounded-full text-sm bg-warm-sage text-foreground flex items-center gap-1">
                        {a}
                        <button type="button" onClick={() => setRegularActivities(regularActivities.filter((x) => x !== a))} className="hover:text-destructive">✕</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Central Park runs, Comedy shows..."
                      value={activityInput}
                      onChange={(e) => setActivityInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addActivity())}
                    />
                    <Button type="button" variant="outline" onClick={addActivity}>Add</Button>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Social Preference</Label>
                  <div className="flex gap-3">
                    {[
                      { value: "one_on_one", label: "1:1" },
                      { value: "group", label: "Group" },
                      { value: "both", label: "Both" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSocialPref(opt.value)}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                          socialPref === opt.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>What type of hangouts do you like?</Label>
                  <div className="flex flex-wrap gap-2">
                    {HANGOUT_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleItem(hangoutTypes, t, setHangoutTypes)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                          hangoutTypes.includes(t)
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Preferred Communication Apps</Label>
                  <div className="flex flex-wrap gap-2">
                    {PREFERRED_APPS.map((app) => (
                      <button
                        key={app.value}
                        type="button"
                        onClick={() => toggleItem(preferredApps, app.value, setPreferredApps)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                          preferredApps.includes(app.value)
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {app.emoji} {app.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              {step > 0 ? (
                <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>
              ) : <div />}
              {step < steps.length - 1 ? (
                <Button onClick={() => setStep(step + 1)}>Continue</Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? "Saving..." : "Complete Setup ✨"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Intake;
