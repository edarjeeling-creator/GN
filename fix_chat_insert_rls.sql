-- 1. Insert Policy for Conversations
DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
CREATE POLICY "Users can insert conversations" 
ON public.conversations
FOR INSERT 
TO authenticated
WITH CHECK (created_by = auth.uid());

-- 2. Insert Policy for Conversation Members
DROP POLICY IF EXISTS "Users can insert conversation members" ON public.conversation_members;
CREATE POLICY "Users can insert conversation members" 
ON public.conversation_members
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = conversation_id AND c.created_by = auth.uid()
  )
);
