-- Drop the old policy
DROP POLICY IF EXISTS "Users can view conversations they are members of" ON public.conversations;

-- Create the new policy that also allows the creator to select the conversation
CREATE POLICY "Users can view conversations they are members of or created" ON public.conversations
  FOR SELECT TO authenticated
  USING (
    visibility = 'public' 
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_members cm 
      WHERE cm.conversation_id = id AND cm.profile_id = auth.uid()
    )
  );
