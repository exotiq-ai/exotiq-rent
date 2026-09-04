/**
 * Renter e-mail (MP-14) through Resend. Three messages, one voice: short,
 * gold on dark, one link, and always a way out. Every send is logged.
 */
import { rentersFromEmail, rentersPostalAddress, rentersReplyTo, resendApiKey } from './config';
import { logEmail } from './store';

export type Mail = { to: string; subject: string; html: string; text: string; kind: string; renterId?: string | null; /** Every message carries it: RFC 8058 one-click unsubscribe headers. */ unsubscribeHref: string; /** A marketing message (CAN-SPAM): refused unless the postal address is configured. Today every send is transactional. */ commercial?: boolean };

export async function sendMail(mail: Mail): Promise<{ id: string | null }> {
  if (mail.commercial && !rentersPostalAddress()) throw new Error('commercial mail needs RENTERS_POSTAL_ADDRESS');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: rentersFromEmail(),
      to: [mail.to],
      reply_to: rentersReplyTo(),
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: {
        'List-Unsubscribe': `<${mail.unsubscribeHref}>, <mailto:${rentersReplyTo()}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 200);
    await logEmail({ renter_id: mail.renterId, kind: mail.kind, to_email: mail.to, status: 'failed', error: `${res.status} ${text}` }).catch(() => undefined);
    throw new Error(`resend ${res.status}`);
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  await logEmail({ renter_id: mail.renterId, kind: mail.kind, to_email: mail.to, provider_id: data.id ?? null }).catch(() => undefined);
  return { id: data.id ?? null };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** The shell: dark card, serif headline, one gold button, quiet footer with the unsubscribe link. */
export function layout(opts: { title: string; intro: string; cta?: { label: string; href: string }; body?: string; unsubscribeHref: string; why: string }): { html: string; text: string } {
  const address = rentersPostalAddress();
  const html = `<!doctype html><html><body style="margin:0;background:#06070a;color:#F0F2F5;font-family:Inter,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#06070a;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0D0F14;border:1px solid #2A2E3A;border-radius:16px;">
<tr><td style="padding:28px 28px 8px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#C8A664;">Drive Exotiq</td></tr>
<tr><td style="padding:0 28px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.15;color:#F0F2F5;">${esc(opts.title)}</td></tr>
<tr><td style="padding:14px 28px 0;font-size:15px;line-height:1.6;color:#9BA1B0;">${esc(opts.intro)}</td></tr>
${opts.body ? `<tr><td style="padding:18px 28px 0;">${opts.body}</td></tr>` : ''}
${opts.cta ? `<tr><td style="padding:24px 28px 8px;"><a href="${esc(opts.cta.href)}" style="display:inline-block;background:#C8A664;color:#1A1308;text-decoration:none;font-weight:600;font-size:14px;padding:14px 22px;border-radius:12px;">${esc(opts.cta.label)}</a></td></tr>` : ''}
<tr><td style="padding:24px 28px 28px;font-size:12px;line-height:1.6;color:#848A9A;border-top:1px solid #2A2E3A;">${esc(opts.why)} <a href="${esc(opts.unsubscribeHref)}" style="color:#9BA1B0;">Unsubscribe from Drive Exotiq e-mail</a>.${address ? `<br>${esc(address)}` : ''}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [opts.title, '', opts.intro, opts.cta ? `\n${opts.cta.label}: ${opts.cta.href}` : '', '', `${opts.why} Unsubscribe: ${opts.unsubscribeHref}`, address].filter(Boolean).join('\n');
  return { html, text };
}

export function carListHtml(cars: Array<{ name: string; meta: string; href: string }>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cars
    .map((c) => `<tr><td style="padding:10px 0;border-top:1px solid #2A2E3A;"><a href="${esc(c.href)}" style="color:#F0F2F5;text-decoration:none;font-size:15px;">${esc(c.name)}</a><div style="font-size:12px;color:#848A9A;margin-top:2px;">${esc(c.meta)}</div></td></tr>`)
    .join('')}</table>`;
}
