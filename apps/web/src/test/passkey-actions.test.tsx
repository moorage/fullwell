import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PasskeyEnrollment,
  PasskeySignInButton,
  performPasskeyEnrollment,
  performPasskeySignIn,
} from "../components/passkey-actions.js";

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function queuedFetcher(responses: readonly Response[]) {
  const queue = [...responses];
  const calls: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ input, init });
    const response = queue.shift();
    if (response === undefined) throw new Error("Unexpected request");
    return response;
  };
  return { calls, fetcher };
}

describe("passkey browser actions", () => {
  it("performs discoverable authentication and resumes the pending intent", async () => {
    const request = queuedFetcher([
      jsonResponse({
        transaction: "t".repeat(32),
        publicOptions: {
          challenge: "authentication_challenge",
          timeout: 60_000,
          rpId: "journal.example.test",
          allowCredentials: [
            { id: "credential_41", type: "public-key", transports: ["internal"] },
            { id: "credential_42", type: "public-key" },
          ],
          userVerification: "required",
        },
      }),
      jsonResponse({ authenticated: true, redirect_to: "/account" }),
    ]);
    const authenticate = vi.fn(async () => ({
      id: "credential_41",
      rawId: "credential_41",
      type: "public-key" as const,
      clientExtensionResults: {},
      response: { clientDataJSON: "client_data", authenticatorData: "authenticator_data", signature: "signature_data" },
    }));
    const navigate = vi.fn();
    await performPasskeySignIn({ fetcher: request.fetcher, navigate, pendingIntent: "/account", authenticate });
    expect(authenticate).toHaveBeenCalledWith({ optionsJSON: expect.objectContaining({
      userVerification: "required",
      allowCredentials: [{ id: "credential_41", type: "public-key", transports: ["internal"] }, { id: "credential_42", type: "public-key" }],
    }) });
    expect(requestBody(request.calls, 0)).toEqual({ pending_intent: "/account" });
    expect(requestBody(request.calls, 1)).toMatchObject({ transaction: "t".repeat(32), response: { id: "credential_41" } });
    expect(navigate).toHaveBeenCalledWith("/account");
  });

  it("performs registration and reloads only after server verification", async () => {
    const request = queuedFetcher([
      jsonResponse({
        transaction: "r".repeat(32),
        publicOptions: {
          rp: { id: "journal.example.test", name: "Fullwell" },
          user: { id: "dXNlcl80MQ", name: "usr_41", displayName: "Kitchen Owner" },
          challenge: "registration_challenge",
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          timeout: 60_000,
          excludeCredentials: [
            { id: "credential_40", type: "public-key", transports: ["internal"] },
            { id: "credential_39", type: "public-key" },
          ],
          authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "required", requireResidentKey: true, userVerification: "required" },
          hints: [],
          attestation: "none",
          extensions: { credProps: true },
        },
      }),
      jsonResponse({ id: "credential_41", name: "Passkey", created_at: "2026-07-15T12:00:00.000Z", last_used_at: null }),
    ]);
    const register = vi.fn(async () => ({
      id: "credential_41",
      rawId: "credential_41",
      type: "public-key" as const,
      clientExtensionResults: {},
      response: { clientDataJSON: "client_data", attestationObject: "attestation_data" },
    }));
    const reload = vi.fn();
    await performPasskeyEnrollment({ fetcher: request.fetcher, reload, csrf: "c".repeat(32), register });
    expect(register).toHaveBeenCalledWith({ optionsJSON: expect.objectContaining({
      authenticatorSelection: expect.objectContaining({ authenticatorAttachment: "platform", userVerification: "required" }),
      excludeCredentials: [{ id: "credential_40", type: "public-key", transports: ["internal"] }, { id: "credential_39", type: "public-key" }],
      hints: [],
      extensions: { credProps: true },
    }) });
    expect(requestBody(request.calls, 1)).toMatchObject({ csrf: "c".repeat(32), response: { id: "credential_41" } });
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not invoke the authenticator or navigation when the server rejects start", async () => {
    const authenticate = vi.fn();
    const navigate = vi.fn();
    await expect(performPasskeySignIn({
      fetcher: queuedFetcher([jsonResponse({ error: true }, 429)]).fetcher,
      authenticate,
      navigate,
    })).rejects.toThrow(/could not start/);
    expect(authenticate).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("accepts minimal server-owned options and omits absent WebAuthn fields", async () => {
    const signInRequest = queuedFetcher([
      jsonResponse({ transaction: "s".repeat(32), publicOptions: { challenge: "sign_in_challenge" } }),
      jsonResponse({ authenticated: true, redirect_to: "/households" }),
    ]);
    const authenticate = vi.fn(async () => authenticationCredential());
    await performPasskeySignIn({ fetcher: signInRequest.fetcher, navigate: vi.fn(), authenticate });
    expect(authenticate).toHaveBeenCalledWith({ optionsJSON: { challenge: "sign_in_challenge" } });
    expect(requestBody(signInRequest.calls, 0)).toEqual({});

    const enrollmentRequest = queuedFetcher([
      jsonResponse({
        transaction: "e".repeat(32),
        publicOptions: {
          rp: { name: "Fullwell" },
          user: { id: "dXNlcl80Mg", name: "usr_42", displayName: "Kitchen Member" },
          challenge: "enrollment_challenge",
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: {},
        },
      }),
      jsonResponse({ id: "credential_42", name: "Passkey", created_at: "2026-07-15T12:00:00.000Z", last_used_at: null }),
    ]);
    const register = vi.fn(async () => registrationCredential());
    await performPasskeyEnrollment({ fetcher: enrollmentRequest.fetcher, reload: vi.fn(), csrf: "d".repeat(32), register });
    expect(register).toHaveBeenCalledWith({ optionsJSON: {
      rp: { name: "Fullwell" },
      user: { id: "dXNlcl80Mg", name: "usr_42", displayName: "Kitchen Member" },
      challenge: "enrollment_challenge",
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      authenticatorSelection: {},
    } });
  });

  it("does not navigate or reload when completion fails", async () => {
    const navigate = vi.fn();
    await expect(performPasskeySignIn({
      fetcher: queuedFetcher([
        jsonResponse({ transaction: "s".repeat(32), publicOptions: { challenge: "sign_in_challenge" } }),
        jsonResponse({ error: true }, 401),
      ]).fetcher,
      navigate,
      authenticate: vi.fn(async () => authenticationCredential()),
    })).rejects.toThrow(/could not be completed/);
    expect(navigate).not.toHaveBeenCalled();

    const reload = vi.fn();
    await expect(performPasskeyEnrollment({
      fetcher: queuedFetcher([
        jsonResponse({
          transaction: "e".repeat(32),
          publicOptions: {
            rp: { name: "Fullwell" },
            user: { id: "dXNlcl80Mg", name: "usr_42", displayName: "Kitchen Member" },
            challenge: "enrollment_challenge",
            pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          },
        }),
        jsonResponse({ error: true }, 409),
      ]).fetcher,
      reload,
      csrf: "d".repeat(32),
      register: vi.fn(async () => registrationCredential()),
    })).rejects.toThrow(/could not be completed/);
    expect(reload).not.toHaveBeenCalled();
  });

  it("surfaces component failures and hides passkey controls in unsupported browsers", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockRejectedValue(new Error("offline"));
    render(<PasskeySignInButton returnTo="/account" />);
    fireEvent.click(screen.getByRole("button", { name: /sign in with a passkey/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/cancelled or could not be completed/);
    await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
    fetchMock.mockRestore();
    cleanup();

    const enrollmentFetch = vi.spyOn(window, "fetch").mockRejectedValue(new Error("offline"));
    render(<PasskeyEnrollment csrf={"c".repeat(32)} passkeys={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /add a passkey/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/cancelled or could not be completed/);
    enrollmentFetch.mockRestore();
    cleanup();

    const supportedCredential = globalThis.PublicKeyCredential;
    Object.defineProperty(globalThis, "PublicKeyCredential", { configurable: true, value: undefined });
    const { container: signIn } = render(<PasskeySignInButton />);
    const { container: enrollment } = render(<PasskeyEnrollment csrf={"c".repeat(32)} passkeys={[]} />);
    expect(signIn).toBeEmptyDOMElement();
    expect(enrollment).toBeEmptyDOMElement();
    Object.defineProperty(globalThis, "PublicKeyCredential", { configurable: true, value: supportedCredential });
  });
});

function authenticationCredential() {
  return {
    id: "credential_42",
    rawId: "credential_42",
    type: "public-key" as const,
    clientExtensionResults: {},
    response: { clientDataJSON: "client_data", authenticatorData: "authenticator_data", signature: "signature_data" },
  };
}

function registrationCredential() {
  return {
    id: "credential_42",
    rawId: "credential_42",
    type: "public-key" as const,
    clientExtensionResults: {},
    response: { clientDataJSON: "client_data", attestationObject: "attestation_data" },
  };
}

function requestBody(calls: ReadonlyArray<{ readonly init: RequestInit | undefined }>, index: number): unknown {
  const body = calls[index]?.init?.body;
  if (typeof body !== "string") throw new Error("Request body was not JSON text");
  const parsed: unknown = JSON.parse(body);
  return parsed;
}
