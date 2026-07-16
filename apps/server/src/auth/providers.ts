import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationExtensionsClientOutputs,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { z } from "zod";
import { AppError } from "../core/errors.js";
import type { PasskeyCredential, PasskeyProvider, PasskeyTransport } from "./types.js";

const Base64UrlSchema = z.string().min(1).max(1_000_000).regex(/^[A-Za-z0-9_-]+$/);
const TransportSchema = z.enum(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]);
const ClientExtensionResultsSchema = z.object({
  appid: z.boolean().optional(),
  credProps: z.object({ rk: z.boolean().optional() }).strict().optional(),
  hmacCreateSecret: z.boolean().optional(),
}).strict();
const CredentialResponseBaseSchema = z.object({
  id: Base64UrlSchema,
  rawId: Base64UrlSchema,
  authenticatorAttachment: z.enum(["cross-platform", "platform"]).optional(),
  clientExtensionResults: ClientExtensionResultsSchema,
  type: z.literal("public-key"),
});
const RegistrationResponseSchema = CredentialResponseBaseSchema.extend({
  response: z.object({
    clientDataJSON: Base64UrlSchema,
    attestationObject: Base64UrlSchema,
    authenticatorData: Base64UrlSchema.optional(),
    transports: z.array(TransportSchema).optional(),
    publicKeyAlgorithm: z.number().int().optional(),
    publicKey: Base64UrlSchema.optional(),
  }).strict(),
}).strict();
const AuthenticationResponseSchema = CredentialResponseBaseSchema.extend({
  response: z.object({
    clientDataJSON: Base64UrlSchema,
    authenticatorData: Base64UrlSchema,
    signature: Base64UrlSchema,
    userHandle: Base64UrlSchema.optional(),
  }).strict(),
}).strict();

export interface WebAuthnOperations {
  readonly generateRegistrationOptions: typeof generateRegistrationOptions;
  readonly verifyRegistrationResponse: typeof verifyRegistrationResponse;
  readonly generateAuthenticationOptions: typeof generateAuthenticationOptions;
  readonly verifyAuthenticationResponse: typeof verifyAuthenticationResponse;
}

const defaultOperations: WebAuthnOperations = {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
};

export class WebAuthnPasskeyProvider implements PasskeyProvider {
  constructor(
    private readonly config: { readonly rpName: string; readonly rpId: string; readonly origin: string },
    private readonly operations: WebAuthnOperations = defaultOperations,
  ) {}

  async beginRegistration(input: {
    readonly user: { readonly id: string; readonly displayName: string };
    readonly credentials: readonly PasskeyCredential[];
  }): Promise<{ readonly challenge: string; readonly publicOptions: object }> {
    const publicOptions = await this.operations.generateRegistrationOptions({
      rpName: this.config.rpName,
      rpID: this.config.rpId,
      userID: new TextEncoder().encode(input.user.id),
      userName: input.user.id,
      userDisplayName: input.user.displayName,
      timeout: 60_000,
      attestationType: "none",
      excludeCredentials: input.credentials.map(({ credentialId, transports }) => ({ id: credentialId, transports: [...transports] })),
      authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
      supportedAlgorithmIDs: [-7, -257],
    });
    return { challenge: publicOptions.challenge, publicOptions };
  }

  async completeRegistration(response: unknown, expectedChallenge: string): Promise<{
    readonly credentialId: string;
    readonly publicKey: Uint8Array;
    readonly counter: number;
    readonly transports: readonly PasskeyTransport[];
    readonly deviceType: PasskeyCredential["deviceType"];
    readonly backedUp: boolean;
  }> {
    const parsed = parseRegistrationResponse(response);
    const verification = await this.verifyRegistration(parsed, expectedChallenge);
    if (!verification.verified) throw new AppError("AUTH_REQUIRED", "Passkey enrollment could not be verified");
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    return {
      credentialId: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports ?? parsed.response.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    };
  }

  async beginAuthentication(): Promise<{ readonly challenge: string; readonly publicOptions: object }> {
    const publicOptions = await this.operations.generateAuthenticationOptions({
      rpID: this.config.rpId,
      timeout: 60_000,
      userVerification: "required",
    });
    return { challenge: publicOptions.challenge, publicOptions };
  }

  authenticationCredentialId(response: unknown): string {
    return parseAuthenticationResponse(response).id;
  }

  async completeAuthentication(
    response: unknown,
    expectedChallenge: string,
    credential: PasskeyCredential,
  ): Promise<{ readonly newCounter: number }> {
    const parsed = parseAuthenticationResponse(response);
    if (parsed.id !== credential.credentialId) throw new AppError("AUTH_REQUIRED", "Passkey sign-in could not be verified");
    const verification = await this.verifyAuthentication(parsed, expectedChallenge, credential);
    if (!verification.verified) throw new AppError("AUTH_REQUIRED", "Passkey sign-in could not be verified");
    return { newCounter: verification.authenticationInfo.newCounter };
  }

  private async verifyRegistration(response: RegistrationResponseJSON, expectedChallenge: string) {
    try {
      return await this.operations.verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.config.rpId,
        requireUserPresence: true,
        requireUserVerification: true,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("AUTH_REQUIRED", "Passkey enrollment could not be verified");
    }
  }

  private async verifyAuthentication(response: AuthenticationResponseJSON, expectedChallenge: string, credential: PasskeyCredential) {
    try {
      return await this.operations.verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.config.rpId,
        credential: {
          id: credential.credentialId,
          publicKey: new Uint8Array(credential.publicKey),
          counter: credential.counter,
          transports: [...credential.transports],
        },
        requireUserVerification: true,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("AUTH_REQUIRED", "Passkey sign-in could not be verified");
    }
  }
}

export class UnsupportedPasskeyProvider implements PasskeyProvider {
  async beginRegistration(): Promise<never> {
    throw new AppError("PROVIDER_UNAVAILABLE", "Passkey enrollment is not configured");
  }

  async completeRegistration(): Promise<never> {
    throw new AppError("PROVIDER_UNAVAILABLE", "Passkey enrollment is not configured");
  }

  async beginAuthentication(): Promise<never> {
    throw new AppError("PROVIDER_UNAVAILABLE", "Passkey sign-in is not configured");
  }

  authenticationCredentialId(): never {
    throw new AppError("PROVIDER_UNAVAILABLE", "Passkey sign-in is not configured");
  }

  async completeAuthentication(): Promise<never> {
    throw new AppError("PROVIDER_UNAVAILABLE", "Passkey sign-in is not configured");
  }
}

function parseRegistrationResponse(input: unknown): RegistrationResponseJSON {
  const parsed = RegistrationResponseSchema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION_FAILED", "The passkey enrollment response is invalid");
  const { response, ...credential } = parsed.data;
  return {
    id: credential.id,
    rawId: credential.rawId,
    type: credential.type,
    clientExtensionResults: clientExtensionResults(credential.clientExtensionResults),
    ...(credential.authenticatorAttachment === undefined ? {} : { authenticatorAttachment: credential.authenticatorAttachment }),
    response: {
      clientDataJSON: response.clientDataJSON,
      attestationObject: response.attestationObject,
      ...(response.authenticatorData === undefined ? {} : { authenticatorData: response.authenticatorData }),
      ...(response.transports === undefined ? {} : { transports: response.transports }),
      ...(response.publicKeyAlgorithm === undefined ? {} : { publicKeyAlgorithm: response.publicKeyAlgorithm }),
      ...(response.publicKey === undefined ? {} : { publicKey: response.publicKey }),
    },
  };
}

function parseAuthenticationResponse(input: unknown): AuthenticationResponseJSON {
  const parsed = AuthenticationResponseSchema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION_FAILED", "The passkey sign-in response is invalid");
  const { response, ...credential } = parsed.data;
  return {
    id: credential.id,
    rawId: credential.rawId,
    type: credential.type,
    clientExtensionResults: clientExtensionResults(credential.clientExtensionResults),
    ...(credential.authenticatorAttachment === undefined ? {} : { authenticatorAttachment: credential.authenticatorAttachment }),
    response: {
      clientDataJSON: response.clientDataJSON,
      authenticatorData: response.authenticatorData,
      signature: response.signature,
      ...(response.userHandle === undefined ? {} : { userHandle: response.userHandle }),
    },
  };
}

function clientExtensionResults(input: z.infer<typeof ClientExtensionResultsSchema>): AuthenticationExtensionsClientOutputs {
  return {
    ...(input.appid === undefined ? {} : { appid: input.appid }),
    ...(input.credProps === undefined ? {} : {
      credProps: input.credProps.rk === undefined ? {} : { rk: input.credProps.rk },
    }),
    ...(input.hmacCreateSecret === undefined ? {} : { hmacCreateSecret: input.hmacCreateSecret }),
  };
}
