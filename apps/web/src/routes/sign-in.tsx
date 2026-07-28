import { Mail } from "lucide-react";
import { AppShell } from "../components/app-shell.js";
import { BrandMark } from "../components/brand-mark.js";
import { PasskeySignInButton } from "../components/passkey-actions.js";
import { Button, Field, PageHeader, StatusNotice, TextInput } from "../components/ui.js";
import { useWebContext } from "../context.js";

export function SignInRoute({ emailSent, returnTo }: { emailSent: boolean; returnTo?: string | undefined }) {
  const { auth } = useWebContext();
  return (
    <AppShell context="focused">
      <section className="auth-layout page-band">
        <div className="auth-intro">
          <PageHeader title="Sign in to Fullwell">
            <p>Your individual cloud account keeps household changes attributable while letting your family collaborate.</p>
          </PageHeader>
          {returnTo ? <p className="pending-intent">After sign-in, you’ll return to what you were doing.</p> : null}
        </div>
        <div className="auth-panel">
          {emailSent ? (
            <StatusNotice tone="success" title="Check your email">
              <p>If the address can sign in, a one-time link is on its way. It expires in 15 minutes.</p>
            </StatusNotice>
          ) : null}
          <form action="/auth/apple/start" method="post">
            {returnTo ? <input type="hidden" name="pending_intent" value={returnTo} /> : null}
            <Button className="button--full apple-button" type="submit">
              <BrandMark brand="apple" size={21} /> Continue with Apple
            </Button>
          </form>
          {auth.passkeysEnabled ? (
            <PasskeySignInButton returnTo={returnTo} />
          ) : null}
          <div className="auth-divider"><span>or</span></div>
          <form action="/auth/magic-link" method="post" className="stack-form">
            {returnTo ? <input type="hidden" name="pending_intent" value={returnTo} /> : null}
            <Field label="Email address" hint="We never reveal whether an address already has a cloud account.">
              <TextInput name="email" type="email" autoComplete="email" required />
            </Field>
            <Button type="submit" variant="secondary">
              <Mail aria-hidden="true" size={19} /> Email me a sign-in link
            </Button>
          </form>
          <p className="fine-print">By continuing, you agree to the <a href="/terms">Terms</a> and acknowledge the <a href="/privacy">Privacy Policy</a>.</p>
        </div>
      </section>
    </AppShell>
  );
}
