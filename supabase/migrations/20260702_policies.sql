-- Admin-editable app policies (privacy policy, company policy).
-- Content is markdown rendered by the app; anyone can read, only admins edit.

create table if not exists public.policies (
  key        text primary key,
  title      text not null,
  content    text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

alter table public.policies enable row level security;

drop policy if exists policies_read on public.policies;
create policy policies_read on public.policies
  for select using (true);

drop policy if exists policies_insert on public.policies;
create policy policies_insert on public.policies
  for insert with check (get_my_role() = 'admin');

drop policy if exists policies_update on public.policies;
create policy policies_update on public.policies
  for update using (get_my_role() = 'admin');

insert into public.policies (key, title, content) values
('privacy', 'Privacy Policy', $md$### 1. Who we are

WhiteRock Connect ("Connect", "we", "us") helps students manage their UK university applications and student-visa journey, and connects them with their assigned counselors and agents.

This policy explains what personal data we collect through the Connect app, why we collect it, and the choices you have.

### 2. Data we collect

- **Account details** — name, email address, phone number, profile photo, and your role (student, counselor, agent or admin).
- **Application data** — nationality, intended school and programme, intake, application stage, and related notes added by you or your assigned staff.
- **Documents** — files you upload for your application (for example offer letters, financial evidence, CAS documents).
- **Messages** — chats between you and your assigned counselor or agent, including images, files and voice notes you choose to send.
- **AI assistant conversations** — questions you send to the in-app AI assistant, used to generate a reply and improve your guidance.
- **Device data** — a push-notification token for your device, so we can notify you about messages and application updates.

### 3. How we use your data

- To provide the service: managing your application journey and enabling communication with your assigned staff.
- To notify you about messages, stage changes, appointments and important updates.
- To personalise AI guidance to your application stage.
- To keep the service safe, prevent abuse, and comply with legal obligations.

We do **not** sell your personal data.

### 4. Where your data lives

- Your data is stored with Supabase in the **EU (Ireland)** region.
- Media you send in chat (video and voice) is stored with Cloudinary, a content-delivery service.
- Push notifications are delivered through Expo and Google/Apple notification services.
- AI assistant requests are processed by our AI service provider to generate the reply.

### 5. Who can see your data

- Your assigned counselor or agent can see your profile, application data, documents and your conversations with them.
- Administrators can access data as needed to operate the service.
- We share data with the processors listed above strictly to provide the service.

### 6. How long we keep it

We keep your data while your account is active. If you delete your account, your personal data is removed from our systems except where we are legally required to keep it.

### 7. Your rights

Under UK GDPR you can ask us to access, correct, delete, or export your personal data, and you can object to or restrict certain processing. To exercise any of these rights, contact us using the details below or use "Delete Account" in the app settings.

### 8. Security

Data is encrypted in transit, access is role-restricted, and documents are stored in private storage that requires authentication.

### 9. Children

Connect is intended for users aged 16 and over.

### 10. Changes to this policy

We may update this policy from time to time. The latest version, with its date, is always available on this page.

### 11. Contact

Questions or requests: contact your assigned counselor, or email us at support@whiterock.example (replace with your support address).$md$),

('company', 'Company Policy', $md$### 1. Purpose

This policy sets the standards everyone — students, counselors, agents and administrators — agrees to when using WhiteRock Connect.

### 2. Respectful communication

- Treat everyone with courtesy and professionalism.
- Harassment, discrimination, threats or abusive language are not tolerated and may lead to account suspension.
- Keep conversations relevant to your application and studies.

### 3. Honesty and document integrity

- All documents you upload must be genuine and belong to you.
- Submitting forged, altered or misleading documents is grounds for immediate termination of service and may be reported where the law requires.
- Provide accurate personal and application information, and update it when it changes.

### 4. Confidentiality

- Staff must only access student information needed for their assigned students.
- Student data, documents and conversations must never be shared outside the platform without the student's consent.
- Do not share your account or password with anyone.

### 5. Staff responsibilities

- Respond to student messages within a reasonable time during working hours.
- Record application-stage changes promptly so students always see accurate progress.
- Escalate safeguarding or welfare concerns to an administrator immediately.

### 6. Acceptable use

- Do not use the app to send spam, advertising or content unrelated to studies.
- Do not attempt to probe, disrupt or gain unauthorised access to the service.
- The AI assistant provides general guidance only — always confirm important visa decisions with your counselor.

### 7. Payments

Any fees are communicated by your counselor through official channels. Staff will never ask you to send payment details inside chat messages.

### 8. Violations

Breaches of this policy may result in warnings, feature restrictions, or account termination depending on severity. Serious legal violations may be reported to the relevant authorities.

### 9. Questions

If anything in this policy is unclear, ask your counselor or contact an administrator through the app.$md$)
on conflict (key) do nothing;
