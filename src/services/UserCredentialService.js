import { supabase } from '../lib/supabase';

/**
 * Service to manage staff lifecycle and credentials:
 * - Create User
 * - Edit User (Name, Email, Role, Campus, Status)
 * - Reset Password (Credentials)
 * - Deactivate / Reactivate User
 * - Safe Permanent Delete (Blocked if historical records exist)
 *
 * Employs dual-layer resilience:
 * Tries server-side Edge Function first, then falls back seamlessly to Postgres RPC.
 */
export const UserCredentialService = {
  /**
   * Generates a memorable secure password for staff
   * Format: Prefix + SpecialChar + 4-digit number (e.g. Gyanoday@4821)
   */
  generateRandomPassword() {
    const prefixes = ['Gyanoday', 'Niketan', 'School', 'Teacher', 'Campus', 'Academy', 'Staff'];
    const specialChars = ['@', '#', '$', '!'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const special = specialChars[Math.floor(Math.random() * specialChars.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${special}${num}`;
  },

  /**
   * Fetches staff directory with roles, campuses, emails, and active/inactive status
   */
  async fetchStaffDirectory() {
    try {
      // 1. Try server-side helper RPC which joins profiles and auth.users
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_staff_credentials_directory');
      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        return { success: true, data: rpcData };
      }

      // 2. Fallback to standard profiles query
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['teacher', 'principal', 'accountant', 'librarian', 'coordinator', 'admin'])
        .order('name');

      if (profError) throw profError;
      return { success: true, data: profiles || [] };
    } catch (err) {
      console.error('Failed to fetch staff directory:', err);
      return { success: false, error: err.message, data: [] };
    }
  },

  /**
   * Create a new staff account
   */
  async createUser({ name, email, password, role = 'teacher', campus = 'Senior School', status = 'Active' }) {
    const cleanName = name?.trim();
    const cleanEmail = email?.trim().toLowerCase();
    const cleanPassword = password?.trim();

    if (!cleanName || !cleanEmail || !cleanPassword) {
      return { success: false, error: 'Full Name, Login Email, and Password are required.' };
    }
    if (!cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (cleanPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    // 1. Attempt via Edge Function
    try {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'createUser',
          payload: {
            name: cleanName,
            email: cleanEmail,
            password: cleanPassword,
            role,
            campus,
            status
          }
        }
      });

      if (!edgeError && edgeData && (edgeData.success || edgeData.message)) {
        return {
          success: true,
          message: edgeData.message || `User "${cleanName}" created successfully.`,
          user: edgeData.user
        };
      }
    } catch (edgeErr) {
      console.warn('Edge function createUser failed, attempting database RPC fallback:', edgeErr.message);
    }

    // 2. Fallback to Database RPC
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_create_user', {
        p_email: cleanEmail,
        p_password: cleanPassword,
        p_name: cleanName,
        p_role: role,
        p_campus: campus,
        p_status: status
      });

      if (rpcError) throw new Error(rpcError.message || 'Database error creating user');
      if (rpcData && rpcData.success === false) throw new Error(rpcData.error || 'Failed to create user');

      return {
        success: true,
        message: rpcData?.message || `User "${cleanName}" created successfully in database.`,
        user_id: rpcData?.user_id
      };
    } catch (rpcErr) {
      console.error('Create user error:', rpcErr);
      let msg = rpcErr.message || 'Failed to create user.';
      if (msg.includes('duplicate key') || msg.includes('already exists')) {
        msg = `An account with email "${cleanEmail}" already exists.`;
      }
      return { success: false, error: msg };
    }
  },

  /**
   * Edit existing staff profile (Name, Email, Role, Campus, Status)
   */
  async updateUser({ targetUserId, name, email, role, campus, status }) {
    if (!targetUserId) return { success: false, error: 'Target user ID is required.' };

    const cleanName = name?.trim();
    const cleanEmail = email?.trim().toLowerCase();

    // 1. Attempt via Edge Function
    try {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'updateUser',
          payload: {
            targetUserId,
            updates: {
              name: cleanName,
              email: cleanEmail,
              role,
              campus,
              status
            }
          }
        }
      });

      if (!edgeError && edgeData && (edgeData.success || edgeData.message)) {
        return { success: true, message: edgeData.message || 'User updated successfully.' };
      }
    } catch (edgeErr) {
      console.warn('Edge function updateUser failed, attempting database RPC fallback:', edgeErr.message);
    }

    // 2. Fallback to Database RPC
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_update_user', {
        p_user_id: targetUserId,
        p_name: cleanName || null,
        p_email: cleanEmail || null,
        p_role: role || null,
        p_campus: campus || null,
        p_status: status || null
      });

      if (rpcError) throw new Error(rpcError.message || 'Database error updating user');
      if (rpcData && rpcData.success === false) throw new Error(rpcData.error || 'Failed to update user');

      return { success: true, message: rpcData?.message || 'User updated successfully.' };
    } catch (rpcErr) {
      console.error('Update user error:', rpcErr);
      return { success: false, error: rpcErr.message || 'Failed to update user.' };
    }
  },

  /**
   * Explicit password reset / credential update
   */
  async updateStaffCredentials({ targetUserId, name, email, password }) {
    if (!targetUserId) return { success: false, error: 'Target user ID is missing.' };

    const trimmedName = name?.trim() || null;
    const trimmedEmail = email?.trim().toLowerCase() || null;
    const trimmedPassword = password?.trim() || null;

    if (!trimmedName && !trimmedEmail && !trimmedPassword) {
      return { success: false, error: 'No changes provided. Enter a new Name, Email, or Password.' };
    }

    if (trimmedPassword && trimmedPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    // 1. Attempt via Edge Function
    try {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'updateCredentials',
          payload: { targetUserId, name: trimmedName, email: trimmedEmail, password: trimmedPassword }
        }
      });

      if (!edgeError && edgeData && (edgeData.success || edgeData.message)) {
        return { success: true, message: edgeData.message || 'Credentials updated successfully.' };
      }
    } catch (edgeErr) {
      console.warn('Edge function updateCredentials failed, falling back to database RPC:', edgeErr.message);
    }

    // 2. Fallback to Database RPC
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_update_user_credentials', {
        p_user_id: targetUserId,
        p_new_name: trimmedName,
        p_new_email: trimmedEmail,
        p_new_password: trimmedPassword
      });

      if (rpcError) throw new Error(rpcError.message || 'Database RPC error');
      if (rpcData && rpcData.success === false) throw new Error(rpcData.error || 'Failed to update credentials.');

      return { success: true, message: rpcData?.message || 'Credentials updated successfully.' };
    } catch (rpcErr) {
      console.error('Credential update error:', rpcErr);
      return { success: false, error: rpcErr.message || 'Unable to update credentials.' };
    }
  },

  /**
   * Deactivate a staff account (Soft Delete: preserves all marks, attendance, and reports)
   */
  async deactivateUser(targetUserId) {
    if (!targetUserId) return { success: false, error: 'Target user ID required.' };

    try {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: { action: 'deactivateUser', payload: { targetUserId } }
      });

      if (!edgeError && edgeData && (edgeData.success || edgeData.message)) {
        return { success: true, message: edgeData.message || 'User deactivated successfully.' };
      }
    } catch (edgeErr) {
      console.warn('Edge function deactivateUser failed, falling back to database RPC:', edgeErr.message);
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_set_user_status', {
        p_user_id: targetUserId,
        p_status: 'Inactive'
      });

      if (rpcError) throw new Error(rpcError.message || 'Database RPC error');
      if (rpcData && rpcData.success === false) throw new Error(rpcData.error || 'Failed to deactivate user.');

      return { success: true, message: rpcData?.message || 'User deactivated successfully.' };
    } catch (rpcErr) {
      console.error('Deactivation error:', rpcErr);
      return { success: false, error: rpcErr.message || 'Failed to deactivate user.' };
    }
  },

  /**
   * Reactivate a previously deactivated staff account
   */
  async reactivateUser(targetUserId) {
    if (!targetUserId) return { success: false, error: 'Target user ID required.' };

    try {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: { action: 'reactivateUser', payload: { targetUserId } }
      });

      if (!edgeError && edgeData && (edgeData.success || edgeData.message)) {
        return { success: true, message: edgeData.message || 'User reactivated successfully.' };
      }
    } catch (edgeErr) {
      console.warn('Edge function reactivateUser failed, falling back to database RPC:', edgeErr.message);
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_set_user_status', {
        p_user_id: targetUserId,
        p_status: 'Active'
      });

      if (rpcError) throw new Error(rpcError.message || 'Database RPC error');
      if (rpcData && rpcData.success === false) throw new Error(rpcData.error || 'Failed to reactivate user.');

      return { success: true, message: rpcData?.message || 'User reactivated successfully.' };
    } catch (rpcErr) {
      console.error('Reactivation error:', rpcErr);
      return { success: false, error: rpcErr.message || 'Failed to reactivate user.' };
    }
  },

  /**
   * Permanently delete account (Strictly protected: blocked if historical records exist)
   */
  async deleteUserPermanently(targetUserId) {
    if (!targetUserId) return { success: false, error: 'Target user ID required.' };

    try {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: { action: 'deleteUser', payload: { targetUserId } }
      });

      if (!edgeError && edgeData && (edgeData.success || edgeData.message)) {
        return { success: true, message: edgeData.message || 'User deleted successfully.' };
      }
    } catch (edgeErr) {
      console.warn('Edge function deleteUser failed, falling back to database RPC:', edgeErr.message);
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_delete_user_safe', {
        p_user_id: targetUserId
      });

      if (rpcError) throw new Error(rpcError.message || 'Database RPC error');
      if (rpcData && rpcData.success === false) throw new Error(rpcData.error || 'Failed to delete user.');

      return { success: true, message: rpcData?.message || 'User permanently deleted successfully.' };
    } catch (rpcErr) {
      console.error('Permanent delete error:', rpcErr);
      return { success: false, error: rpcErr.message || 'Failed to delete user.' };
    }
  }
};
