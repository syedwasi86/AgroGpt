import { db, type ProfileRecord } from './db'
import { supabase } from '../core/auth/supabaseClient'

export const profileRepository = {
  /**
   * Retrieves the profile matching the currently authenticated Supabase user ID.
   */
  async getCurrentProfile(): Promise<ProfileRecord | null> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) return null
    return (await db.profiles.get(session.user.id)) || null
  },

  /**
   * Retrieves the profile matching the provided user ID.
   */
  async getProfileByUserId(userId: string): Promise<ProfileRecord | null> {
    return (await db.profiles.get(userId)) || null
  },

  /**
   * Updates coordinates, location parameters or metadata for the user profile.
   */
  async updateProfile(userId: string, data: Partial<ProfileRecord>): Promise<number> {
    const versionUpdate = data.version !== undefined ? data.version : undefined
    return db.profiles.update(userId, {
      ...data,
      version: versionUpdate,
      updated_at: new Date().toISOString(),
      sync_status: 'pending'
    })
  }
}
