const Prompt = require('../models/Prompt');
const User = require('../models/User');

/**
 * Prompt Cleanup Job
 * 
 * This job provides monitoring and reporting for prompt cleanup.
 * MongoDB TTL handles the actual deletion automatically.
 * 
 * Features:
 * - Monitor prompt cleanup statistics
 * - Generate cleanup reports
 * - Handle edge cases (manual cleanup if needed)
 * - Provide analytics on storage savings
 */

// Function to get prompt cleanup statistics
const getPromptCleanupStats = async () => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Count prompts that should be cleaned up (older than 24 hours)
    const expiredPrompts = await Prompt.countDocuments({
      createdAt: { $lt: twentyFourHoursAgo }
    });
    
    // Count total prompts
    const totalPrompts = await Prompt.countDocuments();
    
    // Count prompts by quality tier
    const promptsByTier = await Prompt.aggregate([
      {
        $group: {
          _id: '$qualityTier',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Count prompts by user plan (via aggregation)
    const promptsByUserPlan = await Prompt.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $group: {
          _id: '$user.plan',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Calculate storage estimates (rough calculation)
    const avgPromptSize = 500; // Average characters per prompt
    const estimatedStorageMB = (totalPrompts * avgPromptSize) / (1024 * 1024);
    const estimatedCleanupMB = (expiredPrompts * avgPromptSize) / (1024 * 1024);
    
    return {
      timestamp: now,
      totalPrompts,
      expiredPrompts,
      activePrompts: totalPrompts - expiredPrompts,
      promptsByTier,
      promptsByUserPlan,
      storage: {
        estimatedTotalMB: Math.round(estimatedStorageMB * 100) / 100,
        estimatedCleanupMB: Math.round(estimatedCleanupMB * 100) / 100,
        cleanupPercentage: totalPrompts > 0 ? Math.round((expiredPrompts / totalPrompts) * 100) : 0
      }
    };
  } catch (error) {
    console.error('Error getting prompt cleanup stats:', error);
    throw error;
  }
};

// Function to perform manual cleanup (if needed)
const performManualCleanup = async () => {
  try {
    console.log('Starting manual prompt cleanup...');
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Find prompts older than 24 hours
    const expiredPrompts = await Prompt.find({
      createdAt: { $lt: twentyFourHoursAgo }
    });
    
    if (expiredPrompts.length === 0) {
      console.log('No expired prompts found for manual cleanup.');
      return { deletedCount: 0, message: 'No expired prompts found' };
    }
    
    // Delete expired prompts
    const result = await Prompt.deleteMany({
      createdAt: { $lt: twentyFourHoursAgo }
    });
    
    console.log(`Manual cleanup completed. Deleted ${result.deletedCount} expired prompts.`);
    
    return {
      deletedCount: result.deletedCount,
      message: `Successfully deleted ${result.deletedCount} expired prompts`
    };
  } catch (error) {
    console.error('Error in manual prompt cleanup:', error);
    throw error;
  }
};

// Function to get user-specific prompt statistics
const getUserPromptStats = async (userId) => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const userPrompts = await Prompt.find({ userId });
    const expiredUserPrompts = await Prompt.find({
      userId,
      createdAt: { $lt: twentyFourHoursAgo }
    });
    
    return {
      userId,
      totalPrompts: userPrompts.length,
      activePrompts: userPrompts.length - expiredUserPrompts.length,
      expiredPrompts: expiredUserPrompts.length,
      lastPromptAt: userPrompts.length > 0 ? userPrompts[0].createdAt : null
    };
  } catch (error) {
    console.error('Error getting user prompt stats:', error);
    throw error;
  }
};

// Function to generate cleanup report
const generateCleanupReport = async () => {
  try {
    const stats = await getPromptCleanupStats();
    
    const report = {
      reportDate: new Date().toISOString(),
      summary: {
        totalPrompts: stats.totalPrompts,
        expiredPrompts: stats.expiredPrompts,
        activePrompts: stats.activePrompts,
        cleanupEfficiency: `${stats.storage.cleanupPercentage}%`
      },
      storage: {
        estimatedTotalMB: stats.storage.estimatedTotalMB,
        estimatedCleanupMB: stats.storage.estimatedCleanupMB,
        savings: `${stats.storage.estimatedCleanupMB}MB will be freed by cleanup`
      },
      distribution: {
        byQualityTier: stats.promptsByTier,
        byUserPlan: stats.promptsByUserPlan
      },
      recommendations: []
    };
    
    // Add recommendations based on stats
    if (stats.storage.cleanupPercentage > 50) {
      report.recommendations.push('High cleanup percentage - TTL is working effectively');
    }
    
    if (stats.totalPrompts > 10000) {
      report.recommendations.push('Consider implementing Redis cache for frequently accessed prompts');
    }
    
    if (stats.promptsByTier.some(tier => tier._id === 'premium' && tier.count > 1000)) {
      report.recommendations.push('Premium users generating many prompts - consider longer retention for premium tier');
    }
    
    return report;
  } catch (error) {
    console.error('Error generating cleanup report:', error);
    throw error;
  }
};

// Function to run cleanup monitoring (can be called by cron job)
const runCleanupMonitoring = async () => {
  try {
    console.log('🔍 Running prompt cleanup monitoring...');
    
    const stats = await getPromptCleanupStats();
    
    console.log('📊 Prompt Cleanup Statistics:');
    console.log(`   Total Prompts: ${stats.totalPrompts}`);
    console.log(`   Expired Prompts: ${stats.expiredPrompts}`);
    console.log(`   Active Prompts: ${stats.activePrompts}`);
    console.log(`   Cleanup Percentage: ${stats.storage.cleanupPercentage}%`);
    console.log(`   Estimated Storage: ${stats.storage.estimatedTotalMB}MB`);
    console.log(`   Cleanup Savings: ${stats.storage.estimatedCleanupMB}MB`);
    
    // Log distribution by quality tier
    if (stats.promptsByTier.length > 0) {
      console.log('📈 Prompts by Quality Tier:');
      stats.promptsByTier.forEach(tier => {
        console.log(`   ${tier._id}: ${tier.count} prompts`);
      });
    }
    
    // Log distribution by user plan
    if (stats.promptsByUserPlan.length > 0) {
      console.log('👥 Prompts by User Plan:');
      stats.promptsByUserPlan.forEach(plan => {
        console.log(`   ${plan._id}: ${plan.count} prompts`);
      });
    }
    
    console.log('✅ Prompt cleanup monitoring completed.');
    
    return stats;
  } catch (error) {
    console.error('❌ Error in prompt cleanup monitoring:', error);
    throw error;
  }
};

module.exports = {
  getPromptCleanupStats,
  performManualCleanup,
  getUserPromptStats,
  generateCleanupReport,
  runCleanupMonitoring
};
