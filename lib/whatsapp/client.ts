/**
 * Thin wrapper around the WhatsApp Cloud API's send-message endpoint
 * (Meta Graph API). `to` must be the recipient's wa_id exactly as
 * WhatsApp sent it in the incoming webhook (digits only, no leading "+").
 */

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

export function isWhatsAppConfigured(): boolean {
  return Boolean(WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID);
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.error(
      "[whatsapp] WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not configured — cannot send message"
    );
    return;
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text, preview_url: true },
        }),
      }
    );

    if (!res.ok) {
      console.error(`[whatsapp] send failed for ${to}: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error(`[whatsapp] send threw for ${to}:`, err);
  }
}
