export const NYC_BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"] as const;

export const NYC_NEIGHBORHOODS: Record<string, string[]> = {
  Manhattan: [
    "Upper East Side", "Upper West Side", "Midtown", "Chelsea", "West Village",
    "East Village", "Greenwich Village", "SoHo", "Tribeca", "Lower East Side",
    "Financial District", "Harlem", "Washington Heights", "Flatiron", "Murray Hill",
    "Hell's Kitchen", "Gramercy", "NoHo", "Nolita", "Chinatown",
  ],
  Brooklyn: [
    "Williamsburg", "DUMBO", "Brooklyn Heights", "Park Slope", "Bushwick",
    "Bed-Stuy", "Crown Heights", "Greenpoint", "Cobble Hill", "Carroll Gardens",
    "Fort Greene", "Prospect Heights", "Red Hook", "Sunset Park", "Bay Ridge",
  ],
  Queens: [
    "Astoria", "Long Island City", "Jackson Heights", "Flushing", "Forest Hills",
    "Sunnyside", "Woodside", "Elmhurst", "Ridgewood",
  ],
  Bronx: [
    "South Bronx", "Riverdale", "Fordham", "Pelham Bay", "Mott Haven",
    "Concourse", "Kingsbridge",
  ],
  "Staten Island": [
    "St. George", "Tottenville", "New Dorp", "Great Kills",
  ],
};

export const NYC_TRAIN_ROUTES = [
  "1", "2", "3", "4", "5", "6", "7",
  "A", "C", "E", "B", "D", "F", "M",
  "G", "J", "Z", "L", "N", "Q", "R", "W", "S",
] as const;

export const LOCATION_TYPES = [
  { value: "office", label: "🏢 Office", emoji: "🏢" },
  { value: "gym", label: "💪 Gym", emoji: "💪" },
  { value: "grocery", label: "🛒 Grocery Store", emoji: "🛒" },
  { value: "coffee_shop", label: "☕ Coffee Shop", emoji: "☕" },
  { value: "other", label: "📍 Other", emoji: "📍" },
] as const;

export const MOOD_OPTIONS = [
  { value: "chill", label: "Chill", emoji: "😌", desc: "Low effort, relaxed hang" },
  { value: "deep_talk", label: "Deep Talk", emoji: "💭", desc: "Meaningful conversation" },
  { value: "explore_nyc", label: "Explore NYC", emoji: "🗽", desc: "Activity or adventure" },
  { value: "coworking", label: "Co-Working", emoji: "💻", desc: "Productive meet" },
  { value: "party", label: "Party / Social", emoji: "🎉", desc: "High energy" },
  { value: "workout", label: "Workout", emoji: "🏋️", desc: "Exercise together" },
] as const;

export const ACTIVITY_TYPES = [
  "Coffee", "Dinner", "Drinks", "Walk", "Museum", "Movie",
  "Workout", "Study", "Shopping", "Live Music", "Comedy Show",
  "Board Games", "Park Hangout", "Brunch", "Gallery",
] as const;

export const PREFERRED_APPS = [
  { value: "whatsapp", label: "WhatsApp", emoji: "💬" },
  { value: "imessage", label: "iMessage", emoji: "📱" },
  { value: "instagram", label: "Instagram DM", emoji: "📸" },
  { value: "telegram", label: "Telegram", emoji: "✈️" },
  { value: "signal", label: "Signal", emoji: "🔒" },
] as const;

export const HANGOUT_TYPES = [
  "Coffee catch-up", "Dinner", "Drinks", "Walk & Talk", "Workout buddy",
  "Co-working", "Explore a neighborhood", "Museum / Gallery", "Live event",
  "Game night", "Movie", "Brunch",
] as const;
