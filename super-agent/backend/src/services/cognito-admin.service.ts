/**
 * Cognito Admin Service
 *
 * Uses the Cognito Identity Provider Admin APIs to create pre-verified users
 * without requiring email confirmation — useful when email sending is not set up.
 */

import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminDeleteUserCommand,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';
import { config } from '../config/index.js';

const cognitoAdmin = new CognitoIdentityProviderClient({
  region: config.cognito.region,
  ...(config.cognitoCredentials.accessKeyId && config.cognitoCredentials.secretAccessKey
    ? {
        credentials: {
          accessKeyId: config.cognitoCredentials.accessKeyId,
          secretAccessKey: config.cognitoCredentials.secretAccessKey,
        },
      }
    : {}),
});

export interface CreateUserResult {
  sub: string;
  username: string;
}

/**
 * Creates a Cognito user with a permanent password (no email verification needed).
 * Uses SUPPRESS to skip the welcome email, then sets a permanent password immediately.
 */
export async function adminCreateUser(
  username: string,
  password: string,
  orgId: string,
  role: string,
): Promise<CreateUserResult> {
  // Step 1: Create the user (suppress welcome email)
  const createResult = await cognitoAdmin.send(
    new AdminCreateUserCommand({
      UserPoolId: config.cognito.userPoolId,
      Username: username,
      MessageAction: MessageActionType.SUPPRESS,
      UserAttributes: [
        { Name: 'email', Value: username },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'custom:orgId', Value: orgId },
        { Name: 'custom:role', Value: role },
      ],
    }),
  );

  const sub = createResult.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
  if (!sub) throw new Error('Cognito did not return a sub for the new user');

  // Step 2: Set a permanent password so the user is not in FORCE_CHANGE_PASSWORD state
  await cognitoAdmin.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: config.cognito.userPoolId,
      Username: username,
      Password: password,
      Permanent: true,
    }),
  );

  return { sub, username };
}

/**
 * Deletes a Cognito user by username (rollback on DB failure).
 */
export async function adminDeleteUser(username: string): Promise<void> {
  await cognitoAdmin.send(
    new AdminDeleteUserCommand({
      UserPoolId: config.cognito.userPoolId,
      Username: username,
    }),
  );
}
