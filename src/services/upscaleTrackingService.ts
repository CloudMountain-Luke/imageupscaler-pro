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

interface UpscaleTransaction {
  user_id: string;
  scale_factor: 2 | 4 | 8;
  quality_preset: string;
  api_cost: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'queued';
  original_image_url?: string;
  upscaled_image_url?: string;
  processing_time_seconds?: number;
  error_message?: string;
}

interface ApiUsageLog {
  transaction_id: string;
  api_provider: string;
  api_endpoint: string;
  request_payload: any;
  response_data: any;
  http_status_code: number;
  processing_time_ms: number;
  api_cost: number;
  credits_consumed: number;
}

interface SystemAlert {
  alert_type: 'low_credits' | 'api_outage' | 'high_usage' | 'billing_issue' | 'system_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata?: any;
}

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

  static async checkApiCredits() {
    try {
      const { data, error } = await supabase
        .from('api_credit_monitoring')
        .select('current_balance, threshold_warning, threshold_critical')
        .eq('provider', 'replicate')
        .maybeSingle();

      if (error) {
        console.warn('Error checking API credits:', error);
        // Return default values if table doesn't exist or has issues
        return {
          current_balance: 100,
          threshold_warning: 50,
          threshold_critical: 10,
          severity: 'low' as const
        };
      }

      const balance = data?.current_balance ?? 100;
      const warning = data?.threshold_warning ?? 50;
      const critical = data?.threshold_critical ?? 10;

      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (balance <= critical) {
        severity = 'critical';
      } else if (balance <= warning) {
        severity = 'medium';
      }

      return {
        current_balance: balance,
        threshold_warning: warning,
        threshold_critical: critical,
        severity
      };
    } catch (error) {
      console.error('Error in checkApiCredits:', error);
      return {
        current_balance: 100,
        threshold_warning: 50,
        threshold_critical: 10,
        severity: 'low' as const
      };
    }
  }

  static async createUpscaleTransaction(transaction: UpscaleTransaction): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('upscale_transactions')
        .insert({
          user_id: transaction.user_id,
          scale_factor: transaction.scale_factor,
          quality_preset: transaction.quality_preset,
          api_cost: transaction.api_cost,
          status: transaction.status,
          original_image_url: transaction.original_image_url,
          upscaled_image_url: transaction.upscaled_image_url,
          processing_time_seconds: transaction.processing_time_seconds,
          error_message: transaction.error_message
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating upscale transaction:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Error in createUpscaleTransaction:', error);
      return null;
    }
  }

  static async updateUpscaleTransaction(transactionId: string, updates: Partial<UpscaleTransaction>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('upscale_transactions')
        .update(updates)
        .eq('id', transactionId);

      if (error) {
        console.error('Error updating upscale transaction:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateUpscaleTransaction:', error);
      return false;
    }
  }

  static async logApiUsage(usage: ApiUsageLog): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('api_usage_logs')
        .insert({
          transaction_id: usage.transaction_id,
          api_provider: usage.api_provider,
          api_endpoint: usage.api_endpoint,
          request_payload: usage.request_payload,
          response_data: usage.response_data,
          http_status_code: usage.http_status_code,
          processing_time_ms: usage.processing_time_ms,
          api_cost: usage.api_cost,
          credits_consumed: usage.credits_consumed
        });

      if (error) {
        console.error('Error logging API usage:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in logApiUsage:', error);
      return false;
    }
  }

  static async updateApiCredits(newBalance: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('api_credit_monitoring')
        .update({ 
          current_balance: newBalance,
          last_balance_check: new Date().toISOString()
        })
        .eq('provider', 'replicate');

      if (error) {
        console.error('Error updating API credits:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateApiCredits:', error);
      return false;
    }
  }

  static async createAlert(alert: SystemAlert): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('system_alerts')
        .insert({
          alert_type: alert.alert_type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          metadata: alert.metadata || {}
        });

      if (error) {
        console.error('Error creating system alert:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in createAlert:', error);
      return false;
    }
  }

  static async addToQueue(userId: string, transactionId: string, priority: number = 1): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('upscale_queue')
        .insert({
          user_id: userId,
          transaction_id: transactionId,
          priority: priority,
          status: 'queued'
        });

      if (error) {
        console.error('Error adding to queue:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in addToQueue:', error);
      return false;
    }
  }

  static async getQueuedItems(limit: number = 10) {
    try {
      const { data, error } = await supabase
        .from('upscale_queue')
        .select(`
          *,
          upscale_transactions (
            id,
            scale_factor,
            quality_preset,
            original_image_url
          )
        `)
        .eq('status', 'queued')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error getting queued items:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getQueuedItems:', error);
      return [];
    }
  }

  static async getUserTransactionHistory(userId: string, limit: number = 10) {
    try {
      const { data, error } = await supabase
        .from('upscale_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting user transaction history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserTransactionHistory:', error);
      return [];
    }
  }

  // Add supabase property for compatibility with enhanced service
  static supabase = supabase;

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

  // Instance methods for compatibility with enhanced service
  async checkApiCredits() {
    return await UpscaleTrackingService.checkApiCredits();
  }

  async createUpscaleTransaction(transaction: UpscaleTransaction): Promise<string | null> {
    return await UpscaleTrackingService.createUpscaleTransaction(transaction);
  }

  async updateUpscaleTransaction(transactionId: string, updates: Partial<UpscaleTransaction>): Promise<boolean> {
    return await UpscaleTrackingService.updateUpscaleTransaction(transactionId, updates);
  }

  async logApiUsage(usage: ApiUsageLog): Promise<boolean> {
    return await UpscaleTrackingService.logApiUsage(usage);
  }

  async updateApiCredits(newBalance: number): Promise<boolean> {
    return await UpscaleTrackingService.updateApiCredits(newBalance);
  }

  async createAlert(alert: SystemAlert): Promise<boolean> {
    return await UpscaleTrackingService.createAlert(alert);
  }

  async addToQueue(userId: string, transactionId: string, priority: number = 1): Promise<boolean> {
    return await UpscaleTrackingService.addToQueue(userId, transactionId, priority);
  }

  async getQueuedItems(limit: number = 10) {
    return await UpscaleTrackingService.getQueuedItems(limit);
  }

  async getUserTransactionHistory(userId: string, limit: number = 10) {
    return await UpscaleTrackingService.getUserTransactionHistory(userId, limit);
  }
}

export const upscaleTrackingService = new UpscaleTrackingService();