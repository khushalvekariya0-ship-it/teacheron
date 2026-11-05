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
   enter the 6-digit code. From then on, every sign-in asks for a code from that app. Save the 10
   backup codes it shows: each one gets you in once if you lose your phone. (Students, parents and
   tutors can turn two-step login on too, in Settings → Security.)

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

## 8. Google, Facebook and Apple sign-in

The "Continue with Google / Facebook / Apple" buttons use the real sign-in of each company, through
Supabase Auth. **Each button appears on the site only after you switch that provider on in Supabase**
(the site asks Supabase which ones are on). You need one account per company; the client IDs and
secrets go **only into the Supabase dashboard**, never into `.env.local`, the code or chat.

First find your **Supabase callback address**. It is the same for all three:
`https://<your-project-ref>.supabase.co/auth/v1/callback` (Supabase → **Authentication → Sign In /
Providers** → open any provider; it shows this address with a copy button). Also check step 4: the
*Redirect URLs* must include `http://localhost:3100/**` and later `https://your-domain.com/**`.

### Google (free)

1. Open <https://console.cloud.google.com/> and create a project (for example "TutorLink").
2. **Google Auth Platform → Branding**: app name *TutorLink*, your support email, logo (optional),
   home page `https://your-domain.com`, privacy policy `https://your-domain.com/privacy`, terms
   `https://your-domain.com/terms`. Under *Authorized domains* add `supabase.co` and your own domain.
3. **Audience**: *External*. While it says *Testing*, only the test users you add can sign in; press
   **Publish app** before real people use it.
4. **Data access**: add the scopes `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`
   (nothing else, so Google needs no extra review).
5. **Clients → Create client → Web application**:
   - *Authorized JavaScript origins*: `http://localhost:3100` and `https://your-domain.com`
   - *Authorized redirect URIs*: the Supabase callback address from above.
6. Copy the **Client ID** and **Client secret** into Supabase → **Authentication → Sign In /
   Providers → Google**, switch it on and save.

### Facebook (free)

1. Open <https://developers.facebook.com/apps> → **Create app** → use case *Authenticate and request
   data from users with Facebook Login*.
2. **App settings → Basic**: add the privacy policy URL (`https://your-domain.com/privacy`), terms URL,
   an app icon, a category, and a *User data deletion* link or instructions (for example the
   Privacy page). Copy the **App ID** and **App secret**.
3. **Use cases → Facebook Login → Customize → Permissions**: add `email` (`public_profile` is already
   there).
4. **Facebook Login → Settings**: *Valid OAuth Redirect URIs* = the Supabase callback address; keep
   *Client OAuth login*, *Web OAuth login* and *Enforce HTTPS* on.
5. Switch the app to **Live** (top of the page). In *Development* mode only people with a role on the
   app can sign in.
6. Supabase → **Providers → Facebook**: switch on, paste the App ID (as client ID) and App secret,
   save. If that page offers **Allow users without an email**, turn it on: some Facebook accounts
   only have a phone number. Those people are then asked on the site to add and confirm an email.

### Apple (needs the paid Apple Developer Program, US$99 a year)

1. Join at <https://developer.apple.com/programs/> and open **Certificates, Identifiers & Profiles**.
   Your **Team ID** is shown at the top right (10 characters).
2. **Identifiers → + → App IDs → App**: description *TutorLink*, bundle ID for example
   `com.yourcompany.tutorlink`, tick **Sign In with Apple**, register.
3. **Identifiers → + → Services IDs**: description *TutorLink web*, identifier for example
   `com.yourcompany.tutorlink.web` (this is the **client ID**). Open it, tick **Sign In with Apple →
   Configure**: primary App ID = the one from step 2; *Domains* = `<your-project-ref>.supabase.co`;
   *Return URLs* = the Supabase callback address. Save.
4. **Keys → +**: name *TutorLink sign-in*, tick **Sign In with Apple → Configure** (choose the App ID),
   register, and **download the `.p8` file** (Apple lets you download it only once; keep it safe and
   private). Note the **Key ID**.
5. Supabase → **Providers → Apple**: switch on, enter the Services ID as client ID, and create the
   **secret key** from the Team ID, Key ID, Services ID and the `.p8` file with the generator in
   Supabase's Apple guide (<https://supabase.com/docs/guides/auth/social-login/auth-apple>). Save.
   **This secret expires after 6 months**: put a reminder in your calendar to make a new one.
6. **Private relay emails**: people can hide their email from you; Apple then gives an address like
   `abc123@privaterelay.appleid.com` that forwards to them. Apple only forwards email from senders you
   register: **Certificates, Identifiers & Profiles → Services → Sign in with Apple for Email
   Communication → Configure**, and add the address in `EMAIL_FROM` (or your sending domain, with SPF
   set up). Otherwise codes and notices to those people are dropped.
7. Apple shares a person's name at most once, and often not with websites. Without it the welcome
   page simply greets them without a name, and they add their name in Settings.

### How it works on the site

- **New person**: after the provider, they land on **/welcome**, choose Student, Parent or Tutor
  (once; it can't be changed later), country and ZIP/PIN, and accept the terms. Students say their
  age: 13–17 need a parent's approval, under 13 are refused and nothing is kept. Until then the
  account can't see or do anything.
- **Same email as an existing account**: Supabase attaches the new sign-in to that account, and the
  site locks it until the owner types the 6-digit code emailed to the account's address ("Confirm
  it's you"). "This wasn't me" removes the new sign-in again. After that, the provider signs straight
  in. The owner gets a notice. An account whose email was never confirmed loses its unconfirmed
  password (Supabase does this), so nobody can sign up first with someone else's email.
- Passwords, Forgot password, email codes, two-step login, suspended accounts and admin all work the
  same for these accounts. A Google-only person can add a password in **Settings → Security**.
- **Connect from Settings**: signed-in people can connect Google / Facebook / Apple to their account
  (Settings → Security → Ways to sign in) and disconnect one while another way to sign in remains.
  For **Connect** to work, turn on **Authentication → Sign In / Providers → Allow manual linking**
  in Supabase (it's off by default; without it the button explains that connecting isn't switched
  on yet). Disconnecting works either way.
- Nothing new goes into `.env.local`. The site only needs `NEXT_PUBLIC_SITE_URL` to be the real
  address (it is used for the return address after sign-in).

## 9. Live classroom (video, screen share, shared whiteboard)

Online lessons open the TutorLink classroom: tutor and student see and hear each other, share
screens, draw on one whiteboard (the tutor can let the student draw, paste screenshots and save the
board to the lesson page), use the lesson chat, live captions and a transcript, and the tutor can let
in a guest from a guest link. Video goes through **LiveKit**, a media server. Until it's set up,
lessons use the basic classroom (your own camera, a whiteboard on your device, the chat).

**Option A: LiveKit Cloud (easiest).**

1. Create an account at <https://cloud.livekit.io> and a project (choose the region closest to most of
   your users).
2. **Settings → API keys → Create key.** Copy the **API key**, the **API secret** (shown once) and the
   project's **WebSocket URL** (`wss://<project>.livekit.cloud`).
3. Put them in `.env.local` (never in chat):
   ```
   LIVEKIT_API_KEY=…
   LIVEKIT_API_SECRET=…
   LIVEKIT_WS_URL=wss://<project>.livekit.cloud
   ```
4. Rebuild and restart the site. A lesson's classroom now opens the live room 15 minutes before it
   starts. The free plan has a monthly limit of minutes; check LiveKit's pricing page before launch.

**Option B: your own server.** Run LiveKit on a server with a public address (see
<https://docs.livekit.io/home/self-hosting/deployment/>), open its ports (7880 TCP for signalling
through your HTTPS proxy, 7881 TCP and 50000–60000 UDP for media), and set the same three values.
If browsers reach it through a path such as `wss://your-domain.com/livekit`, also set
`LIVEKIT_HOST_URL=http://127.0.0.1:7880` (admin calls need a bare address).

**Optional AI recap.** With `GEMINI_API_KEY` (from <https://aistudio.google.com/apikey>), the tutor's
caption transcript gets a short recap (summary, what was taught, homework) on the lesson page. The
transcript is sent to Google with contact details already hidden. Without the key nothing is sent and
the transcript is kept as it is.

How it behaves:

- The room is open from 15 minutes before the lesson until 30 minutes after it ends, or until the tutor
  presses **End class**. Rooms of finished lessons are closed automatically.
- The tutor hosts. The student (or parent) joins from the lesson page. Staff with "Bookings" permission
  can join as host; that's recorded in the audit log.
- **Guest link** (People panel or the lesson page): someone without an account enters their name and
  waits until the tutor admits them; it works only during this lesson, and "New link" or "Turn off"
  stops the old one.
- Chat in class is the family's normal conversation with the tutor, so contact details are blocked as
  everywhere else. Images put on the whiteboard and boards saved to the lesson page are read for
  contact details first; captions and transcripts have contact details hidden.
- Lessons where the tutor added a Zoom or Google Meet link keep using that meeting for video.

---

## Optional extras

| Feature | What to do |
|---|---|
| **Google / Facebook / Apple sign-in** | See step 8. The "Continue with …" buttons appear on the site automatically for each provider you switch on in Supabase. |
| **Emails from the site** (password reset links, parent approval for 13–17 students, and email copies of notifications: booking requests and changes, messages, payments, job applications, homework, account and security notices) | See step 7: an SMTP mailbox (`SMTP_*`) or a Resend API key (`RESEND_API_KEY`), plus `EMAIL_FROM`. Each person chooses which emails they get under **Notifications**; account and security notices always go out. Announcements are emailed only to people who switched on "Tips & product news". Without these settings, everything still shows in the site's notifications, but no email is sent. |
| **Scheduled jobs** (lesson reminders the day before and an hour before, expiring unanswered booking requests, finishing past lessons, closing finished classrooms) | Run by themselves at most every 5 minutes while people use the site. For reminders to be on time even when nobody is on the site, set `CRON_SECRET` to any long random text and have `https://your-domain.com/api/cron` called **every 10 minutes** with the header `Authorization: Bearer <CRON_SECRET>`: Vercel Pro can do it from `vercel.json`; on the free plan use a free service such as cron-job.org. (`vercel.json` already calls it once a day.) |

## Going live on Vercel

1. In Vercel → your project → **Settings → Environment Variables**, add the same values as in
   `.env.local` (with `NEXT_PUBLIC_SITE_URL` set to your real domain).
2. In Supabase → **Authentication → URL Configuration**, set the Site URL to the real domain and
   add it to the Redirect URLs.
3. Deploy. Open `https://your-domain.com/api/health` to check.

### Launch checklist

| | What | Why |
|---|---|---|
| ☐ | Your own domain with **https** (Vercel adds the certificate) | Emailed links (reset, confirm) only work with a real https address; phones need https for the camera in the classroom |
| ☐ | `NEXT_PUBLIC_SITE_URL=https://your-domain.com`, and the same address in Supabase → URL Configuration | Sign-in, email links and Google / Facebook / Apple return here |
| ☐ | Email from your domain (Resend or your domain's SMTP), `EMAIL_FROM` on that domain | Gmail sends at most ~500 a day and lands in spam more often |
| ☐ | `CRON_SECRET` and a call to `/api/cron` every 10 minutes (see "Scheduled jobs" above) | Lesson reminders on time |
| ☐ | Live classroom: LiveKit keys (step 9) | Video in lessons; without them lessons use the basic classroom |
| ☐ | Google / Facebook / Apple keys (step 8), if you want those buttons | Social sign-in |
| ☐ | Two-step login on every staff account (Admin → Security) | Protects the admin panel |
| ☐ | Supabase: **Allow manual linking** on (Authentication → Sign In / Providers), if you switched on Google / Facebook / Apple | "Connect" in Settings → Security |
| ☐ | Supabase: a paid plan with daily backups (or download a backup weekly) | So data can be restored |
| ☐ | A lawyer reads Terms, Privacy and Safety for the countries you serve | The texts are a starting point, not legal advice |
| ☐ | Payments connected (see below) before charging for lessons | Until then only free lessons can be booked |

Already in place: security headers on every page (no framing by other sites, HTTPS-only once seen,
no MIME sniffing, camera / microphone / screen only for this site), rate limits on sign-in, codes,
uploads and the classroom, a branded error page, and preview pictures when links are shared. Rate
limits are kept per server copy; if you run many copies at once, ask a developer to move them to a
shared store (for example Upstash Redis).

## What is not connected yet

These need an outside service and an account of your own before they can work. The site doesn't
pretend they work: the buttons say "not available yet" or the server refuses with a clear message.

- **Card and UPI payments** (Stripe or Razorpay). Until connected, trial lessons are free to book for
  everyone (families see "Free"; each tutor's own trial price applies once payments are connected),
  paid regular lessons can't be booked, and buying Study Credits, lead credits or a paid tutor plan is
  switched off. Bookings, trials included, follow the tutor's "approve each booking" setting: a request
  until the tutor accepts it, or booked straight away with instant booking on.
- **Payouts to tutors** (Stripe Connect).
- **Two-way video in the classroom** needs your LiveKit keys (step 9). Without them, lessons use the
  basic classroom (own camera, whiteboard and chat) or the tutor's Zoom / Google Meet link.
- **Text-message notifications** (Twilio).
