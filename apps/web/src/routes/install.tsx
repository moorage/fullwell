import { useState } from "react";
import { ArrowRight, Check, Clipboard, Terminal } from "lucide-react";
import { AppShell } from "../components/app-shell.js";
import { Button, PageHeader } from "../components/ui.js";
import { useWebContext } from "../context.js";

export function InstallRoute({ initialHost }: { initialHost: "codex" | "claude" }) {
  const { install } = useWebContext();
  const hostDetails = install.hosts;
  const [host, setHost] = useState(initialHost);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const detail = hostDetails[host];

  async function copyCommand() {
    await navigator.clipboard.writeText(detail.command);
    setCopied(true);
    setCopyFailed(false);
  }

  function requestCopy(): void {
    copyCommand().catch(() => setCopyFailed(true));
  }

  return (
    <AppShell>
      <section className="install-hero page-band">
        <PageHeader title="Your household food journal, in the agent you already use">
          <p>
            Fullwell helps your family remember recurring groceries, recipe history, and collections
            without asking anyone to manage files or passwords.
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
              }}
            >
              Use with {hostDetails[option].label}
            </button>
          ))}
        </div>
        <noscript><p><a href="/install?host=codex">Use with Codex</a> · <a href="/install?host=claude">Use with Claude</a></p></noscript>
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
            <span className="share-failure" role="status">{copyFailed ? "Copy failed. Select the command text instead." : null}</span>
          </div>
        </section>
        <section className="install-step" aria-labelledby="start-heading">
          <div className="install-step__number" aria-hidden="true">2</div>
          <div>
            <h2 id="start-heading">Start a conversation</h2>
            <p>{detail.next}</p>
            <p className="trust-line">Sign-in opens in your browser. Never paste a code or access key into chat.</p>
          </div>
        </section>
        <details className="trouble">
          <summary>Having trouble?</summary>
          <p>Check that your agent is current, then try the command again. Your household data remains on Fullwell if you reinstall the client.</p>
          <a href="mailto:support@fullwell.example">Contact support</a>
        </details>
        <a className="text-link text-link--arrow" href="/sign-in">
          Sign in to an existing account <ArrowRight aria-hidden="true" size={17} />
        </a>
      </section>
    </AppShell>
  );
}
