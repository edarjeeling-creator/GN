import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import admin from "npm:firebase-admin@12.2.0";

// Ensure we only initialize the Firebase app once
if (!admin.apps.length) {
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  // Replace literal '\n' with actual newlines in case it's escaped in the vault
  let privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY") || "";
  privateKey = privateKey.replace(/\\n/g, '\n');

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
    console.error("Missing Firebase environment variables. Cannot initialize Admin SDK.");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log("Received webhook payload:", payload);

    // Only process INSERT operations
    if (payload.type !== "INSERT") {
      return new Response(JSON.stringify({ ignored: true, reason: "Not an INSERT event" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const record = payload.record;
    if (!record) {
      return new Response("Bad Request: missing record", { status: 400 });
    }

    const title = record.title || "New Notice";
    // Truncate body if it's too long
    const body = record.content 
      ? (record.content.length > 100 ? record.content.substring(0, 97) + "..." : record.content)
      : "You have a new notice.";
    
    // Use target_audience for topic if provided, else default to all_users
    let topic = record.target_audience || "all_users";
    
    // Sanitize topic name (Firebase topics only allow [a-zA-Z0-9-_.~%]+)
    topic = topic.replace(/[^a-zA-Z0-9-_.~%]/g, "_");
    
    const message = {
      notification: {
        title: title,
        body: body,
      },
      topic: topic,
      data: {
        noticeId: String(record.id),
        type: "notice"
      }
    };
    
    console.log(`Sending notification to topic '${topic}'...`);
    const response = await admin.messaging().send(message);
    console.log("Successfully sent message:", response);
    
    return new Response(JSON.stringify({ success: true, messageId: response }), {
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
