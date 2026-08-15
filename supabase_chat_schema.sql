-- ==============================================================================
-- In-House School Communication Hub - Database Schema
-- ==============================================================================

-- Enable the pg_trgm extension for text search if not exists
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. User Devices (For FCM Push Notifications)
CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    school_id UUID,
    platform TEXT CHECK (platform IN ('android', 'ios', 'web')),
    device_name TEXT,
    fcm_token TEXT NOT NULL,
    app_version TEXT,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE (profile_id, fcm_token)
);

-- 2. Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('direct', 'group', 'announcement', 'entity')),
    title TEXT,
    description TEXT,
    avatar_url TEXT,
    school_id UUID NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    archived_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_id UUID, -- Will be a self-reference later
    is_locked BOOLEAN DEFAULT false,
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'organization'))
);

-- 3. Conversation Members
CREATE TABLE IF NOT EXISTS public.conversation_members (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    notification_level TEXT DEFAULT 'all' CHECK (notification_level IN ('all', 'mentions', 'none')),
    muted_until TIMESTAMPTZ,
    last_read_message_id UUID,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    joined_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    left_at TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, profile_id)
);

-- 4. Messages
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'pdf', 'voice', 'announcement', 'system', 'poll', 'attendance_note', 'student_note')),
    content TEXT,
    reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    is_pinned BOOLEAN DEFAULT false,
    metadata JSONB,
    fts tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED
);

-- Add foreign key constraint for last_message_id now that messages table exists
ALTER TABLE public.conversations
  ADD CONSTRAINT fk_last_message
  FOREIGN KEY (last_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;

-- 5. Message Reads (Detailed Read Receipts for important announcements/groups)
CREATE TABLE IF NOT EXISTS public.message_reads (
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, profile_id)
);

-- 6. Message Attachments
CREATE TABLE IF NOT EXISTS public.message_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_name TEXT,
    file_size BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Message Reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, profile_id, emoji)
);

-- 8. Notifications (already exists in the database)
-- We will not recreate the notifications table or its policies here to avoid conflicts.

-- 9. Conversation Links (ERP Discussion Engine)
CREATE TABLE IF NOT EXISTS public.conversation_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('Student', 'Attendance', 'Homework', 'Examination', 'Marks', 'Leave Request', 'Fee Record', 'Discipline', 'Library', 'Transport', 'Health Record')),
    entity_id UUID NOT NULL,
    relationship TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conversation_id, entity_type, entity_id)
);


-- ==============================================================================
-- Triggers and Functions
-- ==============================================================================

-- Update conversations.last_message_at when a new message is inserted
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      last_message_id = NEW.id
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.update_conversation_last_message();

-- Create trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_devices_updated_at
  BEFORE UPDATE ON public.user_devices
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ==============================================================================
-- Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_links ENABLE ROW LEVEL SECURITY;


-- Conversations RLS
CREATE POLICY "Users can view conversations they are members of" ON public.conversations
  FOR SELECT TO authenticated
  USING (
    visibility = 'public' 
    OR EXISTS (
      SELECT 1 FROM public.conversation_members cm 
      WHERE cm.conversation_id = id AND cm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert conversations" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (true); -- In a real app, you might restrict creation to certain roles

CREATE POLICY "Admins can update conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm 
      WHERE cm.conversation_id = id AND cm.profile_id = auth.uid() AND cm.role = 'admin'
    )
  );

-- Conversation Members RLS
CREATE POLICY "Users can view members of their conversations" ON public.conversation_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members my_cm 
      WHERE my_cm.conversation_id = conversation_id AND my_cm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert members" ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (true); 

CREATE POLICY "Users can update their own membership" ON public.conversation_members
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.conversation_members admin_cm
    WHERE admin_cm.conversation_id = conversation_id AND admin_cm.profile_id = auth.uid() AND admin_cm.role = 'admin'
  ));

-- Messages RLS
CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm 
      WHERE cm.conversation_id = conversation_id AND cm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their conversations" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm 
      WHERE cm.conversation_id = conversation_id AND cm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

-- Other RLS...
CREATE POLICY "Users can manage their devices" ON public.user_devices FOR ALL TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "Users can read attachments" ON public.message_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert attachments" ON public.message_attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can read links" ON public.conversation_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert links" ON public.conversation_links FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING (profile_id = auth.uid());
-- CREATE POLICY "Users can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (profile_id = auth.uid());

-- Realtime Setup
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read of attachments (simplified for MVP, we could tighten this to authenticated users only)
CREATE POLICY "Allow public read chat attachments" ON storage.objects FOR SELECT USING (bucket_id = 'chat-attachments');
CREATE POLICY "Allow authenticated upload chat attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments');

-- Performance Indices
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_fts ON public.messages USING GIN (fts);
CREATE INDEX IF NOT EXISTS idx_conversation_members_profile_id ON public.conversation_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_conversation_links_entity ON public.conversation_links(entity_type, entity_id);
