import { ArrowLeft, ArrowRight, ExternalLink, LockKeyhole, MessageCircle } from "lucide-react";
import { AppShell } from "../components/app-shell.js";
import { BrandMark } from "../components/brand-mark.js";
import { ButtonLink, PageHeader } from "../components/ui.js";

export type GuideSlug = "whatsapp" | "household-invitations" | "collections-create" | "collections-share";

type Guide = {
  slug: GuideSlug;
  number: string;
  title: string;
  summary: string;
  example: string;
  outcome: string;
  steps: readonly { title: string; body: string }[];
};

export const guides: readonly Guide[] = [
  {
    slug: "whatsapp",
    number: "01",
    title: "Connect WhatsApp",
    summary: "Link a local runner so your household can send Fullwell restocking requests from WhatsApp.",
    example: "Connect Fullwell to WhatsApp for Maya's Household.",
    outcome: "Fullwell opens the browser and WhatsApp confirmations you need; the local runner keeps product reasoning and retailer access on your Mac.",
    steps: [
      { title: "Ask in chat", body: "Tell ChatGPT or Claude which cloud household should receive WhatsApp requests." },
      { title: "Review the browser setup", body: "Sign in to Fullwell and approve the runner-to-household link. Do not paste account codes or access keys into chat." },
      { title: "Confirm in WhatsApp", body: "Send the displayed one-time linking message, then approve the pending connection in Fullwell." },
      { title: "Keep the runner available", body: "The local runner must be running on your Mac to receive and complete restocking work. You can stop it later by asking in chat." },
    ],
  },
  {
    slug: "household-invitations",
    number: "02",
    title: "Invite household members",
    summary: "Create a one-time invitation for another person with the right household role.",
    example: "Invite Sam to Maya's Household as an editor.",
    outcome: "Fullwell creates a short-lived link you can send directly. The recipient reviews the household and explicitly joins with their own account.",
    steps: [
      { title: "Choose a role", body: "Editors can update journal content. Viewers can read and export it. Only a household owner can create the invitation." },
      { title: "Ask in chat", body: "Name the household, the person you are inviting, and the role you want them to have." },
      { title: "Send the one-time link", body: "Share only the invitation URL with the intended person. Opening the link does not join them automatically." },
      { title: "Let them confirm", body: "The recipient signs in with an individual account, reviews the details, and chooses Join household." },
    ],
  },
  {
    slug: "collections-create",
    number: "03",
    title: "Create a collection",
    summary: "Gather a deliberate set of recipes or snacks around a theme without publishing it yet.",
    example: "Make a collection called Weeknight favorites with the recipes we liked.",
    outcome: "Your agent finds candidate journal items, asks about ambiguous choices, and saves a private snapshot for review.",
    steps: [
      { title: "Describe the theme", body: "Tell ChatGPT or Claude the collection name and what belongs in it." },
      { title: "Review the candidates", body: "Fullwell shows the exact recorded items it found. Clarify any uncertain item rather than letting code guess." },
      { title: "Choose public details", body: "Add only descriptions and preparation notes that you would be comfortable sharing later." },
      { title: "Save it privately", body: "Creating the collection does not publish a link. You can review it from the household Collections page." },
    ],
  },
  {
    slug: "collections-share",
    number: "04",
    title: "Share a collection",
    summary: "Publish a privacy-reviewed collection snapshot with an expiring, revocable link.",
    example: "Share my Weeknight favorites collection for 7 days.",
    outcome: "Fullwell previews the public fields, asks for confirmation, and returns a link that reveals only that fixed snapshot.",
    steps: [
      { title: "Name the collection", body: "Ask ChatGPT or Claude to share an existing private collection and say how long its link should work." },
      { title: "Review the public snapshot", body: "Check every title, source, image, description, and preparation note. Household membership and purchase history stay private." },
      { title: "Confirm publication", body: "Publishing is a deliberate write. Approve it only after the preview matches what you intend to share." },
      { title: "Send or revoke the link", body: "Anyone with the active link can see the snapshot. Revoke it from the Collections page or ask your agent to revoke it." },
    ],
  },
];

export function GuidesRoute() {
  return (
    <AppShell active="guides">
      <section className="guides-page page-band">
        <div className="guides-layout">
          <div>
            <p className="eyebrow">Guides / Agent workflows</p>
            <PageHeader title="Do more with Fullwell in chat">
              <p>Step-by-step examples for useful household work with ChatGPT or Claude.</p>
            </PageHeader>
            <div className="guide-index">
              {guides.map((guide) => (
                <article className="guide-index__row" key={guide.slug}>
                  <span className="guide-index__number" aria-hidden="true">{guide.number}</span>
                  <div>
                    <h2><a href={guideHref(guide.slug)}>{guide.title}</a></h2>
                    <p>{guide.summary}</p>
                  </div>
                  <div className="guide-index__hosts" aria-label="Works with ChatGPT and Claude">
                    <BrandMark brand="chatgpt" /><span>ChatGPT</span>
                    <BrandMark brand="claude" /><span>Claude</span>
                  </div>
                  <a className="text-link text-link--arrow" href={guideHref(guide.slug)}>
                    Open guide <ArrowRight aria-hidden="true" size={17} />
                  </a>
                </article>
              ))}
            </div>
          </div>
          <aside className="guide-prompt-card">
            <p className="eyebrow">Try saying</p>
            <MessageCircle aria-hidden="true" size={26} />
            <blockquote>“{guides[0]?.example}”</blockquote>
            <p>Say it naturally. Fullwell will guide you through the decisions and open the browser when a secure confirmation is needed.</p>
          </aside>
        </div>
        <section className="guide-security">
          <LockKeyhole aria-hidden="true" size={25} />
          <div><h2>Sign-in and sharing stay in the browser</h2><p>Fullwell never asks you to paste passwords, access keys, or one-time account codes into chat.</p></div>
        </section>
      </section>
    </AppShell>
  );
}

export function GuideDetailRoute({ slug }: { slug: GuideSlug }) {
  const index = guides.findIndex((candidate) => candidate.slug === slug);
  const guide = guides[index];
  if (guide === undefined) return null;
  const previous = guides[index - 1];
  const next = guides[index + 1];
  return (
    <AppShell active="guides">
      <section className="guide-detail page-band">
        <a className="back-link" href="/guides"><ArrowLeft aria-hidden="true" size={17} /> All advanced guides</a>
        <header className="guide-detail__header">
          <span className="guide-detail__number" aria-hidden="true">{guide.number}</span>
          <div>
            <p className="eyebrow">Agent workflow</p>
            <h1>{guide.title}</h1>
            <p>{guide.summary}</p>
            <div className="guide-hosts">
              <span><BrandMark brand="chatgpt" /> ChatGPT</span>
              <span><BrandMark brand="claude" /> Claude</span>
            </div>
          </div>
        </header>
        <section className="guide-example" aria-labelledby="guide-example-heading">
          <div>
            <p className="eyebrow" id="guide-example-heading">Try saying</p>
            <blockquote>“{guide.example}”</blockquote>
          </div>
          <p>{guide.outcome}</p>
        </section>
        <ol className="guide-steps">
          {guide.steps.map((step, stepIndex) => (
            <li key={step.title}>
              <span aria-hidden="true">{String(stepIndex + 1).padStart(2, "0")}</span>
              <div><h2>{step.title}</h2><p>{step.body}</p></div>
            </li>
          ))}
        </ol>
        <section className="guide-install">
          <div><h2>Need Fullwell in your agent first?</h2><p>Install the shared Fullwell plugin, then return to this example in chat.</p></div>
          <div className="button-row">
            <ButtonLink href="/install?host=codex" variant="secondary"><BrandMark brand="chatgpt" /> Use with ChatGPT</ButtonLink>
            <ButtonLink href="/install?host=claude" variant="secondary"><BrandMark brand="claude" /> Use with Claude</ButtonLink>
          </div>
        </section>
        <nav className="guide-pagination" aria-label="Advanced guides">
          {previous === undefined ? <span /> : <a href={guideHref(previous.slug)}><ArrowLeft aria-hidden="true" size={17} /> {previous.title}</a>}
          {next === undefined ? <a href="/guides">All guides <ExternalLink aria-hidden="true" size={16} /></a> : <a href={guideHref(next.slug)}>{next.title} <ArrowRight aria-hidden="true" size={17} /></a>}
        </nav>
      </section>
    </AppShell>
  );
}

export function guideHref(slug: GuideSlug): string {
  if (slug === "collections-create") return "/guides/collections/create";
  if (slug === "collections-share") return "/guides/collections/share";
  return `/guides/${slug}`;
}
