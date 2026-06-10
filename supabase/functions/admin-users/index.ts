import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
    if (profileError || !['admin', 'superadmin'].includes(profile?.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden. Requires Administrator privileges.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { action, payload } = await req.json()
    let result = {}

    // Helper to log security events
    const logSecurityEvent = async (eventType: string, targetId: string, details: any) => {
      await supabaseAdmin.from('security_events').insert([{
        event_type: eventType,
        actor_id: user.id,
        target_id: targetId,
        details,
        ip_address: req.headers.get('x-forwarded-for') || 'unknown'
      }])
    }

    if (action === 'createUser') {
      const { email, password, name, role, employee_id, school_id, uid } = payload
      
      // Role Escalation Protection
      if (role === 'admin' && profile.role !== 'superadmin') {
        await logSecurityEvent('UnauthorizedEscalation', null, { attempted_role: 'admin' })
        throw new Error('Only a Super Administrator can create new Administrators.')
      }
      if (role === 'superadmin') {
        throw new Error('Cannot create Super Administrators via UI.')
      }
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { name, role }
      })
      if (createError) throw createError

      const { error: profileInsertError } = await supabaseAdmin.from('profiles').insert([{
        id: newUser.user.id, name, role, employee_id, uid, school_id
      }])
      if (profileInsertError) throw profileInsertError

      await supabaseAdmin.from('user_management_audit_logs').insert([{
        admin_id: user.id, target_user_id: newUser.user.id, action: 'CREATED', new_value: { email, role, name, employee_id, uid }
      }])
      
      result = { message: 'User created successfully', user: newUser.user }

    } else if (action === 'updateUser') {
      const { targetUserId, updates } = payload
      
      // Role Escalation Protection
      if (updates.role === 'admin' && profile.role !== 'superadmin') {
        throw new Error('Only a Super Administrator can promote a user to Administrator.')
      }

      const { data: prevProfile } = await supabaseAdmin.from('profiles').select('*').eq('id', targetUserId).single()
      const { data: prevAuthUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId)

      if (updates.email) {
        const { error: emailUpdateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { email: updates.email })
        if (emailUpdateError) throw emailUpdateError
      }

      const profileUpdates: any = {}
      if (updates.name !== undefined) profileUpdates.name = updates.name
      if (updates.role !== undefined) profileUpdates.role = updates.role
      if (updates.status !== undefined) profileUpdates.status = updates.status
      if (updates.employee_id !== undefined) profileUpdates.employee_id = updates.employee_id

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileUpdateError } = await supabaseAdmin.from('profiles').update(profileUpdates).eq('id', targetUserId)
        if (profileUpdateError) throw profileUpdateError
      }

      if (updates.role !== undefined && updates.role !== prevProfile?.role) {
        await logSecurityEvent('RoleChange', targetUserId, { previous: prevProfile?.role, new: updates.role })
      }

      await supabaseAdmin.from('user_management_audit_logs').insert([{
        admin_id: user.id, target_user_id: targetUserId, action: 'UPDATED',
        previous_value: { email: prevAuthUser?.user?.email, ...prevProfile }, new_value: updates
      }])

      result = { message: 'User updated successfully' }

    } else if (action === 'resetPassword') {
      const { targetUserId, tempPassword } = payload
      
      const { error: passError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password: tempPassword })
      if (passError) throw passError
      
      await supabaseAdmin.from('profiles').update({ uid: tempPassword }).eq('id', targetUserId)

      await supabaseAdmin.from('user_management_audit_logs').insert([{
        admin_id: user.id, target_user_id: targetUserId, action: 'PASSWORD_RESET', new_value: { method: 'temporary_password' }
      }])
      
      await logSecurityEvent('PasswordReset', targetUserId, { method: 'temporary_password' })

      result = { message: 'Password reset successfully' }

    } else if (action === 'deactivateUser') {
      const { targetUserId, newStatus } = payload
      
      if (newStatus === 'Active' && profile.role !== 'superadmin') {
         // Optionally restrict restoring archived accounts to superadmin
         const { data: targetProfile } = await supabaseAdmin.from('profiles').select('status').eq('id', targetUserId).single()
         if (targetProfile?.status === 'Archived') {
             throw new Error('Only a Super Administrator can restore an archived account.')
         }
      }

      const { error: statusError } = await supabaseAdmin.from('profiles').update({ status: newStatus }).eq('id', targetUserId)
      if (statusError) throw statusError

      await supabaseAdmin.from('user_management_audit_logs').insert([{
        admin_id: user.id, target_user_id: targetUserId, action: newStatus === 'Active' ? 'REACTIVATED' : (newStatus === 'Archived' ? 'ARCHIVED' : 'STATUS_CHANGED'),
        new_value: { status: newStatus }
      }])
      
      await logSecurityEvent(newStatus === 'Suspended' ? 'Suspension' : 'StatusChange', targetUserId, { status: newStatus })

      result = { message: `User status changed to ${newStatus}` }

    } else {
      throw new Error(`Unknown action: ${action}`)
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
