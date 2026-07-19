import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { Fingerprint, Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import type { PasskeySummary } from "../types.js";
import { Button } from "./ui.js";

const Base64UrlSchema = z.string().min(1).max(1_000_000).regex(/^[A-Za-z0-9_-]+$/);
const TransportSchema = z.enum(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]);
const CredentialHintSchema = z.enum(["client-device", "hybrid", "security-key"]);
const CredentialDescriptorSchema = z.object({
  id: Base64UrlSchema,
  type: z.literal("public-key"),
  transports: z.array(TransportSchema).optional(),
}).strict();
const RegistrationOptionsSchema = z.object({
  rp: z.object({ id: z.string().min(1).optional(), name: z.string().min(1) }).strict(),
  user: z.object({ id: Base64UrlSchema, name: z.string().min(1), displayName: z.string().min(1) }).strict(),
  challenge: Base64UrlSchema,
  pubKeyCredParams: z.array(z.object({ alg: z.number().int(), type: z.literal("public-key") }).strict()).min(1),
  timeout: z.number().positive().optional(),
  excludeCredentials: z.array(CredentialDescriptorSchema).optional(),
  authenticatorSelection: z.object({
    authenticatorAttachment: z.enum(["cross-platform", "platform"]).optional(),
    requireResidentKey: z.boolean().optional(),
    residentKey: z.enum(["discouraged", "preferred", "required"]).optional(),
    userVerification: z.enum(["discouraged", "preferred", "required"]).optional(),
  }).strict().optional(),
  hints: z.array(CredentialHintSchema).optional(),
  attestation: z.enum(["direct", "enterprise", "indirect", "none"]).optional(),
  extensions: z.object({ credProps: z.boolean() }).strict().optional(),
}).strict();
const AuthenticationOptionsSchema = z.object({
  challenge: Base64UrlSchema,
  timeout: z.number().positive().optional(),
  rpId: z.string().min(1).optional(),
  allowCredentials: z.array(CredentialDescriptorSchema).optional(),
  userVerification: z.enum(["discouraged", "preferred", "required"]).optional(),
}).strict();
const AuthenticationStartSchema = z.object({
  transaction: z.string().min(32).max(512),
  publicOptions: AuthenticationOptionsSchema,
}).strict();
const RegistrationStartSchema = z.object({
  transaction: z.string().min(32).max(512),
  publicOptions: RegistrationOptionsSchema,
}).strict();
const AuthenticationCompleteSchema = z.object({ authenticated: z.literal(true), redirect_to: z.string().startsWith("/") }).strict();
const RegistrationCompleteSchema = z.object({
  id: Base64UrlSchema,
  name: z.string().min(1),
  created_at: z.iso.datetime({ offset: true }),
  last_used_at: z.iso.datetime({ offset: true }).nullable(),
}).strict();

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function performPasskeySignIn(input: {
  readonly fetcher: Fetcher;
  readonly navigate: (path: string) => void;
  readonly pendingIntent?: string | undefined;
  readonly authenticate?: typeof startAuthentication;
}): Promise<void> {
  const startResponse = await input.fetcher("/auth/passkey/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input.pendingIntent === undefined ? {} : { pending_intent: input.pendingIntent }),
  });
  await requireOk(startResponse, "Passkey sign-in could not start");
  const started = AuthenticationStartSchema.parse(await json(startResponse));
  const response = await (input.authenticate ?? startAuthentication)({ optionsJSON: authenticationOptions(started.publicOptions) });
  const completeResponse = await input.fetcher("/auth/passkey/authentication/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transaction: started.transaction, response }),
  });
  await requireOk(completeResponse, "Passkey sign-in could not be completed");
  const completed = AuthenticationCompleteSchema.parse(await json(completeResponse));
  input.navigate(completed.redirect_to);
}

export async function performPasskeyEnrollment(input: {
  readonly fetcher: Fetcher;
  readonly reload: () => void;
  readonly csrf: string;
  readonly register?: typeof startRegistration;
}): Promise<void> {
  const startResponse = await input.fetcher("/auth/passkey/registration/options", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csrf: input.csrf }),
  });
  await requireOk(startResponse, "Passkey enrollment could not start");
  const started = RegistrationStartSchema.parse(await json(startResponse));
  const response = await (input.register ?? startRegistration)({ optionsJSON: registrationOptions(started.publicOptions) });
  const completeResponse = await input.fetcher("/auth/passkey/registration/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csrf: input.csrf, transaction: started.transaction, response }),
  });
  await requireOk(completeResponse, "Passkey enrollment could not be completed");
  RegistrationCompleteSchema.parse(await json(completeResponse));
  input.reload();
}

export function PasskeySignInButton({ returnTo }: { returnTo?: string | undefined }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (typeof window !== "undefined" && !browserSupportsWebAuthn()) return null;

  const authenticate = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await performPasskeySignIn({
        fetcher: window.fetch.bind(window),
        navigate: (path) => window.location.assign(path),
        ...(returnTo === undefined ? {} : { pendingIntent: returnTo }),
      });
    } catch {
      setError("Passkey sign-in was cancelled or could not be completed.");
      setBusy(false);
    }
  };

  return (
    <div className="passkey-action">
      <Button className="button--full" type="button" variant="secondary" disabled={busy} onClick={() => void authenticate()}>
        <Fingerprint aria-hidden="true" size={20} /> {busy ? "Waiting for passkey" : "Sign in with a passkey"}
      </Button>
      {error === null ? null : <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

export function PasskeyEnrollment({ csrf, passkeys }: { csrf: string; passkeys: readonly PasskeySummary[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (typeof window !== "undefined" && !browserSupportsWebAuthn()) return null;

  const enroll = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await performPasskeyEnrollment({
        fetcher: window.fetch.bind(window),
        reload: () => window.location.reload(),
        csrf,
      });
    } catch {
      setError("Passkey enrollment was cancelled or could not be completed.");
      setBusy(false);
    }
  };

  return (
    <div className="passkey-action">
      <Button type="button" variant={passkeys.length === 0 ? "primary" : "secondary"} disabled={busy} onClick={() => void enroll()}>
        <Plus aria-hidden="true" size={18} /> {busy ? "Waiting for passkey" : "Add a passkey"}
      </Button>
      {error === null ? null : <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

async function json(response: Response): Promise<unknown> {
  const value: unknown = await response.json();
  return value;
}

async function requireOk(response: Response, message: string): Promise<void> {
  if (!response.ok) throw new Error(message);
}

function registrationOptions(parsed: z.infer<typeof RegistrationOptionsSchema>): PublicKeyCredentialCreationOptionsJSON {
  return {
    rp: { name: parsed.rp.name, ...(parsed.rp.id === undefined ? {} : { id: parsed.rp.id }) },
    user: parsed.user,
    challenge: parsed.challenge,
    pubKeyCredParams: parsed.pubKeyCredParams,
    ...(parsed.timeout === undefined ? {} : { timeout: parsed.timeout }),
    ...(parsed.excludeCredentials === undefined ? {} : { excludeCredentials: parsed.excludeCredentials.map(credentialDescriptor) }),
    ...(parsed.authenticatorSelection === undefined ? {} : {
      authenticatorSelection: {
        ...(parsed.authenticatorSelection.authenticatorAttachment === undefined ? {} : { authenticatorAttachment: parsed.authenticatorSelection.authenticatorAttachment }),
        ...(parsed.authenticatorSelection.requireResidentKey === undefined ? {} : { requireResidentKey: parsed.authenticatorSelection.requireResidentKey }),
        ...(parsed.authenticatorSelection.residentKey === undefined ? {} : { residentKey: parsed.authenticatorSelection.residentKey }),
        ...(parsed.authenticatorSelection.userVerification === undefined ? {} : { userVerification: parsed.authenticatorSelection.userVerification }),
      },
    }),
    ...(parsed.hints === undefined ? {} : { hints: parsed.hints }),
    ...(parsed.attestation === undefined ? {} : { attestation: parsed.attestation }),
    ...(parsed.extensions === undefined ? {} : { extensions: parsed.extensions }),
  };
}

function authenticationOptions(parsed: z.infer<typeof AuthenticationOptionsSchema>): PublicKeyCredentialRequestOptionsJSON {
  return {
    challenge: parsed.challenge,
    ...(parsed.timeout === undefined ? {} : { timeout: parsed.timeout }),
    ...(parsed.rpId === undefined ? {} : { rpId: parsed.rpId }),
    ...(parsed.allowCredentials === undefined ? {} : { allowCredentials: parsed.allowCredentials.map(credentialDescriptor) }),
    ...(parsed.userVerification === undefined ? {} : { userVerification: parsed.userVerification }),
  };
}

function credentialDescriptor(parsed: z.infer<typeof CredentialDescriptorSchema>) {
  return {
    id: parsed.id,
    type: parsed.type,
    ...(parsed.transports === undefined ? {} : { transports: parsed.transports }),
  };
}
