import { useState } from "react";
import { ArrowRight, Check, Clipboard, MessageCircle, Terminal } from "lucide-react";
import { AppShell } from "../components/app-shell.js";
import { BrandMark } from "../components/brand-mark.js";
import { Button, ButtonLink, PageHeader } from "../components/ui.js";
import { useWebContext } from "../context.js";

export function InstallRoute({ initialHost }: { initialHost: "codex" | "claude" }) {
  const { install } = useWebContext();
  const hostDetails = install.hosts;
  const [host, setHost] = useState(initialHost);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptCopyFailed, setPromptCopyFailed] = useState(false);
  const detail = hostDetails[host];

  async function copyCommand() {
    await navigator.clipboard.writeText(detail.command);
    setCopied(true);
    setCopyFailed(false);
  }

  function requestCopy(): void {
    copyCommand().catch(() => setCopyFailed(true));
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(detail.setupPrompt);
    setPromptCopied(true);
    setPromptCopyFailed(false);
  }

  function requestPromptCopy(): void {
    copyPrompt().catch(() => setPromptCopyFailed(true));
  }

  return (
    <AppShell>
      <section className="install-hero page-band">
        <PageHeader title="Your household food journal, in the agent you already use">
          <p>
            Fullwell helps your family remember recurring groceries, recipe history, and collections
            without asking anyone to manage files or passwords. Start locally without an account;
            connect Fullwell later only if you want cloud backup, WhatsApp, sharing, or family access.
          </p>
        </PageHeader>
        <div className="host-chooser" role="group" aria-label="Choose your agent">
          {(["codex", "claude"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={host === option}
              onClick={() => {
                setHost(option);
                setCopied(false);
                setCopyFailed(false);
                setPromptCopied(false);
                setPromptCopyFailed(false);
              }}
            >
              <BrandMark brand={option === "codex" ? "chatgpt" : "claude"} />
              Use with {hostDetails[option].label}
            </button>
          ))}
        </div>
        <noscript><p><a href="/install?host=codex">Use with ChatGPT</a> · <a href="/install?host=claude">Use with Claude</a></p></noscript>
        <section className="install-step" aria-labelledby="install-heading">
          <div className="install-step__number" aria-hidden="true">1</div>
          <div>
            <h2 id="install-heading">Install for {detail.label}</h2>
            <p>Run this current command in your terminal.</p>
            <div className="command-box">
              <Terminal aria-hidden="true" size={20} />
              <code>{detail.command}</code>
              <Button type="button" variant="quiet" onClick={requestCopy} title="Copy install command">
                {copied ? <Check aria-hidden="true" size={18} /> : <Clipboard aria-hidden="true" size={18} />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            {copyFailed ? <span className="share-failure" role="status">Copy failed. Select the command text instead.</span> : null}
          </div>
        </section>
        <section className="install-step" aria-labelledby="start-heading">
          <div className="install-step__number" aria-hidden="true">2</div>
          <div>
            <h2 id="start-heading">Start a conversation</h2>
            <p>{detail.next}</p>
            {detail.setupHref === null ? null : (
              <ButtonLink href={detail.setupHref} className="setup-conversation-link">
                <MessageCircle aria-hidden="true" size={18} /> Start Fullwell setup
              </ButtonLink>
            )}
            <p>{detail.setupHref === null ? `Open ${detail.label} and send:` : "Or send this in Codex:"}</p>
            <div className="command-box setup-prompt">
              <MessageCircle aria-hidden="true" size={20} />
              <code>{detail.setupPrompt}</code>
              <Button type="button" variant="quiet" onClick={requestPromptCopy} title="Copy setup prompt">
                {promptCopied ? <Check aria-hidden="true" size={18} /> : <Clipboard aria-hidden="true" size={18} />}
                {promptCopied ? "Copied" : "Copy prompt"}
              </Button>
            </div>
            {promptCopyFailed ? <span className="share-failure" role="status">Copy failed. Select the setup prompt instead.</span> : null}
            {detail.setupHref === null ? null : <p className="fine-print">The button fills a new conversation. Review the prompt, then press Send.</p>}
            <p className="trust-line">No account is required to start. If you connect one later, sign-in opens in your browser; never paste a code or access key into chat.</p>
          </div>
        </section>
        <details className="trouble">
          <summary>Having trouble?</summary>
          <p>Check that your agent is current, then try the command again. Reinstalling the client does not remove your local journal or cloud household.</p>
          <a href="mailto:support@fullwell.example">Contact support</a>
        </details>
        <p className="install-guides"><a className="text-link text-link--arrow" href="/guides">Explore advanced agent guides <ArrowRight aria-hidden="true" size={17} /></a></p>
        <a className="text-link text-link--arrow" href="/sign-in">
          Sign in to an existing account <ArrowRight aria-hidden="true" size={17} />
        </a>
      </section>
    </AppShell>
  );
}
