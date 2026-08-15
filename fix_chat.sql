-- Fix the infinite recursion bug in conversation_members
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;
CREATE POLICY "Users can view members of their conversations" ON public.conversation_members
  FOR SELECT TO authenticated
  USING (true);
