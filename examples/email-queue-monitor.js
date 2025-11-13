/**
 * Email Queue Monitor
 * Monitors email queue jobs and displays real-time status
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const POLL_INTERVAL = 2000; // 2 seconds

class EmailQueueMonitor {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
    this.monitoredJobs = new Map();
  }

  /**
   * Queue an email
   */
  async queueEmail(emailData) {
    try {
      const response = await axios.post(`${this.baseUrl}/emails/queue`, emailData);
      const { jobId, queueName, status } = response.data;
      
      console.log(`✓ Email queued: Job ID ${jobId}`);
      console.log(`  Queue: ${queueName}`);
      console.log(`  Status: ${status}\n`);
      
      return jobId;
    } catch (error) {
      console.error('✗ Failed to queue email:', error.message);
      if (error.response) {
        console.error('  Response:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId) {
    try {
      const response = await axios.get(`${this.baseUrl}/emails/queue/${jobId}`);
      return response.data;
    } catch (error) {
      console.error(`✗ Failed to get job status for ${jobId}:`, error.message);
      throw error;
    }
  }

  /**
   * Monitor a single job
   */
  async monitorJob(jobId, callback) {
    const maxAttempts = 60; // 2 minutes max
    let attempt = 0;

    const poll = async () => {
      try {
        const status = await this.getJobStatus(jobId);
        attempt++;

        if (callback) {
          callback(status, attempt);
        }

        if (status.status === 'completed') {
          console.log(`✓ Job ${jobId} completed successfully`);
          console.log(`  Message ID: ${status.returnValue?.messageId || 'N/A'}`);
          return status;
        } else if (status.status === 'failed') {
          console.error(`✗ Job ${jobId} failed`);
          console.error(`  Reason: ${status.failedReason}`);
          return status;
        } else if (attempt >= maxAttempts) {
          console.warn(`⚠ Job ${jobId} monitoring timeout`);
          return status;
        } else {
          // Continue polling
          setTimeout(poll, POLL_INTERVAL);
        }
      } catch (error) {
        console.error(`Error monitoring job ${jobId}:`, error.message);
        if (attempt < maxAttempts) {
          setTimeout(poll, POLL_INTERVAL);
        }
      }
    };

    poll();
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const response = await axios.get(`${this.baseUrl}/emails/queue/stats`);
      return response.data;
    } catch (error) {
      console.error('✗ Failed to get queue stats:', error.message);
      throw error;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId) {
    try {
      const response = await axios.post(`${this.baseUrl}/emails/queue/${jobId}/retry`);
      console.log(`✓ Job ${jobId} retried:`, response.data.message);
      return response.data;
    } catch (error) {
      console.error(`✗ Failed to retry job ${jobId}:`, error.message);
      throw error;
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId) {
    try {
      const response = await axios.post(`${this.baseUrl}/emails/queue/${jobId}/cancel`);
      console.log(`✓ Job ${jobId} cancelled:`, response.data.message);
      return response.data;
    } catch (error) {
      console.error(`✗ Failed to cancel job ${jobId}:`, error.message);
      throw error;
    }
  }

  /**
   * Monitor queue health
   */
  async monitorQueueHealth(interval = 10000) {
    console.log('📊 Monitoring queue health...\n');
    
    const monitor = async () => {
      try {
        const stats = await this.getQueueStats();
        console.log('Queue Statistics:');
        console.log(`  Waiting: ${stats.waiting}`);
        console.log(`  Active: ${stats.active}`);
        console.log(`  Completed: ${stats.completed}`);
        console.log(`  Failed: ${stats.failed}`);
        console.log(`  Delayed: ${stats.delayed}\n`);
        
        if (stats.failed > 0) {
          console.warn(`⚠ Warning: ${stats.failed} failed jobs in queue`);
        }
      } catch (error) {
        console.error('Error monitoring queue:', error.message);
      }
    };

    // Monitor immediately
    await monitor();
    
    // Then monitor at interval
    setInterval(monitor, interval);
  }
}

// Example usage
if (require.main === module) {
  const monitor = new EmailQueueMonitor();

  // Example 1: Queue and monitor an email
  async function example1() {
    console.log('=== Example 1: Queue and Monitor Email ===\n');
    
    const jobId = await monitor.queueEmail({
      to: 'user@example.com',
      subject: 'Test Email',
      html: '<h1>Hello!</h1><p>This is a test email.</p>',
      options: {
        priority: 5,
        attempts: 3
      }
    });

    await monitor.monitorJob(jobId, (status, attempt) => {
      console.log(`[Attempt ${attempt}] Job ${jobId}: ${status.status}`);
    });
  }

  // Example 2: Monitor queue health
  async function example2() {
    console.log('\n=== Example 2: Monitor Queue Health ===\n');
    await monitor.monitorQueueHealth(10000);
  }

  // Run examples
  example1().then(() => {
    // Keep monitoring queue health
    example2();
  }).catch(console.error);
}

module.exports = EmailQueueMonitor;





