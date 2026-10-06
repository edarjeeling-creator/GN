import { supabase } from '../lib/supabase.js';

// Firebase Service Account Credentials for Direct FCM HTTP v1 Delivery
const FIREBASE_CONFIG = {
  projectId: 'supabase-500807',
  clientEmail: 'firebase-adminsdk-fbsvc@supabase-500807.iam.gserviceaccount.com',
  privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC8wKVyN/hVMmvC
1tcgD7ABDW3N2zmamOhHSm1cUmOuRqTwAhFSiYVOIPt68i57sX+BEwYNkUSGPRpM
UcbypedzNQnudm2/MU3FFjHh6xx14OuRRMaGULvHvpyEmISys76obg96YsjKYGfV
/GZKUP5/qOX2pApxQsvgeX3nOXOgGjzRHfAwYQd41ydMI8TTtUYwMjPl36u8Ee8D
vkPfX1ezB2yAviksx84Y97Ly1t9liQAK40mcVMoRRb8U/qAD635MEF/T1KkDGBwJ
Iqh7JY28HdvcMMFDyo/3zOFeOi60lg0e/yCqj2qP8qs8NNhGWemD+w74KJoMsX1f
tXS00p5lAgMBAAECggEAAJabQr01p1bcF6hwkRQ3K/RVsa4HYHe2VvW+j2IJ0tT3
q3BevoS2racg7lTnLPyWgjdqS9CHkEfQeW+fSDAyluFWG2NdxlX7I0XatBTCt9Cs
L46o63rJNKWj+nKfP8sS0/0qOusoK3ULEQJX2fFQSLA+nJSWT3p2WlkGl7OBVyd4
IsUcLHCgGFNIK1JWfbfL29FeW7YduOLPlvxWv5GeOntd4ERfln1qsfvEpmVI8cKq
PWfsk6n9T1rAq+4yfsZKYcDt9RxMLcwt9rncj/m05s4qHKFE4Eb+2CIoCkRC/m/a
lnHsArvU8X7hahxbpRle2mxInpueVX4cvGovL3I3AQKBgQD1mNU4VAbVrONqKev5
rjNhqTNXOvizOY9DwOfjcA169g4O0qnBf1drtwqs0TYsm6zRN/mbW1nEWA/bpXXa
Hk2yQ1ZyZALv2o0jbEy/8yajATSeIJkwuPvymCLfpdZKGNSq+XCWnh2b6pwcc0Pg
H6ZFOKTojdIaBlF/WJLAQOvkSQKBgQDEv2l1FSsR28Wq1OH4hzxoWlhf/jFfW746
uOaVsF1P6cNx22LKWvfsKF0GF9mr9sx5mLkTXYN+W44V4T6MMtXUqwJ6QODRRNXM
MscXsO7HVNAHbn+epV7BOPqqoZ7N169jnDqVl6ux6Wb2e4Ypytwj4nnF4gTG0gOh
9nETVBFxPQKBgB+tX8sNI3iJ/ScjUxl4O45cKZAVviA3y1+80OwH9uUmOXf1+glI
KHlvOYRC0877IVY29w3vwWtOxHTbKZFBmVnlz4+fkLVpJg0smdWkQhaCQEwo/jlH
ks+eidj45ePWwg9vbvMuX7lNkGcnAtk0m9iPzs1kBXZv3DEltn/vn71pAoGAIajN
leZFNAzxSESbVDVutDugmuuV7sZ3SPyRFlLR4/YOJdBumkft2k0dfQlfh/f1C2iB
YTrCYD+xkzSxyrJ3uqZ3CgtHawXnvcOCJB90+k0cOelBlBaem1fwKnjz/itEKjp0
G1uTWCCiKNEBJu05tDnus1fzkUAktvS+a5waT9ECgYBIkr7ZmSi0PtihXQf7t8iJ
nyzc7tpac4itGo6CyVG++2GJWlTL+HHLul22QV4qlC6ye0Ia33xUNxm3PY6hLOAx
gKqSFZGoiKURjofqxgr34nqig7MbIGbNgu/ZPfj/Tq/ARZ4PQZ/VxriK4Fe5fblZ
dpyzaicSdb/keMi6XUj1gg==
-----END PRIVATE KEY-----`
};

class FcmPushService {
  constructor() {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
    this.cryptoKey = null;
  }

  /**
   * Helper to base64url encode a string or ArrayBuffer
   */
  base64UrlEncode(input) {
    const bytes = typeof input === 'string' 
      ? new TextEncoder().encode(input) 
      : new Uint8Array(input);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Imports the PKCS#8 RSA private key using the standard Web Crypto API
   */
  async getCryptoKey() {
    if (this.cryptoKey) return this.cryptoKey;

    const pem = FIREBASE_CONFIG.privateKey;
    const cleanPem = pem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s+/g, '');

    const binaryString = atob(cleanPem);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;
    this.cryptoKey = await cryptoObj.subtle.importKey(
      'pkcs8',
      bytes.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    return this.cryptoKey;
  }

  /**
   * Generates a Google OAuth2 access token for FCM HTTP v1 API
   */
  async getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    // Reuse token if still valid for more than 5 minutes
    if (this.cachedToken && this.tokenExpiresAt > now + 300) {
      return this.cachedToken;
    }

    const key = await this.getCryptoKey();
    const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;

    const header = this.base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = this.base64UrlEncode(JSON.stringify({
      iss: FIREBASE_CONFIG.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    }));

    const signInput = `${header}.${claim}`;
    const signature = await cryptoObj.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(signInput)
    );

    const jwt = `${signInput}.${this.base64UrlEncode(signature)}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Google OAuth2 token generation failed: ${errText}`);
    }

    const tokenData = await tokenRes.json();
    this.cachedToken = tokenData.access_token;
    this.tokenExpiresAt = now + (tokenData.expires_in || 3600);
    return this.cachedToken;
  }

  /**
   * Dispatches push notifications directly to device tokens via FCM HTTP v1 API.
   * Handles parallel delivery, dead token cleanup, and rich Android styling.
   *
   * @param {Object} params
   * @param {string[]} params.tokens - Target FCM tokens
   * @param {string} params.title - Notification title
   * @param {string} params.body - Notification body preview
   * @param {Object} [params.data] - Custom data payload
   * @returns {Promise<Object>}
   */
  async sendPush({ tokens = [], title, body, data = {} }) {
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return { success: true, count: 0, reason: 'No tokens provided' };
    }

    // Filter out dummy/web-mock tokens (such as wp_android_... or wp_web_...)
    const validTokens = Array.from(new Set(tokens.filter(t => t && typeof t === 'string' && !t.startsWith('wp_'))));

    if (validTokens.length === 0) {
      return { success: true, count: 0, reason: 'No valid FCM device tokens found' };
    }

    try {
      const accessToken = await this.getAccessToken();
      const stringifiedData = {};
      for (const [k, v] of Object.entries(data)) {
        stringifiedData[k] = String(v ?? '');
      }

      const notifTitle = title || '🔔 School Notice';
      const notifBody = body || 'New alert from Gyanoday Niketan';

      let successCount = 0;
      let failureCount = 0;
      const deadTokens = [];

      // Send concurrently in chunks of 10 to balance performance and rate limits
      const CHUNK_SIZE = 10;
      for (let i = 0; i < validTokens.length; i += CHUNK_SIZE) {
        const chunk = validTokens.slice(i, i + CHUNK_SIZE);
        const chunkPromises = chunk.map(async (token) => {
          try {
            const fcmRes = await fetch(
              `https://fcm.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/messages:send`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  message: {
                    token,
                    notification: {
                      title: notifTitle,
                      body: notifBody
                    },
                    data: stringifiedData,
                    android: {
                      priority: 'high',
                      notification: {
                        channel_id: 'default',
                        sound: 'default',
                        default_vibrate_timings: true
                      }
                    }
                  }
                })
              }
            );

            const resData = await fcmRes.json();
            if (fcmRes.ok) {
              successCount++;
            } else {
              failureCount++;
              const errMsg = resData.error?.message || '';
              const errDetails = resData.error?.details?.[0]?.errorCode;
              if (
                errDetails === 'UNREGISTERED' ||
                errMsg.includes('registration-token-not-registered') ||
                errMsg.includes('not a valid FCM registration token')
              ) {
                deadTokens.push(token);
              }
            }
          } catch (itemErr) {
            failureCount++;
            console.warn('Single FCM dispatch error:', itemErr.message);
          }
        });

        await Promise.allSettled(chunkPromises);
      }

      // Cleanup dead tokens asynchronously if any were found
      if (deadTokens.length > 0) {
        this.cleanupDeadTokens(deadTokens).catch(err => 
          console.warn('Background dead token cleanup error:', err)
        );
      }

      console.log(`Direct FCM dispatch completed: ${successCount} sent, ${failureCount} failed out of ${validTokens.length} tokens.`);

      return {
        success: successCount > 0 || failureCount === 0,
        successCount,
        failureCount,
        deadTokensCleaned: deadTokens.length
      };
    } catch (err) {
      console.error('Direct FCM dispatch fatal error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Deactivates dead/unregistered FCM tokens in Supabase user_devices table
   */
  async cleanupDeadTokens(tokens = []) {
    if (!tokens || tokens.length === 0) return;
    try {
      const { error: rpcErr } = await supabase.rpc('deactivate_fcm_tokens', { p_tokens: tokens });
      if (rpcErr) {
        await supabase
          .from('user_devices')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in('fcm_token', tokens);
      }
    } catch (e) {
      console.warn('Error during dead token cleanup:', e);
    }
  }
}

export const fcmPushService = new FcmPushService();
export default fcmPushService;
