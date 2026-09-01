import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_REF = 'hiilbngoxqcwmiqdiuyd';
const TEMPLATE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'templates');

const TEMPLATES = [
  {
    file: 'confirmation.html',
    subject: 'Confirma a tua conta LyftTrack / Confirm your LyftTrack account',
    subjectKey: 'mailer_subjects_confirmation',
    contentKey: 'mailer_templates_confirmation_content',
  },
  {
    file: 'invite.html',
    subject: 'Convite para o LyftTrack / Your LyftTrack invite',
    subjectKey: 'mailer_subjects_invite',
    contentKey: 'mailer_templates_invite_content',
  },
  {
    file: 'magic_link.html',
    subject: 'Codigo LyftTrack / Your LyftTrack code',
    subjectKey: 'mailer_subjects_magic_link',
    contentKey: 'mailer_templates_magic_link_content',
  },
  {
    file: 'email_change.html',
    subject: 'Confirma o novo email / Confirm your new email',
    subjectKey: 'mailer_subjects_email_change',
    contentKey: 'mailer_templates_email_change_content',
  },
  {
    file: 'recovery.html',
    subject: 'Repor palavra-passe LyftTrack / Reset your LyftTrack password',
    subjectKey: 'mailer_subjects_recovery',
    contentKey: 'mailer_templates_recovery_content',
  },
  {
    file: 'reauthentication.html',
    subject: 'Confirma que es tu / Confirm it is you',
    subjectKey: 'mailer_subjects_reauthentication',
    contentKey: 'mailer_templates_reauthentication_content',
  },
];

async function readToken() {
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  throw new Error(
    'Set SUPABASE_ACCESS_TOKEN and run this again. Dashboard: https://supabase.com/dashboard/account/tokens'
  );
}

async function main() {
  const token = await readToken();
  const payload = {};

  for (const template of TEMPLATES) {
    const html = await readFile(path.join(TEMPLATE_DIR, template.file), 'utf8');
    payload[template.subjectKey] = template.subject;
    payload[template.contentKey] = html;
  }

  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Auth template update failed (${response.status}): ${body}`);
  }

  console.log('Updated Supabase auth email templates.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
