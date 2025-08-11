// Enhanced Upscale Service with Tracking Integration
// Combines AI upscaling with comprehensive usage tracking and billing management

import { upscaleTrackingService } from './upscaleTrackingService';
import { edgeFunctionService } from './edgeFunctionService';
import { replicateService } from './replicateService';

interface UpscaleRequest {
  userId: string;
  image: File;
  scale: number;
  quality: 'photo' | 'art' | 'anime' | 'text';
  outputFormat?: string;
}

interface UpscaleResult {
  success: boolean;
  transactionId?: string;
  imageUrl?: string;
  error?: string;
  processingTime?: number;
  apiCost?: number;
  remainingUpscales?: number;
  usageWarning?: string;
}

interface QueueStatus {
  position: number;
  estimatedWaitTime: number;
  isQueued: boolean;
}

export class EnhancedUpscaleService {
  private readonly REPLICATE_COST_PER_UPSCALE = 0.0055;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly QUEUE_RETRY_DELAY = 5000; // 5 seconds

  async upscaleImage(request: UpscaleRequest): Promise<UpscaleResult> {
    try {
      // Step 1: Check user eligibility
      const eligibility = await upscaleTrackingService.checkUserCanUpscale(request.userId);
      
      if (!eligibility.canUpscale) {
        return {
          success: false,
          error: eligibility.reason || 'Cannot process upscale request'
        };
      }

      // Step 2: Check API credits
      const creditStatus = await upscaleTrackingService.checkApiCredits();
      
      if (creditStatus.severity === 'critical') {
        // Queue the request if credits are critically low
        return await this.queueUpscaleRequest(request);
      }

      // Step 3: Create transaction record
      const transactionId = await upscaleTrackingService.createUpscaleTransaction({
        user_id: request.userId,
        scale_factor: request.scale as 2 | 4 | 8,
        quality_preset: request.quality,
        api_cost: this.REPLICATE_COST_PER_UPSCALE,
        status: 'pending'
      });

      if (!transactionId) {
        return {
          success: false,
          error: 'Failed to create transaction record'
        };
      }

      // Step 4: Process the upscale
      const startTime = Date.now();
      
      // Update transaction status to processing
      await upscaleTrackingService.updateUpscaleTransaction(transactionId, {
        status: 'processing'
      });

      // Try edge function first, fallback to direct API
      let result;
      try {
        result = await edgeFunctionService.upscaleImage({
          image: request.image,
          scale: request.scale,
          quality: request.quality,
          outputFormat: request.outputFormat
        });
      } catch (edgeError) {
        console.warn('Edge function failed, trying direct API:', edgeError);
        result = await replicateService.upscaleImage({
          image: request.image,
          scale: request.scale,
          quality: request.quality,
          outputFormat: request.outputFormat
        });
      }

      const processingTime = Math.round((Date.now() - startTime) / 1000);

      // Step 5: Log API usage
      await upscaleTrackingService.logApiUsage({
        transaction_id: transactionId,
        api_provider: 'replicate',
        api_endpoint: '/v1/predictions',
        request_payload: {
          scale: request.scale,
          quality: request.quality
        },
        response_data: result,
        http_status_code: result.success ? 200 : 500,
        processing_time_ms: Date.now() - startTime,
        api_cost: this.REPLICATE_COST_PER_UPSCALE,
        credits_consumed: this.REPLICATE_COST_PER_UPSCALE
      });

      // Step 6: Update transaction with results
      if (result.success) {
        await upscaleTrackingService.updateUpscaleTransaction(transactionId, {
          status: 'completed',
          upscaled_image_url: result.imageUrl,
          processing_time_seconds: processingTime
        });

        // Update API credit balance
        const newBalance = creditStatus.current_balance - this.REPLICATE_COST_PER_UPSCALE;
        await upscaleTrackingService.updateApiCredits(newBalance);

        // Check if we need to create alerts
        await this.checkAndCreateAlerts(request.userId, newBalance);

        return {
          success: true,
          transactionId,
          imageUrl: result.imageUrl,
          processingTime,
          apiCost: this.REPLICATE_COST_PER_UPSCALE,
          remainingUpscales: eligibility.remainingUpscales! - 1,
          usageWarning: this.getUsageWarning(eligibility.remainingUpscales! - 1)
        };
      } else {
        await upscaleTrackingService.updateUpscaleTransaction(transactionId, {
          status: 'failed',
          error_message: result.error
        });

        return {
          success: false,
          transactionId,
          error: result.error || 'Upscaling failed'
        };
      }

    } catch (error) {
      console.error('Enhanced upscale service error:', error);
      
      // Create system alert for unexpected errors
      await upscaleTrackingService.createAlert({
        alert_type: 'system_error',
        severity: 'high',
        title: 'Upscale Processing Error',
        message: `Unexpected error during upscale processing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { userId: request.userId, error: error }
      });

      return {
        success: false,
        error: 'System error occurred during processing'
      };
    }
  }

  private async queueUpscaleRequest(request: UpscaleRequest): Promise<UpscaleResult> {
    try {
      // Create transaction in queued state
      const transactionId = await upscaleTrackingService.createUpscaleTransaction({
        user_id: request.userId,
        scale_factor: request.scale as 2 | 4 | 8,
        quality_preset: request.quality,
        api_cost: this.REPLICATE_COST_PER_UPSCALE,
        status: 'queued'
      });

      if (!transactionId) {
        throw new Error('Failed to create queued transaction');
      }

      // Add to processing queue
      await upscaleTrackingService.addToQueue(request.userId, transactionId, 1);

      // Create alert for queued request
      await upscaleTrackingService.createAlert({
        alert_type: 'low_credits',
        severity: 'medium',
        title: 'Request Queued - Low API Credits',
        message: 'Upscale request has been queued due to low API credits. Processing will resume once credits are replenished.',
        metadata: { userId: request.userId, transactionId }
      });

      return {
        success: false,
        transactionId,
        error: 'Request queued due to low API credits. You will be notified when processing completes.'
      };
    } catch (error) {
      console.error('Error queuing upscale request:', error);
      return {
        success: false,
        error: 'Failed to queue request. Please try again later.'
      };
    }
  }

  async getQueueStatus(userId: string, transactionId: string): Promise<QueueStatus> {
    try {
      const queuedItems = await upscaleTrackingService.getQueuedItems(100);
      const userItemIndex = queuedItems.findIndex(item => 
        item.user_id === userId && item.transaction_id === transactionId
      );

      if (userItemIndex === -1) {
        return { position: 0, estimatedWaitTime: 0, isQueued: false };
      }

      const position = userItemIndex + 1;
      const estimatedWaitTime = position * 30; // Estimate 30 seconds per item

      return {
        position,
        estimatedWaitTime,
        isQueued: true
      };
    } catch (error) {
      console.error('Error getting queue status:', error);
      return { position: 0, estimatedWaitTime: 0, isQueued: false };
    }
  }

  async processQueuedItems(): Promise<void> {
    try {
      // Check if we have sufficient credits
      const creditStatus = await upscaleTrackingService.checkApiCredits();
      if (creditStatus.severity === 'critical') {
        console.log('Insufficient credits to process queue');
        return;
      }

      // Get queued items
      const queuedItems = await upscaleTrackingService.getQueuedItems(5); // Process 5 at a time
      
      for (const item of queuedItems) {
        try {
          // Update queue item status
          await upscaleTrackingService.supabase
            .from('upscale_queue')
            .update({ status: 'processing' })
            .eq('id', item.id);

          // Process the upscale (simplified version)
          const result = await replicateService.upscaleImage({
            image: item.upscale_transactions.original_image_url, // This would need to be reconstructed
            scale: item.upscale_transactions.scale_factor,
            quality: item.upscale_transactions.quality_preset
          });

          if (result.success) {
            // Update transaction
            await upscaleTrackingService.updateUpscaleTransaction(item.transaction_id, {
              status: 'completed',
              upscaled_image_url: result.imageUrl
            });

            // Update queue item
            await upscaleTrackingService.supabase
              .from('upscale_queue')
              .update({ status: 'completed' })
              .eq('id', item.id);
          } else {
            throw new Error(result.error || 'Processing failed');
          }

        } catch (error) {
          console.error('Error processing queued item:', error);
          
          // Update retry count
          const newRetryCount = (item.retry_count || 0) + 1;
          
          if (newRetryCount >= item.max_retries) {
            // Mark as failed
            await upscaleTrackingService.supabase
              .from('upscale_queue')
              .update({ 
                status: 'failed',
                error_message: error instanceof Error ? error.message : 'Unknown error'
              })
              .eq('id', item.id);

            await upscaleTrackingService.updateUpscaleTransaction(item.transaction_id, {
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Queue processing failed'
            });
          } else {
            // Schedule for retry
            await upscaleTrackingService.supabase
              .from('upscale_queue')
              .update({ 
                status: 'queued',
                retry_count: newRetryCount,
                scheduled_for: new Date(Date.now() + this.QUEUE_RETRY_DELAY).toISOString()
              })
              .eq('id', item.id);
          }
        }
      }
    } catch (error) {
      console.error('Error processing queue:', error);
    }
  }

  private async checkAndCreateAlerts(userId: string, currentBalance: number): Promise<void> {
    try {
      // Get user stats to check usage patterns
      const stats = await upscaleTrackingService.getUserUsageStats(userId);
      
      // Check for high usage warning (80% of monthly limit)
      if (stats.usage_percentage >= 80) {
        await upscaleTrackingService.createAlert({
          alert_type: 'high_usage',
          severity: 'medium',
          title: 'High Monthly Usage',
          message: `You've used ${stats.usage_percentage}% of your monthly upscale limit. Consider upgrading your plan if you need more upscales.`,
          metadata: { userId, usagePercentage: stats.usage_percentage }
        });
      }

      // Check for low API credits
      if (currentBalance <= 50) {
        await upscaleTrackingService.createAlert({
          alert_type: 'low_credits',
          severity: currentBalance <= 10 ? 'critical' : 'medium',
          title: 'Low API Credits',
          message: `API credit balance is low: $${currentBalance.toFixed(2)}. Automatic top-up may be triggered soon.`,
          metadata: { currentBalance }
        });
      }
    } catch (error) {
      console.error('Error checking and creating alerts:', error);
    }
  }

  private getUsageWarning(remainingUpscales: number): string | undefined {
    if (remainingUpscales <= 0) {
      return 'You have reached your monthly upscale limit. Upgrade your plan to continue.';
    } else if (remainingUpscales <= 10) {
      return `You have ${remainingUpscales} upscales remaining this month.`;
    } else if (remainingUpscales <= 50) {
      return `You have ${remainingUpscales} upscales remaining this month. Consider upgrading if you need more.`;
    }
    return undefined;
  }

  async getUserDashboardData(userId: string) {
    try {
      const [profile, stats, recentTransactions, creditStatus] = await Promise.all([
        upscaleTrackingService.getUserProfile(userId),
        upscaleTrackingService.getUserUsageStats(userId),
        upscaleTrackingService.getUserTransactionHistory(userId, 10),
        upscaleTrackingService.checkApiCredits()
      ]);

      return {
        profile,
        stats,
        recentTransactions,
        systemStatus: {
          apiCredits: creditStatus.current_balance,
          apiStatus: creditStatus.severity === 'critical' ? 'degraded' : 'operational'
        }
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      return null;
    }
  }
}

export const enhancedUpscaleService = new EnhancedUpscaleService();