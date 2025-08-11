import { supabase } from '../lib/supabaseClient';
import type { PostgrestError } from '@supabase/supabase-js';

export type UserProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  credits_remaining: number | null;
  current_month_upscales?: number | null;
  monthly_upscales_limit?: number | null;
  subscription_tier_id: string | null;
  subscription_tiers?: {
    name: string;
    monthly_upscales: number | null;
    monthly_price: number | null;
  } | null;
};

export class UpscaleTrackingService {
  // Helper method to ensure user is authenticated
  private static async getAuthenticatedUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User not authenticated');
    }
    return user;
  }

  static async getUserProfile(userId: string): Promise<UserProfile> {
    // 1) Use maybeSingle() to avoid 406 when no rows
    const { data, error } = await supabase
      .from('user_profiles')
      .select(
        'id,email,display_name,credits_remaining,subscription_tier_id,current_month_upscales,monthly_upscales_limit,subscription_tiers!user_profiles_subscription_tier_id_fkey(name,monthly_upscales,monthly_price)'
      )
      .eq('id', userId)
      .maybeSingle();

    if (error && (error as PostgrestError).code !== 'PGRST116') {
      throw error;
    }

    // 2) If profile is missing, auto-create a default
    if (!data) {
      console.warn('No user profile found in database for user:', userId);
      // Return a default profile structure
      return {
        id: userId,
        email: null,
        display_name: null,
        credits_remaining: 250,
        subscription_tier_id: null,
        current_month_upscales: 0,
        monthly_upscales_limit: 250,
        subscription_tiers: null
      };
    }

    return data as UserProfile;
  }

  // Creates a default profile and returns it. Safe to call repeatedly.
  static async ensureDefaultProfile(userId: string): Promise<UserProfile> {
    // Ensure user is authenticated before proceeding
    const authenticatedUser = await UpscaleTrackingService.getAuthenticatedUser();
    
    // Verify the requested userId matches the authenticated user
    if (authenticatedUser.id !== userId) {
      throw new Error('Unauthorized: Cannot create profile for other users');
    }

    // Optional: look up "free" tier id; otherwise leave null
    const { data: freeTier } = await supabase
      .from('subscription_tiers')
      .select('id,name,monthly_upscales,monthly_price')
      .eq('name', 'free')
      .maybeSingle();

    const insertPayload: Partial<UserProfile> = {
      id: authenticatedUser.id, // Use authenticated user's ID
      email: authenticatedUser.email,
      display_name: authenticatedUser.user_metadata?.name || authenticatedUser.email?.split('@')[0] || null,
      credits_remaining: 250,
      subscription_tier_id: freeTier?.id ?? null,
    };

    const { error: upsertErr } = await supabase
      .from('user_profiles')
      .upsert(insertPayload, { onConflict: 'id' });

    if (upsertErr) throw upsertErr;

    const { data: profile, error: fetchErr } = await supabase
      .from('user_profiles')
      .select(
        'id,email,display_name,credits_remaining,subscription_tier_id,subscription_tiers!user_profiles_subscription_tier_id_fkey(name,monthly_upscales,monthly_price)'
      )
      .eq('id', authenticatedUser.id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!profile) throw new Error('Failed to create default profile');
    return profile as UserProfile;
  }

  static currentMonthRange(): { start: string; end: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  static async getUserUsageStats(userId: string) {
    try {
      // Ensure profile exists and is returned
      const profile = await UpscaleTrackingService.getUserProfile(userId);

      // Use the values directly from the user profile
      const usedThisMonth = profile.current_month_upscales ?? 0;
      const monthlyLimit = profile.monthly_upscales_limit ?? profile.subscription_tiers?.monthly_upscales ?? profile.credits_remaining ?? 250;
      const usagePercentage = monthlyLimit > 0 ? Math.round((usedThisMonth / monthlyLimit) * 100) : 0;
      
      // Calculate days until reset (end of current month)
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const daysUntilReset = Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return { 
        usedThisMonth, 
        monthlyLimit,
        current_month_upscales: usedThisMonth,
        monthly_upscales_limit: monthlyLimit,
        total_upscales: usedThisMonth, // For now, same as monthly
        usage_percentage: usagePercentage,
        days_until_reset: Math.max(0, daysUntilReset),
        estimated_monthly_cost: usedThisMonth * 0.0055
      };
    } catch (error) {
      // Never crash - return safe defaults
      console.error('Error in getUserUsageStats:', error);
      return {
        usedThisMonth: 0,
        monthlyLimit: 100,
        current_month_upscales: 0,
        monthly_upscales_limit: 100,
        total_upscales: 0,
        usage_percentage: 0,
        days_until_reset: 30,
        estimated_monthly_cost: 0
      };
    }
  }

  // Legacy methods for backward compatibility
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      return await UpscaleTrackingService.getUserProfile(userId);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  async getUserUsageStats(userId: string) {
    return await UpscaleTrackingService.getUserUsageStats(userId);
  }

  async checkUserCanUpscale(userId: string): Promise<{
    canUpscale: boolean;
    reason?: string;
    remainingUpscales?: number;
  }> {
    try {
      // Ensure user is authenticated before proceeding
      await UpscaleTrackingService.getAuthenticatedUser();

      const stats = await UpscaleTrackingService.getUserUsageStats(userId);
      const remaining = stats.monthlyLimit - stats.usedThisMonth;
      
      if (remaining <= 0) {
        return { 
          canUpscale: false, 
          reason: 'Monthly upscale limit reached',
          remainingUpscales: 0
        };
      }

      return { 
        canUpscale: true, 
        remainingUpscales: remaining 
      };
    } catch (error) {
      console.error('Error checking user upscale eligibility:', error);
      return { canUpscale: false, reason: 'System error' };
    }
  }
}

export const upscaleTrackingService = new UpscaleTrackingService();