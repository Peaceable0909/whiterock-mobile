// Supabase Auth "Send Email" hook → Google Apps Script (Gmail) relay.
//
// GoTrue calls this instead of its built-in mailer. We verify the webhook
// signature, build a branded email for the action type, and hand delivery
// to the Apps Script web app (appscript/whiterock-mailer.gs).
//
// Required secrets (Dashboard → Edge Functions → Secrets):
//   SEND_EMAIL_HOOK_SECRET — shown when enabling the hook (v1,whsec_...)
//   APPSCRIPT_MAIL_URL     — the Apps Script /exec URL
//   APPSCRIPT_MAIL_SECRET  — must match SECRET inside the script
import { Webhook } from 'npm:standardwebhooks@1.0.0'

type HookEvent = {
  user: { email: string; user_metadata?: { name?: string } }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
    site_url: string
  }
}

const COPY: Record<string, { subject: string; heading: string; body: string; button: string }> = {
  signup: {
    subject: 'Confirm your email — WhiteRock Connect',
    heading: 'Confirm your email',
    body: 'Welcome to WhiteRock Connect! Tap the button below to confirm this email address and activate your account.',
    button: 'Confirm Email',
  },
  recovery: {
    subject: 'Reset your password — WhiteRock Connect',
    heading: 'Reset your password',
    body: 'We received a request to reset your password. Tap the button below to choose a new one. If this was not you, you can safely ignore this email.',
    button: 'Reset Password',
  },
  magiclink: {
    subject: 'Your sign-in link — WhiteRock Connect',
    heading: 'Sign in to Connect',
    body: 'Tap the button below to sign in. This link can only be used once.',
    button: 'Sign In',
  },
  invite: {
    subject: 'You are invited — WhiteRock Connect',
    heading: 'You have been invited',
    body: 'You have been invited to join WhiteRock Connect. Tap the button below to accept the invitation and set up your account.',
    button: 'Accept Invitation',
  },
  email_change: {
    subject: 'Confirm your new email — WhiteRock Connect',
    heading: 'Confirm your new email',
    body: 'Tap the button below to confirm the change to this email address.',
    button: 'Confirm Change',
  },
}

const buildHtml = (heading: string, body: string, button: string, url: string, otp: string) => `<!doctype html>
<html><body style="margin:0;padding:0;background:#F2F0ED;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F0ED;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border-radius:20px;padding:36px 32px;">
      <tr><td align="center" style="padding-bottom:6px;">
        <span style="font-size:12px;font-weight:700;letter-spacing:3px;color:#1B4FD8;">WHITEROCK CONNECT</span>
      </td></tr>
      <tr><td align="center" style="padding-bottom:14px;">
        <span style="font-size:24px;font-weight:800;color:#1B2B4A;">${heading}</span>
      </td></tr>
      <tr><td align="center" style="padding-bottom:26px;">
        <span style="font-size:14px;line-height:22px;color:#64748B;">${body}</span>
      </td></tr>
      <tr><td align="center" style="padding-bottom:26px;">
        <a href="${url}" style="display:inline-block;background:#1B4FD8;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:15px 40px;border-radius:14px;">${button}</a>
      </td></tr>
      <tr><td align="center" style="padding-bottom:6px;">
        <span style="font-size:12px;color:#94A3B8;">Button not working? Use this one-time code:</span>
      </td></tr>
      <tr><td align="center">
        <span style="font-size:20px;font-weight:800;letter-spacing:5px;color:#1B2B4A;">${otp}</span>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;">
      <tr><td align="center" style="padding-top:18px;">
        <span style="font-size:11px;color:#94A3B8;">If you did not request this email you can safely ignore it.</span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

Deno.serve(async (req) => {
  const fail = (msg: string, code = 400) =>
    new Response(JSON.stringify({ error: msg }), { status: code, headers: { 'Content-Type': 'application/json' } })

  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  const mailUrl    = Deno.env.get('APPSCRIPT_MAIL_URL')
  const mailSecret = Deno.env.get('APPSCRIPT_MAIL_SECRET')
  if (!hookSecret || !mailUrl || !mailSecret) {
    return fail('Missing secrets: SEND_EMAIL_HOOK_SECRET / APPSCRIPT_MAIL_URL / APPSCRIPT_MAIL_SECRET', 500)
  }

  let evt: HookEvent
  try {
    const payload = await req.text()
    const wh = new Webhook(hookSecret.replace('v1,whsec_', ''))
    evt = wh.verify(payload, Object.fromEntries(req.headers)) as HookEvent
  } catch {
    return fail('Invalid webhook signature', 401)
  }

  const { user, email_data: d } = evt
  const copy = COPY[d.email_action_type] ?? {
    subject: 'WhiteRock Connect — action required',
    heading: 'Action required',
    body: 'Tap the button below to continue.',
    button: 'Continue',
  }

  const verifyUrl =
    `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify` +
    `?token=${encodeURIComponent(d.token_hash)}` +
    `&type=${encodeURIComponent(d.email_action_type)}` +
    `&redirect_to=${encodeURIComponent(d.redirect_to ?? d.site_url ?? '')}`

  const res = await fetch(mailUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: mailSecret,
      to: user.email,
      subject: copy.subject,
      html: buildHtml(copy.heading, copy.body, copy.button, verifyUrl, d.token),
      text: `${copy.heading}\n\n${copy.body}\n\n${verifyUrl}\n\nOne-time code: ${d.token}`,
    }),
  })
  // Apps Script always answers 200 — success is signalled in the JSON body.
  const out = await res.text()
  let ok = false
  try { ok = JSON.parse(out).ok === true } catch {}
  if (!res.ok || !ok) return fail(`Mailer failed: ${out.slice(0, 200)}`, 500)

  return new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } })
})
