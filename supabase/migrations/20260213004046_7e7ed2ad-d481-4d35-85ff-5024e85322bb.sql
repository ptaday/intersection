
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  home_neighborhood TEXT,
  preferred_neighborhoods TEXT[] DEFAULT '{}',
  train_routes TEXT[] DEFAULT '{}',
  social_preference TEXT DEFAULT 'both' CHECK (social_preference IN ('one_on_one', 'group', 'both')),
  preferred_hangout_types TEXT[] DEFAULT '{}',
  preferred_apps TEXT[] DEFAULT '{}',
  intake_completed BOOLEAN DEFAULT false,
  trust_score INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- User locations (frequent spots)
CREATE TABLE public.user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  location_type TEXT NOT NULL CHECK (location_type IN ('office', 'gym', 'grocery', 'coffee_shop', 'other')),
  neighborhood TEXT NOT NULL,
  borough TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own locations" ON public.user_locations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own locations" ON public.user_locations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own locations" ON public.user_locations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own locations" ON public.user_locations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- User interests/hobbies
CREATE TABLE public.user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  interest TEXT NOT NULL,
  interest_type TEXT NOT NULL CHECK (interest_type IN ('hobby', 'regular_activity')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interests" ON public.user_interests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interests" ON public.user_interests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own interests" ON public.user_interests FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Hang sessions (when user taps "Let's Hang")
CREATE TABLE public.hang_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('chill', 'deep_talk', 'explore_nyc', 'coworking', 'party')),
  energy_level INTEGER DEFAULT 5 CHECK (energy_level BETWEEN 1 AND 10),
  activity_types TEXT[] DEFAULT '{}',
  wants_to_do TEXT,
  does_not_want TEXT,
  emotional_intent_metadata JSONB DEFAULT '{}',
  time_windows JSONB NOT NULL DEFAULT '[]',
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.hang_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hang sessions" ON public.hang_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own hang sessions" ON public.hang_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own hang sessions" ON public.hang_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Friendships
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships" ON public.friendships FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can send friend requests" ON public.friendships FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update friendship status" ON public.friendships FOR UPDATE TO authenticated USING (auth.uid() = friend_id);

-- Matches
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.hang_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  matched_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  match_score NUMERIC(5,2) NOT NULL,
  score_breakdown JSONB DEFAULT '{}',
  status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'declined', 'completed')),
  suggested_venues JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own matches" ON public.matches FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = matched_user_id);
CREATE POLICY "Users can update own matches" ON public.matches FOR UPDATE TO authenticated USING (auth.uid() = user_id OR auth.uid() = matched_user_id);

-- Trust signals
CREATE TABLE public.trust_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('phone_verified', 'email_verified', 'hangout_completed', 'positive_feedback', 'report_received', 'profile_complete')),
  points INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trust_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trust signals" ON public.trust_signals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert trust signals" ON public.trust_signals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.trust_signals (user_id, signal_type, points)
  VALUES (NEW.id, 'email_verified', 10);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
