import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mood, energyLevel, activities, isStart } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are Intersection's conversational AI — warm, empathetic, and genuinely curious about people.

Your goal: Have a SHORT (3-4 exchanges max) conversation to understand the user's emotional state and social intent for hanging out. This metadata helps us match them better.

Context about this user right now:
- Mood: ${mood || "not set"}
- Energy level: ${energyLevel || 5}/10
- Activities they're open to: ${activities?.join(", ") || "not specified"}

CONVERSATION FLOW:
1. Start warmly. Acknowledge their mood/energy. Ask what's on their mind today.
2. Ask what kind of connection they're craving (deep talk, laughs, distraction, comfort, etc.)
3. Gently ask if there's anything specific they want from this hangout.
4. After 3-4 user messages, wrap up with a warm summary and set "done": true.

RULES:
- Be genuine, not robotic. Like a thoughtful friend checking in.
- Keep responses SHORT (2-3 sentences max).
- Never be judgmental.
- Never share this metadata with the matched person — it's private.
- After gathering enough intent, end with a warm closing and include DONE in your final message.

RESPONSE FORMAT: Return JSON with:
{ "message": "your response text", "done": false }
Set "done": true on your final message.`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(isStart
        ? []
        : messages.map((m: any) => ({ role: m.role, content: m.content }))),
    ];

    if (isStart) {
      aiMessages.push({
        role: "user",
        content: "Start the conversation. Greet me warmly and ask how I'm feeling about hanging out today.",
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits needed." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Try to parse JSON response
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { message: content, done: false };
    } catch {
      parsed = { message: content, done: content.includes("DONE") };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("conversational-intent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
