import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import admin from "npm:firebase-admin@12.2.0";

// Ensure we only initialize the Firebase app once
if (!admin.apps.length) {
  let projectId = Deno.env.get("FIREBASE_PROJECT_ID");
  let clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  let privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY") || "";
  privateKey = privateKey.replace(/\\n/g, '\n');

  // Fallback: If environment variables are not set, check for local serviceAccountKey.json
  if (!projectId || !clientEmail || !privateKey) {
    try {
      const fileUrl = new URL("./serviceAccountKey.json", import.meta.url);
      const fileData = Deno.readTextFileSync(fileUrl);
      const parsed = JSON.parse(fileData);
      projectId = parsed.project_id;
      clientEmail = parsed.client_email;
      privateKey = (parsed.private_key || "").replace(/\\n/g, '\n');
    } catch {
      // Local file not present or not readable
    }
  }

  if (projectId && clientEmail && privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log("Firebase Admin initialized successfully.");
    } catch (err) {
      console.error("Firebase Admin initialization error:", err);
    }
  } else {
    console.error("Missing Firebase credentials. Cannot initialize Admin SDK.");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log("Received notification payload:", payload);

    if (!admin.apps.length) {
      console.warn("Firebase Admin SDK not initialized: missing credentials.");
      return new Response(JSON.stringify({ 
        success: false, 
        warning: "Firebase credentials not configured in Edge Function environment.",
        ignored: true 
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Direct Multicast Push to Device Tokens
    if (payload.tokens && Array.isArray(payload.tokens) && payload.tokens.length > 0) {
      const title = payload.notification?.title || payload.title || "Gyanoday Niketan Alert";
      const body = payload.notification?.body || payload.body || "New alert";
      const data = payload.data || {};

      const stringifiedData: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        stringifiedData[key] = String(value);
      }

      console.log(`Sending direct push to ${payload.tokens.length} device tokens...`);
      const response = await admin.messaging().sendEachForMulticast({
        tokens: payload.tokens,
        notification: { title, body },
        data: stringifiedData
      });

      console.log(`Direct push result: ${response.successCount} succeeded, ${response.failureCount} failed.`);

      // Clean up dead/unregistered tokens automatically
      const deadTokens: string[] = [];
      response.responses.forEach((res, idx) => {
        if (!res.success && res.error) {
          const code = res.error.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            deadTokens.push(payload.tokens[idx]);
          }
        }
      });

      if (deadTokens.length > 0) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
          const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
          if (supabaseUrl && supabaseServiceKey) {
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            await supabase.rpc("deactivate_fcm_tokens", { p_tokens: deadTokens });
            console.log(`Deactivated ${deadTokens.length} dead FCM tokens.`);
          }
        } catch (cleanupErr) {
          console.warn("Failed to deactivate dead tokens:", cleanupErr);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        successCount: response.successCount, 
        failureCount: response.failureCount,
        deadTokensCleaned: deadTokens.length
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Direct Topic Push
    if (payload.topic) {
      let topic = String(payload.topic).replace(/[^a-zA-Z0-9-_.~%]/g, "_");
      const title = payload.notification?.title || payload.title || "Gyanoday Niketan Alert";
      const body = payload.notification?.body || payload.body || "New alert";
      const data = payload.data || {};

      const stringifiedData: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        stringifiedData[key] = String(value);
      }

      const response = await admin.messaging().send({
        topic,
        notification: { title, body },
        data: stringifiedData
      });

      return new Response(JSON.stringify({ success: true, messageId: response }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Database Webhook INSERT on notices table
    if (payload.type === "INSERT" && payload.record) {
      const record = payload.record;
      const title = record.title || "New Notice";
      const body = record.content 
        ? (record.content.length > 100 ? record.content.substring(0, 97) + "..." : record.content)
        : "You have a new notice.";
      
      let topic = record.target_audience || "all_users";
      topic = topic.replace(/[^a-zA-Z0-9-_.~%]/g, "_");
      
      const message = {
        notification: { title, body },
        topic: topic,
        data: {
          noticeId: String(record.id),
          notice_id: String(record.id),
          linkUrl: `/?noticeId=${record.id}`,
          type: "notice"
        }
      };
      
      console.log(`Sending notification to topic '${topic}'...`);
      const response = await admin.messaging().send(message);
      
      return new Response(JSON.stringify({ success: true, messageId: response }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ignored: true, reason: "No valid tokens, topic, or INSERT record found." }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
