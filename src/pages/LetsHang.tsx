import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { MOOD_OPTIONS, ACTIVITY_TYPES } from "@/lib/nyc-data";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { Mic, MicOff, Plus } from "lucide-react";

type TimeWindow = { date: string; start: string; end: string };

const LetsHang = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0: Mood
  const [mood, setMood] = useState("");
  const [energyLevel, setEnergyLevel] = useState([5]);

  // Step 1: Time windows
  const [timeWindows, setTimeWindows] = useState<TimeWindow[]>([]);
  const [twDate, setTwDate] = useState("");
  const [twStart, setTwStart] = useState("");
  const [twEnd, setTwEnd] = useState("");

  // Step 2: Activities
  const [activities, setActivities] = useState<string[]>([]);
  const [customActivity, setCustomActivity] = useState("");
  const [customMood, setCustomMood] = useState("");
  const [wantsToDo, setWantsToDo] = useState("");
  const [doesNotWant, setDoesNotWant] = useState("");

  // Step 3: AI Conversational Intent
  const [intentMessages, setIntentMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [intentInput, setIntentInput] = useState("");
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentDone, setIntentDone] = useState(false);

  // Voice-to-text hooks
  const wantsVoice = useSpeechToText(useCallback((t: string) => setWantsToDo(prev => prev ? prev + " " + t : t), []));
  const doesNotWantVoice = useSpeechToText(useCallback((t: string) => setDoesNotWant(prev => prev ? prev + " " + t : t), []));
  const intentVoice = useSpeechToText(useCallback((t: string) => setIntentInput(prev => prev ? prev + " " + t : t), []));

  const steps = [
    { title: "😌 How are you feeling?", desc: "Pick your vibe for this hangout" },
    { title: "⏰ When are you free?", desc: "Add time windows in the next 48 hours" },
    { title: "🎯 What sounds good?", desc: "Activities and boundaries" },
    { title: "💬 Tell us more", desc: "A quick chat to understand your intent" },
  ];

  const toggleActivity = (a: string) => {
    setActivities(activities.includes(a) ? activities.filter((x) => x !== a) : [...activities, a]);
  };

  const addTimeWindow = () => {
    if (!twDate || !twStart || !twEnd) return;
    setTimeWindows([...timeWindows, { date: twDate, start: twStart, end: twEnd }]);
    setTwDate("");
    setTwStart("");
    setTwEnd("");
  };

  // Get today and tomorrow dates for min/max
  const today = new Date().toISOString().split("T")[0];
  const dayAfterTomorrow = new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0];

  const sendIntentMessage = async () => {
    if (!intentInput.trim()) return;
    const userMsg = { role: "user", content: intentInput };
    const newMessages = [...intentMessages, userMsg];
    setIntentMessages(newMessages);
    setIntentInput("");
    setIntentLoading(true);

    try {
      const response = await supabase.functions.invoke("conversational-intent", {
        body: {
          messages: newMessages,
          mood,
          energyLevel: energyLevel[0],
          activities,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const data = response.data;
      if (data.done) {
        setIntentDone(true);
        setIntentMessages([...newMessages, { role: "assistant", content: data.message }]);
      } else {
        setIntentMessages([...newMessages, { role: "assistant", content: data.message }]);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIntentLoading(false);
    }
  };

  // Start conversation when entering step 3
  const startConversation = async () => {
    if (intentMessages.length > 0) return;
    setIntentLoading(true);
    try {
      const response = await supabase.functions.invoke("conversational-intent", {
        body: {
          messages: [],
          mood,
          energyLevel: energyLevel[0],
          activities,
          isStart: true,
        },
      });
      if (response.error) throw new Error(response.error.message);
      setIntentMessages([{ role: "assistant", content: response.data.message }]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIntentLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !mood || timeWindows.length === 0) {
      toast({ title: "Missing info", description: "Please set your mood and at least one time window.", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      const expiresAt = new Date(Date.now() + 48 * 3600000).toISOString();
      
      // Extract emotional metadata from conversation
      const emotionalMetadata = {
        conversation: intentMessages,
        mood,
        energy: energyLevel[0],
        wants: wantsToDo,
        avoids: doesNotWant,
      };

      const { data: session, error } = await supabase
        .from("hang_sessions")
        .insert({
          user_id: user.id,
          mood,
          energy_level: energyLevel[0],
          activity_types: activities,
          wants_to_do: wantsToDo,
          does_not_want: doesNotWant,
          emotional_intent_metadata: emotionalMetadata,
          time_windows: timeWindows,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger matching
      const matchResult = await supabase.functions.invoke("find-matches", {
        body: { sessionId: session.id },
      });

      if (matchResult.error) throw new Error(matchResult.error.message);

      navigate(`/matches/${session.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-20 w-80 h-80 rounded-full bg-warm-peach opacity-30 blur-3xl" />
        <div className="absolute bottom-20 left-10 w-64 h-64 rounded-full bg-warm-lavender opacity-20 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center px-4 py-8 flex-1">
        <button onClick={() => navigate("/home")} className="self-start text-sm text-muted-foreground hover:text-foreground mb-4">
          ← Back
        </button>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 w-12 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
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
                <div className="grid grid-cols-1 gap-3">
                  {MOOD_OPTIONS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMood(m.value)}
                      className={`flex items-center gap-4 p-4 rounded-xl text-left transition-all ${
                        mood === m.value
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      <span className="text-2xl">{m.emoji}</span>
                      <div>
                        <p className="font-medium">{m.label}</p>
                        <p className={`text-xs ${mood === m.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{m.desc}</p>
                      </div>
                    </button>
                  ))}
                  {/* Custom mood that was added */}
                  {customMood && (
                    <button
                      type="button"
                      onClick={() => setMood(customMood)}
                      className={`flex items-center gap-4 p-4 rounded-xl text-left transition-all ${
                        mood === customMood
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      <span className="text-2xl">✨</span>
                      <div>
                        <p className="font-medium">{customMood}</p>
                        <p className={`text-xs ${mood === customMood ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Your custom vibe</p>
                      </div>
                    </button>
                  )}
                </div>

                {/* Add custom mood */}
                <div className="flex gap-2 items-center">
                  <Input
                    id="custom-mood-input"
                    placeholder="Something else on your mind..."
                    className="text-sm h-9"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val) {
                          setCustomMood(val);
                          setMood(val);
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('custom-mood-input') as HTMLInputElement;
                      if (input?.value.trim()) {
                        setCustomMood(input.value.trim());
                        setMood(input.value.trim());
                        input.value = "";
                      }
                    }}
                    className="p-2 rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <Label>Energy Level: {energyLevel[0]}/10</Label>
                  <Slider value={energyLevel} onValueChange={setEnergyLevel} min={1} max={10} step={1} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>🔋 Low key</span>
                    <span>⚡ High energy</span>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                {timeWindows.map((tw, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm">
                    <span>📅 {tw.date}</span>
                    <span>{tw.start} – {tw.end}</span>
                    <button
                      type="button"
                      onClick={() => setTimeWindows(timeWindows.filter((_, j) => j !== i))}
                      className="ml-auto text-muted-foreground hover:text-destructive"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="date"
                    min={today}
                    max={dayAfterTomorrow}
                    value={twDate}
                    onChange={(e) => setTwDate(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <input
                    type="time"
                    value={twStart}
                    onChange={(e) => setTwStart(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <input
                    type="time"
                    value={twEnd}
                    onChange={(e) => setTwEnd(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addTimeWindow}>
                  + Add Time Window
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Activities you're open to</Label>
                  <div className="flex flex-wrap gap-2">
                    {[...ACTIVITY_TYPES, ...activities.filter(a => !ACTIVITY_TYPES.includes(a as any))].map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleActivity(a)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                          activities.includes(a)
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  {/* Add custom activity */}
                  <div className="flex gap-2 items-center pt-1">
                    <Input
                      id="custom-activity-input"
                      placeholder="Add your own..."
                      className="text-sm h-9"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = e.currentTarget.value.trim();
                          if (val && !activities.includes(val)) {
                            setActivities([...activities, val]);
                            e.currentTarget.value = "";
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('custom-activity-input') as HTMLInputElement;
                        if (input?.value.trim() && !activities.includes(input.value.trim())) {
                          setActivities([...activities, input.value.trim()]);
                          input.value = "";
                        }
                      }}
                      className="p-2 rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Things you want to do</Label>
                    <button
                      type="button"
                      onClick={wantsVoice.toggleListening}
                      className={`p-1.5 rounded-full transition-colors ${wantsVoice.isListening ? "bg-destructive text-destructive-foreground animate-pulse-warm" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                      title={wantsVoice.isListening ? "Stop recording" : "Start voice input"}
                    >
                      {wantsVoice.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  </div>
                  <Textarea
                    placeholder="I'd love to grab coffee and chat about life..."
                    value={wantsToDo}
                    onChange={(e) => setWantsToDo(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Things you do NOT want to do</Label>
                    <button
                      type="button"
                      onClick={doesNotWantVoice.toggleListening}
                      className={`p-1.5 rounded-full transition-colors ${doesNotWantVoice.isListening ? "bg-destructive text-destructive-foreground animate-pulse-warm" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                      title={doesNotWantVoice.isListening ? "Stop recording" : "Start voice input"}
                    >
                      {doesNotWantVoice.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  </div>
                  <Textarea
                    placeholder="Nothing too loud or crowded today..."
                    value={doesNotWant}
                    onChange={(e) => setDoesNotWant(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              </>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-warm-glow rounded-xl p-4 space-y-3 max-h-64 overflow-y-auto">
                  {intentMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-card text-foreground rounded-bl-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {intentLoading && (
                    <div className="flex justify-start">
                      <div className="bg-card text-muted-foreground px-4 py-2 rounded-2xl rounded-bl-sm text-sm animate-pulse-warm">
                        thinking...
                      </div>
                    </div>
                  )}
                </div>

                {!intentDone && (
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Share how you're feeling..."
                      value={intentInput}
                      onChange={(e) => setIntentInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendIntentMessage();
                        }
                      }}
                      className="min-h-[50px]"
                    />
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={intentVoice.toggleListening}
                        className={`p-2 rounded-full transition-colors ${intentVoice.isListening ? "bg-destructive text-destructive-foreground animate-pulse-warm" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                        title={intentVoice.isListening ? "Stop recording" : "Start voice input"}
                      >
                        {intentVoice.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </button>
                      <Button onClick={sendIntentMessage} disabled={intentLoading || !intentInput.trim()} size="icon">
                        Send
                      </Button>
                    </div>
                  </div>
                )}

                {intentDone && (
                  <p className="text-center text-sm text-muted-foreground">
                    ✨ Got it! We understand your vibe. Let's find your match.
                  </p>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              {step > 0 ? (
                <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>
              ) : <div />}
              {step < steps.length - 1 ? (
                <Button
                  onClick={() => {
                    const next = step + 1;
                    setStep(next);
                    if (next === 3) startConversation();
                  }}
                  disabled={step === 0 && !mood}
                >
                  Continue
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading || !intentDone}>
                  {loading ? "Finding matches..." : "Find My Match 🤝"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LetsHang;
