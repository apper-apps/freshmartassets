// Comprehensive error handling utilities
export class ErrorHandler {
  static classifyError(error) {
    const message = error.message?.toLowerCase() || '';
    
    // Image processing specific error classification
    if (message.includes('image') || message.includes('processing') || message.includes('upload')) {
      return 'image-processing';
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('timeout') || message.includes('deadline')) {
      return 'timeout';
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('parse')) {
      return 'validation';
    }
    if (message.includes('server') || message.includes('500') || message.includes('503')) {
      return 'server';
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'not-found';
    }
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('403')) {
      return 'permission';
    }
    
    return 'general';
  }

static createUserFriendlyMessage(error, context = '') {
    const type = this.classifyError(error);
    const contextPrefix = context ? `${context}: ` : '';
    
    // Enhanced wallet payment error handling
    if (error.code === 'WALLET_PAYMENT_FAILED' && error.userGuidance) {
      return `${contextPrefix}${error.userGuidance}`;
    }

    // Enhanced image processing error handling for prevention measures
    if (type === 'image-processing' || context?.toLowerCase().includes('image')) {
      switch (true) {
        case error.message?.includes('timeout'):
          return `${contextPrefix}Image processing took too long. Try using a smaller image or check your connection.`;
        case error.message?.includes('too large'):
          return `${contextPrefix}Image file is too large. Please use an image smaller than 25MB or enable Emergency Mode.`;
        case error.message?.includes('corrupted'):
          return `${contextPrefix}Image file appears to be corrupted. Please try a different image.`;
        case error.message?.includes('format') || error.message?.includes('type'):
          return `${contextPrefix}Unsupported image format. Please use JPEG, PNG, WebP, or HEIC files.`;
        case error.message?.includes('network'):
          return `${contextPrefix}Network error during image upload. Check your connection and try again, or use Emergency Mode.`;
        default:
          return `${contextPrefix}Image processing failed. You can try again or use Emergency Mode to continue without an image.`;
      }
    }
    
    // Enhanced payment-specific messaging
    if (context?.toLowerCase().includes('payment') || error.message?.includes('payment')) {
      switch (type) {
        case 'network':
          return `${contextPrefix}Payment failed due to network issues. Please check your internet connection and try again.`;
        case 'timeout':
          return `${contextPrefix}Payment request timed out. Please check your payment method and try again.`;
        case 'server':
          return `${contextPrefix}Payment processing error occurred. Please try again in a few moments.`;
        case 'validation':
          return `${contextPrefix}Invalid payment information. Please check your payment details and try again.`;
        default:
          return `${contextPrefix}Payment failed. Please try again or use a different payment method.`;
      }
    }
    
    switch (type) {
      case 'network':
        return `${contextPrefix}Network connection issue. Please check your internet connection and try again.`;
      case 'timeout':
        return `${contextPrefix}Request timed out. Please try again.`;
      case 'server':
        return `${contextPrefix}Server error occurred. Please try again in a few moments.`;
      case 'validation':
        return `${contextPrefix}Invalid data provided. Please check your input and try again.`;
      case 'not-found':
        return `${contextPrefix}Requested item not found.`;
      case 'permission':
        return `${contextPrefix}You don't have permission to perform this action.`;
      default:
        return `${contextPrefix}An unexpected error occurred. Please try again.`;
    }
  }

static shouldRetry(error, attemptCount = 0, maxRetries = 3) {
    if (attemptCount >= maxRetries) return false;
    
    const type = this.classifyError(error);
    const retryableTypes = ['network', 'timeout', 'server', 'image-processing'];
    
    // Enhanced retry logic for image processing (prevention measures)
    if (type === 'image-processing') {
      // Don't retry certain image errors
      const message = error.message?.toLowerCase() || '';
      if (message.includes('corrupted') || 
          message.includes('invalid') || 
          message.includes('too large') ||
          message.includes('unsupported')) {
        return false;
      }
      
      // Retry network and timeout related image errors
      if (message.includes('network') || message.includes('timeout')) {
        return attemptCount < Math.min(maxRetries, 2); // Limited retries for images
      }
      
      return attemptCount < 1; // Single retry for other image errors
    }
    
    // Enhanced retry logic with wallet payment-specific handling
    if (error.code === 'WALLET_PAYMENT_FAILED') {
      // Check if wallet error is explicitly marked as retryable
      if (error.retryable === false) return false;
      
      // Wallet-specific retry limits
      const walletMaxRetries = error.networkIssue ? maxRetries : Math.min(maxRetries, 2);
      
      if (attemptCount >= walletMaxRetries) return false;
      
      // Don't retry certain wallet errors
      const message = error.message?.toLowerCase() || '';
      if (message.includes('limit exceeded') || 
          message.includes('authentication failed') ||
          message.includes('invalid transaction')) {
        return false;
      }
      
      // Retry network-related wallet errors more aggressively
      if (error.networkIssue || error.reason?.includes('Network')) {
        return attemptCount < maxRetries;
      }
      
      return attemptCount < walletMaxRetries;
    }
    
    // Enhanced retry logic with specific error patterns
    if (retryableTypes.includes(type)) {
      // Additional checks for specific error messages
      const message = error.message?.toLowerCase() || '';
      
      // Don't retry certain permanent errors
      if (message.includes('404') || message.includes('forbidden') || message.includes('unauthorized')) {
        return false;
      }
      
      // Retry network and timeout errors more aggressively
      if (type === 'network' || type === 'timeout') {
        return attemptCount < maxRetries;
      }
      
      // Be more conservative with server errors
      if (type === 'server') {
        return attemptCount < Math.min(maxRetries, 2);
      }
      
      return true;
    }
    
    return false;
  }

static getRetryDelay(attemptCount, baseDelay = 1000, error = null) {
    // Enhanced retry delay with image processing timing
    if (error && this.classifyError(error) === 'image-processing') {
      // Faster retries for image processing issues
      baseDelay = 500;
    }
    
    // Enhanced retry delay with payment-specific timing
    if (error?.code === 'WALLET_PAYMENT_FAILED') {
      // Wallet-specific retry delays
      if (error.networkIssue) {
        // Faster retries for network issues
        baseDelay = 2000;
      } else if (error.reason?.includes('Insufficient balance')) {
        // Shorter delay for balance issues (user might need to recharge)
        baseDelay = 1500;
      } else {
        // Standard wallet retry delay
        baseDelay = 3000;
      }
    }
    
    // Exponential backoff with jitter to prevent thundering herd
    const exponentialDelay = baseDelay * Math.pow(2, attemptCount);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    const totalDelay = exponentialDelay + jitter;
    
    // Cap at 30 seconds (45 seconds for wallet payments, 10 seconds for images)
    let maxDelay = 30000;
    if (error?.code === 'WALLET_PAYMENT_FAILED') {
      maxDelay = 45000;
    } else if (error && this.classifyError(error) === 'image-processing') {
      maxDelay = 10000; // Faster timeouts for image processing
    }
    
    return Math.min(totalDelay, maxDelay);
  }

  static trackErrorPattern(error, context = '') {
    // Enhanced error pattern tracking for better diagnostics and monitoring
    const errorKey = `${error.name || 'Unknown'}_${error.code || 'NoCode'}_${context}`;
    const timestamp = Date.now();
    
    if (!window.errorPatterns) {
      window.errorPatterns = new Map();
    }
    
    const existing = window.errorPatterns.get(errorKey) || { 
      count: 0, 
      contexts: new Set(), 
      firstSeen: timestamp,
      hourlyCount: 0,
      lastHourReset: Math.floor(timestamp / (1000 * 60 * 60))
    };
    
    const currentHour = Math.floor(timestamp / (1000 * 60 * 60));
    
    // Reset hourly count if hour has changed
    if (existing.lastHourReset !== currentHour) {
      existing.hourlyCount = 0;
      existing.lastHourReset = currentHour;
    }
    
    existing.count++;
    existing.hourlyCount++;
    existing.contexts.add(context);
    existing.lastSeen = timestamp;
    
    window.errorPatterns.set(errorKey, existing);
    
    // Alert if error pattern is becoming frequent (monitoring requirement)
    if (existing.count >= 5) {
      console.error(`Critical error pattern detected: ${errorKey} occurred ${existing.count} times`, {
        contexts: Array.from(existing.contexts),
        timespan: timestamp - existing.firstSeen,
        hourlyCount: existing.hourlyCount
      });
    }

    // Special monitoring for image submission failures (prevention measures)
    if (context.includes('image') || context.includes('submission')) {
      if (existing.hourlyCount >= 5) {
        console.warn(`High failure rate for ${context}: ${existing.hourlyCount} failures in current hour`);
      }
    }
    
    return existing;
  }

  // New method for monitoring integration
  static getErrorStatistics() {
    if (!window.errorPatterns) {
      return { totalErrors: 0, patterns: [] };
    }

    const patterns = Array.from(window.errorPatterns.entries()).map(([key, data]) => ({
      errorKey: key,
      count: data.count,
      hourlyCount: data.hourlyCount,
      contexts: Array.from(data.contexts),
      firstSeen: data.firstSeen,
      lastSeen: data.lastSeen,
      duration: data.lastSeen - data.firstSeen
    }));

    return {
      totalErrors: patterns.reduce((sum, p) => sum + p.count, 0),
      totalHourlyErrors: patterns.reduce((sum, p) => sum + p.hourlyCount, 0),
      patterns: patterns.sort((a, b) => b.count - a.count)
    };
  }
}

// Network status monitoring
export class NetworkMonitor {
  static isOnline() {
    return navigator.onLine;
  }

  static addNetworkListener(callback) {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
}

// Service layer error wrapper
export const withErrorHandling = (serviceMethod, context) => {
  return async (...args) => {
    let attemptCount = 0;
    
    while (attemptCount < 3) {
      try {
        return await serviceMethod(...args);
      } catch (error) {
        console.error(`${context} error (attempt ${attemptCount + 1}):`, error);
        
        if (ErrorHandler.shouldRetry(error, attemptCount)) {
          attemptCount++;
          const delay = ErrorHandler.getRetryDelay(attemptCount);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw new Error(ErrorHandler.createUserFriendlyMessage(error, context));
      }
    }
  };
};