import { describe, expect, it } from "vitest";
import { UserIdSchema } from "@hfj/contracts";
import { AppError } from "../core/errors.js";
import { UnsupportedPasskeyProvider, WebAuthnPasskeyProvider, type WebAuthnOperations } from "./providers.js";
import type { PasskeyCredential } from "./types.js";

const registrationResponse = {
  id: "credential_21",
  rawId: "credential_21",
  type: "public-key",
  authenticatorAttachment: "platform",
  clientExtensionResults: { appid: false, credProps: { rk: true }, hmacCreateSecret: true },
  response: {
    clientDataJSON: "client_data",
    attestationObject: "attestation_data",
    authenticatorData: "authenticator_data",
    transports: ["internal"],
    publicKeyAlgorithm: -7,
    publicKey: "public_key",
  },
};
const authenticationResponse = {
  id: "credential_21",
  rawId: "credential_21",
  type: "public-key",
  authenticatorAttachment: "platform",
  clientExtensionResults: { appid: false, credProps: {}, hmacCreateSecret: true },
  response: {
    clientDataJSON: "client_data",
    authenticatorData: "authenticator_data",
    signature: "signature_data",
    userHandle: "dXNlcl8wMDAwMDAwMDAwMDAwOTIx",
  },
};
const credential: PasskeyCredential = {
  credentialId: "credential_21",
  userId: UserIdSchema.parse("usr_0000000000000921"),
  publicKey: new Uint8Array([1, 2, 3]),
  counter: 4,
  transports: ["internal"],
  deviceType: "multiDevice",
  backedUp: true,
  name: "Passkey",
  createdAt: "2026-07-15T12:00:00.000Z",
  lastUsedAt: null,
};

function operations(overrides: {
  readonly registrationError?: "app" | "generic";
  readonly authenticationError?: "app" | "generic";
  readonly registrationVerified?: boolean;
  readonly authenticationVerified?: boolean;
  readonly omitCredentialTransports?: boolean;
} = {}): WebAuthnOperations {
  return {
    async generateRegistrationOptions(input) {
      return {
        rp: { id: input.rpID, name: input.rpName },
        user: { id: "dXNlcl8wMDAwMDAwMDAwMDAwOTIx", name: input.userName, displayName: input.userDisplayName ?? input.userName },
        challenge: "registration_challenge",
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        ...(input.timeout === undefined ? {} : { timeout: input.timeout }),
        ...(input.excludeCredentials === undefined ? {} : {
          excludeCredentials: input.excludeCredentials.map((entry) => ({
            id: entry.id,
            type: "public-key" as const,
            ...(entry.transports === undefined ? {} : { transports: entry.transports }),
          })),
        }),
        ...(input.authenticatorSelection === undefined ? {} : { authenticatorSelection: input.authenticatorSelection }),
        ...(input.attestationType === undefined ? {} : { attestation: input.attestationType }),
      };
    },
    async verifyRegistrationResponse(input) {
      if (overrides.registrationError === "app") throw new AppError("AUTH_REQUIRED", "registration rejected");
      if (overrides.registrationError === "generic") throw new Error("invalid attestation");
      expect(input.expectedChallenge).toBe("registration_challenge");
      expect(input.expectedOrigin).toBe("https://journal.example.test");
      expect(input.requireUserVerification).toBe(true);
      if (overrides.registrationVerified === false) return { verified: false };
      return {
        verified: true,
        registrationInfo: {
          fmt: "none",
          aaguid: "00000000-0000-0000-0000-000000000000",
          credential: {
            id: "credential_21",
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 4,
            ...(overrides.omitCredentialTransports === true ? {} : { transports: ["internal" as const] }),
          },
          credentialType: "public-key",
          attestationObject: new Uint8Array([4, 5, 6]),
          userVerified: true,
          credentialDeviceType: "multiDevice",
          credentialBackedUp: true,
          origin: "https://journal.example.test",
          rpID: "journal.example.test",
        },
      };
    },
    async generateAuthenticationOptions(input) {
      return {
        challenge: "authentication_challenge",
        rpId: input.rpID,
        ...(input.timeout === undefined ? {} : { timeout: input.timeout }),
        ...(input.userVerification === undefined ? {} : { userVerification: input.userVerification }),
      };
    },
    async verifyAuthenticationResponse(input) {
      if (overrides.authenticationError === "app") throw new AppError("AUTH_REQUIRED", "authentication rejected");
      if (overrides.authenticationError === "generic") throw new Error("invalid assertion");
      expect(input.expectedChallenge).toBe("authentication_challenge");
      expect(input.credential.counter).toBe(4);
      expect(input.requireUserVerification).toBe(true);
      if (overrides.authenticationVerified === false) return {
        verified: false,
        authenticationInfo: {
          credentialID: "credential_21",
          newCounter: 5,
          userVerified: false,
          credentialDeviceType: "multiDevice",
          credentialBackedUp: true,
          origin: "https://journal.example.test",
          rpID: "journal.example.test",
        },
      };
      return {
        verified: true,
        authenticationInfo: {
          credentialID: "credential_21",
          newCounter: 5,
          userVerified: true,
          credentialDeviceType: "multiDevice",
          credentialBackedUp: true,
          origin: "https://journal.example.test",
          rpID: "journal.example.test",
        },
      };
    },
  };
}

function provider(overrides?: Parameters<typeof operations>[0]) {
  return new WebAuthnPasskeyProvider(
    { rpName: "Fullwell", rpId: "journal.example.test", origin: "https://journal.example.test" },
    operations(overrides),
  );
}

describe("WebAuthnPasskeyProvider", () => {
  it("requires discoverable credentials and user verification for registration and authentication", async () => {
    const passkeys = provider();
    const registration = await passkeys.beginRegistration({
      user: { id: credential.userId, displayName: "Kitchen Owner" },
      credentials: [credential],
    });
    expect(registration.publicOptions).toMatchObject({
      challenge: "registration_challenge",
      authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
      excludeCredentials: [{ id: credential.credentialId }],
    });
    const created = await passkeys.completeRegistration(registrationResponse, registration.challenge);
    expect(created).toMatchObject({ credentialId: credential.credentialId, counter: 4, backedUp: true });
    expect(created.publicKey).toEqual(new Uint8Array([1, 2, 3]));

    const authentication = await passkeys.beginAuthentication();
    expect(authentication.publicOptions).toMatchObject({ userVerification: "required" });
    expect(passkeys.authenticationCredentialId(authenticationResponse)).toBe(credential.credentialId);
    await expect(passkeys.completeAuthentication(authenticationResponse, authentication.challenge, credential)).resolves.toEqual({ newCounter: 5 });
  });

  it("rejects malformed, mismatched, and cryptographically invalid responses", async () => {
    const passkeys = provider();
    expect(() => passkeys.authenticationCredentialId({ id: "not valid!" })).toThrow(/invalid/);
    await expect(passkeys.completeRegistration({}, "challenge")).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(passkeys.completeAuthentication({ ...authenticationResponse, id: "credential_22" }, "authentication_challenge", credential))
      .rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(provider({ registrationError: "generic" }).completeRegistration(registrationResponse, "registration_challenge"))
      .rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(provider({ authenticationError: "generic" }).completeAuthentication(authenticationResponse, "authentication_challenge", credential))
      .rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(provider({ registrationError: "app" }).completeRegistration(registrationResponse, "registration_challenge"))
      .rejects.toThrow("registration rejected");
    await expect(provider({ authenticationError: "app" }).completeAuthentication(authenticationResponse, "authentication_challenge", credential))
      .rejects.toThrow("authentication rejected");
    await expect(provider({ registrationVerified: false }).completeRegistration(registrationResponse, "registration_challenge"))
      .rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(provider({ authenticationVerified: false }).completeAuthentication(authenticationResponse, "authentication_challenge", credential))
      .rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("uses browser transports when verification omits them and accepts empty extension output", async () => {
    const passkeys = provider({ omitCredentialTransports: true });
    await expect(passkeys.completeRegistration(registrationResponse, "registration_challenge"))
      .resolves.toMatchObject({ transports: ["internal"] });
    await expect(passkeys.completeRegistration({
      ...registrationResponse,
      authenticatorAttachment: undefined,
      clientExtensionResults: {},
      response: {
        clientDataJSON: registrationResponse.response.clientDataJSON,
        attestationObject: registrationResponse.response.attestationObject,
      },
    }, "registration_challenge")).resolves.toMatchObject({ transports: [] });
    expect(passkeys.authenticationCredentialId({
      id: authenticationResponse.id,
      rawId: authenticationResponse.rawId,
      type: authenticationResponse.type,
      clientExtensionResults: {},
      response: {
        clientDataJSON: authenticationResponse.response.clientDataJSON,
        authenticatorData: authenticationResponse.response.authenticatorData,
        signature: authenticationResponse.response.signature,
      },
    })).toBe(authenticationResponse.id);
  });

  it("fails every operation explicitly when the provider is disabled", async () => {
    const passkeys = new UnsupportedPasskeyProvider();
    await expect(passkeys.beginRegistration()).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    await expect(passkeys.completeRegistration()).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    await expect(passkeys.beginAuthentication()).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(() => passkeys.authenticationCredentialId()).toThrow(/not configured/);
    await expect(passkeys.completeAuthentication()).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });
});
