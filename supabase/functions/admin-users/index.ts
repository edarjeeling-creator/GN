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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
    if (profileError || !['admin', 'superadmin', 'principal'].includes(profile?.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden. Requires Administrator or Principal privileges.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { action, payload } = await req.json()
    let result = {}

    // Helper to log security events
    const logSecurityEvent = async (eventType: string, targetId: string | null, details: any) => {
      await supabaseAdmin.from('security_events').insert([{
        event_type: eventType,
        actor_id: user.id,
        target_id: targetId,
        details,
        ip_address: req.headers.get('x-forwarded-for') || 'unknown'
      }]).catch(() => {})
    }

    const allowedRoles = ['teacher', 'admin', 'principal', 'accountant', 'librarian', 'coordinator', 'non_teaching', 'group_d', 'staff']

    if (action === 'createUser') {
      const { email, password, name, role = 'teacher', campus = '', status = 'Active', employee_id, school_id } = payload
      
      if (!email || !password || !name) {
        throw new Error('Name, email, and password are required.')
      }

      if (!allowedRoles.includes(role)) {
        throw new Error(`Invalid role. Allowed roles are: ${allowedRoles.join(', ')}`)
      }

      // Role Escalation Protection
      if (role === 'admin' && profile.role !== 'superadmin') {
        await logSecurityEvent('UnauthorizedEscalation', null, { attempted_role: 'admin' })
        throw new Error('Only a Super Administrator can create new Administrators.')
      }
      if (role === 'superadmin') {
        throw new Error('Cannot create Super Administrators via UI.')
      }
      
      const cleanEmail = email.trim().toLowerCase()
      const cleanName = name.trim()

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: password.trim(),
        email_confirm: true,
        user_metadata: { name: cleanName, full_name: cleanName, role, campus }
      })
      if (createError) throw createError

      const { error: profileInsertError } = await supabaseAdmin.from('profiles').upsert([{
        id: newUser.user.id,
        name: cleanName,
        email: cleanEmail,
        role,
        campus,
        status,
        employee_id: employee_id || null,
        school_id: school_id || 'd3b07384-d113-4956-a5ec-9af2c61146e5'
      }])
      if (profileInsertError) throw profileInsertError

      await supabaseAdmin.from('user_management_audit_logs').insert([{
        admin_id: user.id,
        target_user_id: newUser.user.id,
        action: 'USER_CREATED',
        new_value: { email: cleanEmail, role, name: cleanName, campus, status }
      }]).catch(() => {})
      
      result = { success: true, message: `User "${cleanName}" created successfully`, user: { id: newUser.user.id, email: cleanEmail, name: cleanName, role, campus, status } }

    } else if (action === 'updateUser') {
      const { targetUserId, updates } = payload
      if (!targetUserId) throw new Error('targetUserId is required.')

      // Role Escalation Protection
      if (updates.role === 'admin' && profile.role !== 'superadmin') {
        throw new Error('Only a Super Administrator can promote a user to Administrator.')
      }

      const { data: prevProfile } = await supabaseAdmin.from('profiles').select('*').eq('id', targetUserId).single()
      const { data: prevAuthUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId)

      if (updates.email && updates.email.trim().toLowerCase() !== prevAuthUser?.user?.email?.toLowerCase()) {
        const cleanEmail = updates.email.trim().toLowerCase()
        const { error: emailUpdateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { email: cleanEmail })
        if (emailUpdateError) throw emailUpdateError
      }

      const profileUpdates: any = {}
      if (updates.name !== undefined) profileUpdates.name = updates.name.trim()
      if (updates.email !== undefined) profileUpdates.email = updates.email.trim().toLowerCase()
      if (updates.role !== undefined) profileUpdates.role = updates.role
      if (updates.campus !== undefined) profileUpdates.campus = updates.campus
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
        admin_id: user.id,
        target_user_id: targetUserId,
        action: 'USER_UPDATED',
        previous_value: { email: prevAuthUser?.user?.email, ...prevProfile },
        new_value: profileUpdates
      }]).catch(() => {})

      result = { success: true, message: 'User updated successfully' }

    } else if (action === 'updateCredentials' || action === 'admin_update_user_credentials') {
      const { targetUserId, name, email, password } = payload
      if (!targetUserId) throw new Error('targetUserId is required.')

      const updates: any = {}
      if (email && email.trim()) {
        updates.email = email.trim().toLowerCase()
      }
      if (password && password.trim()) {
        updates.password = password.trim()
      }
      if (name && name.trim()) {
        updates.user_metadata = { name: name.trim(), full_name: name.trim() }
      }

      if (Object.keys(updates).length > 0) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, updates)
        if (authError) throw authError
      }

      const profileUpdates: any = {}
      if (name && name.trim()) profileUpdates.name = name.trim()
      if (email && email.trim()) profileUpdates.email = email.trim().toLowerCase()

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profError } = await supabaseAdmin.from('profiles').update(profileUpdates).eq('id', targetUserId)
        if (profError) throw profError
      }

      await supabaseAdmin.from('user_management_audit_logs').insert([{
        admin_id: user.id,
        target_user_id: targetUserId,
        action: 'CREDENTIALS_UPDATED',
        new_value: {
          name_updated: !!(name && name.trim()),
          email_updated: !!(email && email.trim()),
          password_reset: !!(password && password.trim())
        }
      }]).catch(() => {})

      result = { success: true, message: 'User credentials updated successfully' }

    } else if (action === 'resetPassword') {
      const { targetUserId, tempPassword } = payload
      if (!targetUserId || !tempPassword) throw new Error('Target user ID and password are required.')
      
      const { error: passError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password: tempPassword })
      if (passError) throw passError

      await supabaseAdmin.from('user_management_audit_logs').insert([{
        admin_id: user.id, target_user_id: targetUserId, action: 'PASSWORD_RESET', new_value: { method: 'admin_reset' }
      }]).catch(() => {})
      
      await logSecurityEvent('PasswordReset', targetUserId, { method: 'admin_reset' })

      result = { success: true, message: 'Password reset successfully' }

    } else if (action === 'deactivateUser') {
      const { targetUserId } = payload
      if (!targetUserId) throw new Error('Target user ID is required.')

      if (targetUserId === user.id) {
        throw new Error('Safety protection: You cannot deactivate your own active account.')
      }

      const { data: targetProfile } = await supabaseAdmin.from('profiles').select('role, name').eq('id', targetUserId).single()
      if (targetProfile?.role === 'superadmin') {
        throw new Error('Safety protection: Super Administrator accounts cannot be deactivated.')
      }

      const { error: statusError } = await supabaseAdmin.from('profiles').update({ status: 'Inactive' }).eq('id', targetUserId)
      if (statusError) throw statusError

      await supabaseAdmin.from('user_management_audit_logs').insert([{
        admin_id: user.id, target_user_id: targetUserId, action: 'USER_DEACTIVATED',
        new_value: { status: 'Inactive', target_name: targetProfile?.name }
      }]).catch(() => {})
      
      await logSecurityEvent('UserDeactivated', targetUserId, { name: targetProfile?.name })

      result = { success: true, message: `User "${targetProfile?.name || ''}" has been deactivated successfully.` }

    } else if (action === 'reactivateUser') {
      const { targetUserId } = payload
      if (!targetUserId) throw new Error('Target user ID is required.')

      const { data: targetProfile } = await supabaseAdmin.from('profiles').select('name').eq('id', targetUserId).single()

      const { error: statusError } = await supabaseAdmin.from('profiles').update({ status: 'Active' }).eq('id', targetUserId)
      if (statusError) throw statusError

      await supabaseAdmin.from('user_management_audit_logs').insert([{
        admin_id: user.id, target_user_id: targetUserId, action: 'USER_REACTIVATED',
        new_value: { status: 'Active', target_name: targetProfile?.name }
      }]).catch(() => {})
      
      await logSecurityEvent('UserReactivated', targetUserId, { name: targetProfile?.name })

      result = { success: true, message: `User "${targetProfile?.name || ''}" has been reactivated successfully.` }

    } else if (action === 'deleteUser') {
      const { targetUserId } = payload
      if (!targetUserId) throw new Error('Target user ID is required.')

      if (profile.role !== 'superadmin' && profile.role !== 'admin') {
        throw new Error('Forbidden. Only administrators can delete user accounts.')
      }

      if (targetUserId === user.id) {
        throw new Error('Safety protection: You cannot delete your own active account.')
      }

      // Check dependent records: marks, attendance, teaching assignments
      const { count: marksCount } = await supabaseAdmin.from('marks').select('*', { count: 'exact', head: true }).eq('teacher_id', targetUserId)
      const { count: classTeacherCount } = await supabaseAdmin.from('classes').select('*', { count: 'exact', head: true }).eq('class_teacher_id', targetUserId)
      const { count: assignmentCount } = await supabaseAdmin.from('teacher_subjects').select('*', { count: 'exact', head: true }).eq('teacher_id', targetUserId)

      if ((marksCount && marksCount > 0) || (classTeacherCount && classTeacherCount > 0) || (assignmentCount && assignmentCount > 0)) {
        throw new Error(`Cannot permanently delete this user because they have active academic/teaching records (${marksCount || 0} marks, ${classTeacherCount || 0} classes assigned). Please Deactivate the user instead to preserve audit history.`)
      }

      const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', targetUserId)
      if (profileDeleteError) throw profileDeleteError

      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)
      if (authDeleteError) throw authDeleteError

      await supabaseAdmin.from('user_management_audit_logs').insert([{
        admin_id: user.id, target_user_id: targetUserId, action: 'USER_DELETED',
        new_value: { deleted_user_id: targetUserId }
      }]).catch(() => {})

      result = { success: true, message: 'User permanently deleted successfully.' }

    } else {
      throw new Error(`Unknown action: ${action}`)
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
