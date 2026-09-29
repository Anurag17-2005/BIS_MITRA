const DEFAULT_TO = process.env.WHATSAPP_TO || '+919556828397';

function digits(phone) {
  const raw = String(phone || DEFAULT_TO).replace(/\D/g, '');
  if (raw.length === 10) return `91${raw}`;
  return raw;
}

function toE164(phone) {
  const d = digits(phone);
  return d.startsWith('+') ? d : `+${d}`;
}

async function sendTwilio(text, to) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
  if (!sid || !token) return null;
  const body = new URLSearchParams({
    From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    To: `whatsapp:${toE164(to)}`,
    Body: text,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Twilio ${res.status}`);
  return { ok: true, provider: 'twilio', sid: data.sid };
}

async function sendMeta(text, to) {
  const token = process.env.WHATSAPP_TOKEN || process.env.META_WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return null;
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: digits(to),
      type: 'text',
      text: { body: text },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Meta WhatsApp ${res.status}`);
  return { ok: true, provider: 'meta', id: data.messages?.[0]?.id };
}

async function sendCallMeBot(text, to) {
  const key = process.env.WHATSAPP_CALLMEBOT_APIKEY;
  if (!key) return null;
  const url = `https://api.callmebot.com/whatsapp.php?phone=${digits(to)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok) throw new Error(body.slice(0, 200) || `CallMeBot ${res.status}`);
  return { ok: true, provider: 'callmebot' };
}

/**
 * Send a WhatsApp text to the demo officer/user number.
 * Returns { ok, skipped } when no provider is configured.
 */
export async function sendWhatsApp(text, { to = DEFAULT_TO } = {}) {
  const message = String(text || '').trim();
  if (!message) return { ok: false, error: 'empty' };

  const attempts = [sendTwilio, sendMeta, sendCallMeBot];
  let lastErr = null;
  for (const send of attempts) {
    try {
      const result = await send(message, to);
      if (result) {
        console.log('[whatsapp]', result.provider, 'sent to', toE164(to));
        return result;
      }
    } catch (err) {
      lastErr = err;
      console.warn('[whatsapp]', send.name, err.message);
    }
  }

  console.warn(
    '[whatsapp] skipped — set TWILIO_ACCOUNT_SID+TWILIO_AUTH_TOKEN, or WHATSAPP_TOKEN+WHATSAPP_PHONE_NUMBER_ID, or WHATSAPP_CALLMEBOT_APIKEY. Intended to:',
    toE164(to),
    message.slice(0, 120),
  );
  return { ok: false, skipped: true, error: lastErr?.message || 'no_provider', to: toE164(to) };
}

export function whatsappTarget() {
  return toE164(DEFAULT_TO);
}
