/*  
 * Author: Mohammad R. Tayyebi <m@tyyi.net>  
 * Purpose: GA4 Measurement Protocol proxy implementation  
 * Date: 2025-09-21  
 * Optimized: 2025-09-21
 */

// Structured logging utility
const log = {
  info: (message, data = {}) => {
    console.log(JSON.stringify({ 
      level: 'info', 
      message, 
      ...data, 
      timestamp: new Date().toISOString() 
    }));
  },
  error: (message, error = null, data = {}) => {
    console.error(JSON.stringify({ 
      level: 'error', 
      message, 
      error: error?.message, 
      stack: error?.stack,
      ...data,
      timestamp: new Date().toISOString() 
    }));
  },
  warn: (message, data = {}) => {
    console.warn(JSON.stringify({ 
      level: 'warn', 
      message, 
      ...data, 
      timestamp: new Date().toISOString() 
    }));
  }
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    
    // Domain validation - only process allowed domains
    const allowedDomains = ['yourdomain.com', 'www.yourdomain.com'];
    if (!allowedDomains.includes(hostname)) {
      log.info('Skipping analytics for unauthorized domain', { hostname });
      return fetch(request);
    }
    
    // Skip analytics for static files and bots
    if (shouldSkipAnalytics(request, url)) {
      return fetch(request);
    }

    let clientId = extractClientId(request);
    const isNewClient = !clientId;
    if (!clientId) {
      clientId = crypto.randomUUID();
      log.info('Generated new client ID', { clientId });
    } else {
      log.info('Using existing client ID', { clientId });
    }

    // Send analytics asynchronously (non-blocking)
    ctx.waitUntil(sendAnalytics(env, request, clientId));

    // Fetch origin response
    const originRes = await fetch(request);
    
    // Add cookie if this is a new client
    return addClientIdCookie(originRes, clientId, request, isNewClient);
  }
};

// Helper functions
function shouldSkipAnalytics(request, url) {
  // Skip for common static files
  const staticExtensions = [
    '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', 
    '.woff', '.woff2', '.ttf', '.webp', '.mp4', '.webm', '.mp3', '.json'
  ];
  
  const path = url.pathname.toLowerCase();
  const userAgent = request.headers.get('user-agent');
  const isStaticFile = staticExtensions.some(ext => path.endsWith(ext));
  const isBotRequest = isBot(userAgent);
  
  if (isStaticFile) {
    log.info('Skipping analytics for static file', { path });
    return true;
  }
  
  if (isBotRequest) {
    log.info('Skipping analytics for bot', { userAgent, path });
    return true;
  }
  
  // Skip health checks and admin paths
  if (path.includes('/health') || path.includes('/status') || path.includes('/admin')) {
    log.info('Skipping analytics for system path', { path });
    return true;
  }
  
  return false;
}

function isBot(userAgent) {
  if (!userAgent) return false;
  const bots = [
    'bot', 'crawl', 'spider', 'slurp', 'search', 'archiver', 
    'feed', 'indexer', 'monitor', 'checker', 'scanner'
  ];
  return bots.some(bot => userAgent.toLowerCase().includes(bot));
}

function extractClientId(request) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  
  const match = cookieHeader.match(/(?:^|;\s*)client_id=([^;]+)/);
  return match ? match[1] : null;
}

async function sendAnalytics(env, request, clientId) {
  try {
    const url = new URL(request.url);
    
    const payload = {
      client_id: clientId,
      events: [{
        name: 'page_view',
        params: {
          page_location: url.href,
          page_referrer: request.headers.get('referer') || '',
          page_title: '', // GA4 will auto-detect this
          user_agent: request.headers.get('user-agent'),
          engagement_time_msec: '100',
          language: request.headers.get('accept-language')?.split(',')[0] || 'en-US',
          screen_resolution: '1920x1080', // Default value
          document_encoding: 'UTF-8',
          document_charset: 'UTF-8'
        }
      }]
    };

    log.info('Sending analytics event', { 
      clientId, 
      page: url.pathname,
      measurementId: env.GA_MEASUREMENT_ID 
    });

    const analyticsUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(env.GA_MEASUREMENT_ID)}&api_secret=${encodeURIComponent(env.GA_API_SECRET)}`;
    
    const response = await fetch(analyticsUrl, {
      method: 'POST',
      headers: { 
        'content-type': 'application/json',
        'user-agent': 'Cloudflare-Worker-GA4-Proxy/1.0'
      },
      body: JSON.stringify(payload),
      cf: { 
        fetchTimeout: 2000,
        cacheEverything: false
      }
    });

    if (!response.ok) {
      throw new Error(`GA4 API responded with status: ${response.status}`);
    }

    log.info('Analytics sent successfully', { clientId });

  } catch (error) {
    log.error('Failed to send analytics', error, { clientId });
    // Silently fail - analytics shouldn't affect user experience
  }
}

function addClientIdCookie(originRes, clientId, request, isNewClient) {
  // Only set cookie if it's a new client and response is successful
  if (!isNewClient || originRes.status >= 400) {
    return originRes;
  }

  const responseHeaders = new Headers(originRes.headers);
  
  // Set secure cookie with proper attributes
  responseHeaders.append(
    'set-cookie',
    `client_id=${clientId}; Path=/; Max-Age=63072000; Secure; HttpOnly; SameSite=Lax`
  );

  log.info('Set new client ID cookie', { clientId });

  return new Response(originRes.body, {
    status: originRes.status,
    statusText: originRes.statusText,
    headers: responseHeaders
  });
}
