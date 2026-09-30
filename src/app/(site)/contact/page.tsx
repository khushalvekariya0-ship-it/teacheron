import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Flag, Mail, Phone, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/motion";
import { PageHero, Section } from "@/components/marketing/Section";
import { ContactForm } from "@/components/content/ContactForm";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact us",
  description: `Questions about finding a tutor, a booking, payments or becoming a tutor? Send the ${SITE.name} team a message or email ${SITE.supportEmail}.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="How can we help?" description="Send us a message and a real person on our team will reply by email. The more detail you share, the faster we can help." />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
          <Reveal>
            <div className="rounded-2xl border border-line bg-surface p-5 sm:p-8">
              <h2 className="font-heading text-2xl font-extrabold tracking-[-0.035em] text-ink">Send a message</h2>
              <p className="mb-6 mt-1 text-sm text-muted">We use what you send only to answer your request.</p>
              <ContactForm />
            </div>
          </Reveal>

          <Reveal delay={0.1} className="space-y-5">
            <div className="rounded-2xl bg-canvas p-6">
              <h2 className="flex items-center gap-2 text-[16px] font-bold text-ink">
                <Mail className="size-4 text-ink" aria-hidden /> Email us
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">Prefer email? Write to us directly and include any booking dates or tutor names.</p>
              <a href={`mailto:${SITE.supportEmail}`} className="mt-3 inline-block break-all text-[15px] font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
                {SITE.supportEmail}
              </a>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-6">
              <h2 className="text-[16px] font-bold text-ink">What to expect</h2>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-2">
                <li className="border-l-[3px] border-brand pl-3">Every message is read by a person on our team, and we reply by email.</li>
                <li className="border-l-[3px] border-brand pl-3">Safety concerns and questions about a lesson that&rsquo;s coming up soon are looked at first.</li>
                <li className="border-l-[3px] border-brand pl-3">You&rsquo;ll get a reference number when you send the form. Mention it if you write again.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-danger-200 bg-danger-50 p-6">
              <h2 className="flex items-center gap-2 text-[16px] font-bold text-ink">
                <Phone className="size-4 text-danger" aria-hidden /> In an emergency
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">If someone is in immediate danger, call 911 first. Then let us know so we can act on the account.</p>
            </div>

            <nav aria-label="Self-service help" className="rounded-2xl border border-line bg-surface p-2">
              {[
                { href: "/faq", icon: <BookOpen />, label: "Browse the FAQ", hint: "Answers to common questions" },
                { href: "/safety#report", icon: <Flag />, label: "Report a problem", hint: "Conversations, lessons or members" },
                { href: "/trust-safety", icon: <ShieldCheck />, label: "Trust & safety", hint: "Verification and safeguards" },
              ].map((l) => (
                <Link key={l.href} href={l.href} className="group flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-canvas">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-ink [&_svg]:size-4">{l.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">{l.label}</span>
                    <span className="block text-[13px] text-muted">{l.hint}</span>
                  </span>
                  <ArrowRight className="size-4 text-ink transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              ))}
            </nav>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
