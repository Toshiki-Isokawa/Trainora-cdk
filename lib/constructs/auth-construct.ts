import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Stage } from "../types";

export interface AuthConstructProps {
  stage: Stage;
}

/**
 * Plain class — resources registered directly on the stack to preserve
 * logical IDs:
 *   TrainoraUserPool[hash]
 *   TrainoraUserPoolClient[hash]
 *   CognitoUserPoolId        ← CfnOutput
 *   CognitoUserPoolClientId  ← CfnOutput
 */
export class AuthConstruct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(stack: cdk.Stack, props: AuthConstructProps) {
    const { stage } = props;

    this.userPool = new cognito.UserPool(stack, "TrainoraUserPool", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    const callbackUrls =
      stage === "prod"
        ? ["https://YOUR_PROD_DOMAIN/api/auth/callback/cognito"]
        : ["http://localhost:3000/api/auth/callback/cognito"];

    const logoutUrls =
      stage === "prod"
        ? ["https://YOUR_PROD_DOMAIN"]
        : ["http://localhost:3000"];

    this.userPoolClient = new cognito.UserPoolClient(stack, "TrainoraUserPoolClient", {
      userPool: this.userPool,
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls,
        logoutUrls,
      },
    });

    new cdk.CfnOutput(stack, "CognitoUserPoolId", {
      value: this.userPool.userPoolId,
      description: "Cognito UserPool Id",
    });

    new cdk.CfnOutput(stack, "CognitoUserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
      description: "Cognito App Client Id (no secret)",
    });
  }
}
