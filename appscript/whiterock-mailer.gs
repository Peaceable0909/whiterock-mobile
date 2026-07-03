/**
 * WhiteRock Connect — auth email sender.
 *
 * Paste this into a new project at https://script.google.com while signed in
 * to the Google account that should SEND the emails.
 *
 * 1. Replace SECRET below with a long random string (keep it private).
 * 2. Deploy → New deployment → type "Web app"
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 3. Copy the web app URL (ends in /exec).
 * 4. In Supabase → Edge Functions → Secrets add:
 *      APPSCRIPT_MAIL_URL    = the /exec URL
 *      APPSCRIPT_MAIL_SECRET = the same SECRET string
 *
 * Consumer Gmail can send ~100 emails/day this way (Workspace ~1500/day).
 */

const SECRET = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING'

function doPost(e) {
  const json = (obj) =>
    ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON)

  try {
    const body = JSON.parse(e.postData.contents)
    if (!body.secret || body.secret !== SECRET) return json({ error: 'unauthorized' })
    if (!body.to || !body.subject || !body.html) return json({ error: 'to, subject, html required' })

    MailApp.sendEmail({
      to: body.to,
      subject: body.subject,
      htmlBody: body.html,
      body: body.text || 'Open this email in an HTML-capable client.',
      name: 'WhiteRock Connect',
    })
    return json({ ok: true, remaining: MailApp.getRemainingDailyQuota() })
  } catch (err) {
    return json({ error: String(err) })
  }
}
