# Connecting TutorLink to Supabase

The website, admin panel and API are built and tested. To make them work with real data, the site
needs your own Supabase project. This takes about 20 minutes. You only do it once.

> **Keep your keys private.** Paste them into `.env.local` on your computer (and later into your
> hosting settings). Never send them in chat or email, and never put the service-role key or the
> database URL in a setting that starts with `NEXT_PUBLIC_`.

---

## 1. Create the project

1. Go to <https://supabase.com>, sign in, and click **New project**.
2. Name it `tutorlink`. Choose a **database password** and save it somewhere safe — you need it in step 2.
3. Region: pick the one closest to your users (for the United States, **East US (North Virginia)**).
4. Wait until the project says it's ready (about 2 minutes).

## 2. Copy four values into `.env.local`

Open the file `.env.local` in the project folder. It already has empty lines for these.

| Line in `.env.local` | Where to find it in Supabase |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project Settings → Data API** → *Project URL* (looks like `https://abcd1234.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Project Settings → API Keys** → the **anon / public** key (or the new **publishable** key, `sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → the **service_role** key (or a **secret** key, `sb_secret_…`). This one is secret. |
| `SUPABASE_DB_URL` | Click **Connect** at the top of the dashboard → **Transaction pooler** → copy the URI and replace `[YOUR-PASSWORD]` with the database password from step 1. It looks like `postgresql://postgres.abcd1234:YOUR-PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres`. If pages hang or the build says a page "took more than 60 seconds", use the **Session pooler** link instead (same address, port `5432`). |

Also set `NEXT_PUBLIC_SITE_URL` to the address people open the site at — `http://localhost:3100`
on this computer for now, your real domain later.

## 3. Create the tables

In a terminal in the project folder, run:

```
npm run db:migrate
```

It creates every table with its security rules, the storage buckets for photos, videos and
documents, and the starting content (the 9 subjects with 38 sub-categories, the FAQs, the 5 blog
articles and the feature flags). At the end it must say **"Row Level Security is on for every
public table."** Running it again later only applies new changes.

## 4. Sign-in settings in Supabase

1. **Authentication → URL Configuration**
   - *Site URL*: the same address as `NEXT_PUBLIC_SITE_URL`.
   - *Redirect URLs*: add `http://localhost:3100/**` and, when you go live, `https://your-domain.com/**`.
2. **Authentication → Sign In / Providers → Email**: keep **Confirm email** turned on. Set the
   minimum password length to **10** (the site asks for 10).
3. **Emails for real users (important).** Supabase's built-in email only reaches addresses of your
   own Supabase team and only a few per hour. Before real people sign up, connect your own sender:
   create a free account at <https://resend.com>, verify your domain there, then in Supabase go to
   **Authentication → Emails → SMTP Settings** and enter: host `smtp.resend.com`, port `465`,
   username `resend`, password = your Resend API key, sender = `no-reply@your-domain.com`.
4. *(Recommended)* So confirmation links also work when opened on a different phone or computer,
   change this template in **Authentication → Emails → Templates**:
   - *Confirm signup*: make the link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (new tutors then continue to their profile setup, students to their learning profile)

   With the default template the link still works, as long as it's opened in the same browser
   that was used to sign up. (Once the site's own email is set up in step 7, Supabase sends no
   sign-up or password emails at all: the site emails 6-digit codes itself, so steps 3 and 4 only
   matter without step 7.)

## 5. Make yourself the administrator

Staff accounts can't be chosen at sign-up (that keeps strangers out of the admin panel).

1. Start the site, open `/register`, sign up with **your own email**, and confirm the email.
2. In the terminal run (with your email):

   ```
   npm run db:make-admin -- you@your-domain.com
   ```

3. Sign out, sign back in — you land in `/admin` with every permission.
4. Go to **Admin → Security** and click **Turn on two-step login**. Scan the QR code with an
   authenticator app on your phone (Google Authenticator, Microsoft Authenticator or 1Password) and
   enter the 6-digit code. From then on, every sign-in asks for a code from that app.

After that, manage staff from the website: **Admin → Users → open the person → More → Make staff**
(pick Support or Administrator and tick the permissions). The same menu removes staff access,
resets a lost phone's two-step login, edits details and deletes accounts.

Fallbacks in the terminal: `--support` makes support staff, `--revoke` removes staff access, and
`npm run db:make-admin -- you@your-domain.com --reset-mfa` removes your own two-step login if you
lose your phone and no other administrator can reset it for you.

## 6. Check it works

Open `http://localhost:3100/api/health`. You should see `"ok": true` and every migration listed.
If something is missing, the `missing` list names the setting that's empty (never its value).

## 7. Email from the site (sign-up codes, password reset, parent approval, notifications)

The site sends its own email: **sign-up verification codes** (6 digits, valid 15 minutes: a new
student, parent or tutor types it to confirm their email before they can sign in), **password reset
emails** (a 6-digit code and a link, single use, valid 15 minutes), parent approval for 13–17
students, and email copies of notifications. Without an email service the "Forgot your password?" page
says reset emails can't be sent right now, and sign-up falls back to Supabase's confirmation link.

Reset links point to `NEXT_PUBLIC_SITE_URL`. On the live site it must be your `https://` address
(for example `NEXT_PUBLIC_SITE_URL=https://www.your-domain.com`); a plain `http://` address is accepted
only for `localhost`, and otherwise no reset email is sent. While the site runs on your own computer,
Gmail won't open `localhost` links, so type the 6-digit code from the email on the "Forgot password"
page instead.

**Quickest: your Gmail account (free, up to about 500 emails a day).**

1. Turn on **2-Step Verification** for the Google account: <https://myaccount.google.com/security>.
2. Open <https://myaccount.google.com/apppasswords>, type the name `TutorLink`, click **Create**, and
   copy the 16-letter password it shows (it works only for this; your normal password stays private).
3. Add these lines to `.env.local` (your Gmail address twice, the app password without spaces):

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=yourname@gmail.com
   SMTP_PASS=abcdabcdabcdabcd
   EMAIL_FROM="TutorLink <yourname@gmail.com>"
   ```

4. Check it: `npm run email:check` (logs in, sends nothing) or `npm run email:check -- you@example.com`
   (also sends a test email). Then rebuild and restart the site.

**For a real launch** use a sending service with your own domain (better delivery): for example
Resend (`RESEND_API_KEY` + `EMAIL_FROM` with your verified domain) or the same domain's SMTP details
in the `SMTP_*` settings. Keep these values only in `.env.local` / your host's environment settings.

With these settings Supabase sends no emails for sign-up or password reset, so its own email limits
don't matter.

---

## Optional extras

| Feature | What to do |
|---|---|
| **Google / Facebook / Apple sign-in** | Supabase → **Authentication → Sign In / Providers** → turn on the provider and paste its client ID and secret (created in Google Cloud, Meta for Developers or Apple Developer). The "Continue with …" buttons appear on the site automatically for each provider you switch on. |
| **Emails from the site** (password reset links, parent approval for 13–17 students, and email copies of notifications: booking requests and changes, messages, payments, job applications, homework, account and security notices) | See step 7: an SMTP mailbox (`SMTP_*`) or a Resend API key (`RESEND_API_KEY`), plus `EMAIL_FROM`. Each person chooses which emails they get under **Notifications**; account and security notices always go out. Announcements are emailed only to people who switched on "Tips & product news". Without these settings, everything still shows in the site's notifications, but no email is sent. |
| **Scheduled clean-up** (expire unanswered booking requests, finish past lessons) | Already runs by itself at most every 5 minutes while people use the site. On Vercel, also set `CRON_SECRET` to any long random text; `vercel.json` then calls it daily as a backup. |

## Going live on Vercel

1. In Vercel → your project → **Settings → Environment Variables**, add the same values as in
   `.env.local` (with `NEXT_PUBLIC_SITE_URL` set to your real domain).
2. In Supabase → **Authentication → URL Configuration**, set the Site URL to the real domain and
   add it to the Redirect URLs.
3. Deploy. Open `https://your-domain.com/api/health` to check.

## What is not connected yet

These need an outside service and an account of your own before they can work. The site doesn't
pretend they work: the buttons say "not available yet" or the server refuses with a clear message.

- **Card and UPI payments** (Stripe). Until connected, only free lessons can be booked, and buying
  Study Credits, lead credits or a paid tutor plan is switched off.
- **Payouts to tutors** (Stripe Connect).
- **Two-way video in the classroom** (a video service such as Daily, Zoom or LiveKit). Today each
  person sees their own camera, the whiteboard and the chat.
- **Text-message notifications** (Twilio).
