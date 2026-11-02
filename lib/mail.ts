import "server-only";

/** Sends through Resend when RESEND_API_KEY is set. Returns whether the email was accepted. */
export async function sendContactEmail(message: {
  to: string;
  name: string;
  email: string;
  body: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "Portfolio <onboarding@resend.dev>",
        // Lowercase, in case Resend's test sender compares it exactly with the account's address.
        to: [message.to.toLowerCase()],
        reply_to: message.email,
        subject: `Portfolio message from ${message.name}`,
        text: `${message.body}\n\nFrom: ${message.name} <${message.email}>`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) console.error("Resend rejected the email:", response.status, await response.text());
    return response.ok;
  } catch (error) {
    console.error("Could not reach Resend.", error);
    return false;
  }
}
