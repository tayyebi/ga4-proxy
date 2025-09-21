# GA4 Analytics Proxy

A Cloudflare Worker that tracks page views using Google Analytics 4 Measurement Protocol.

## What It Does

- Tracks page views on your website
- Generates unique visitor IDs
- Sends data to Google Analytics
- Works as a proxy without modifying your website code

## Setup

1. **Install Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

3. **Configure Environment Variables**

   Edit `wrangler.toml` and replace:
   - `yourdomain.com` with your actual domain
   - `G-XXXXXXXXXX` with your GA4 Measurement ID
   - `your_api_secret_here` with your GA4 API Secret

4. **Deploy**
   ```bash
   wrangler deploy
   ```

## Files

- `index.js` - Main worker code
- `wrangler.toml` - Configuration file

## How to View Logs

```bash
wrangler tail ga4-analytics-proxy --format pretty
```

## Requirements

- Cloudflare account
- GA4 property with Measurement Protocol enabled
- Domain configured in Cloudflare

## Security

- Uses secure HTTP-only cookies
- Validates domains to prevent unauthorized use
- Skips tracking for bots and static files

## Support

For issues, check the logs using `wrangler tail` command.
