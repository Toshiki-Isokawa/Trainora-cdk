import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as path from "path";
import { Stage } from "../types";

export interface UserConstructProps {
  stage: Stage;
  assetsBucket: s3.Bucket;
  usersTable: dynamodb.Table;
  weightHistoryTable: dynamodb.Table;
  dailyLogsTable: dynamodb.Table;
  goalHistoryTable: dynamodb.Table;
  api: apigw.RestApi;
}

/**
 * Encapsulates the three user-profile Lambda functions and their API routes.
 *
 * All Lambda functions are registered directly on the stack (not on a nested
 * Construct node) so that logical IDs are identical to the original:
 *   GetUserProfileLambda[hash]
 *   CreateUserProfileLambda[hash]
 *   UpdateUserProfileLambda[hash]
 *
 * Lambda code paths resolve to the same directories as the original stack:
 *   get/create  → <project>/lambda/user/
 *   update      → <project>/lambda/         (handler: user/update-user-profile)
 */
export class UserConstruct {
  constructor(stack: cdk.Stack, props: UserConstructProps) {
    const {
      stage,
      assetsBucket,
      usersTable,
      weightHistoryTable,
      dailyLogsTable,
      goalHistoryTable,
      api,
    } = props;

    // ── GetUserProfile ──────────────────────────────────────────────────────
    const getUserProfileLambda = new lambda.Function(stack, "GetUserProfileLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "get-user-profile.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../lambda/user")),
      environment: {
        ASSETS_BUCKET: assetsBucket.bucketName,
        USERS_TABLE: usersTable.tableName,
        WEIGHT_HISTORY_TABLE: weightHistoryTable.tableName,
        GOAL_HISTORY_TABLE: goalHistoryTable.tableName,
      },
    });

    usersTable.grantReadData(getUserProfileLambda);
    weightHistoryTable.grantReadData(getUserProfileLambda);
    goalHistoryTable.grantReadData(getUserProfileLambda);
    assetsBucket.grantRead(getUserProfileLambda);

    // ── CreateUserProfile ───────────────────────────────────────────────────
    const createUserProfileLambda = new lambda.Function(stack, "CreateUserProfileLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "create-user-profile.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../lambda/user")),
      environment: {
        ASSETS_BUCKET: assetsBucket.bucketName,
        USERS_TABLE: usersTable.tableName,
        WEIGHT_HISTORY_TABLE: weightHistoryTable.tableName,
        DAILY_LOGS_TABLE: dailyLogsTable.tableName,
        GOAL_HISTORY_TABLE: goalHistoryTable.tableName,
        STAGE: stage,
      },
    });

    usersTable.grantReadWriteData(createUserProfileLambda);
    weightHistoryTable.grantReadWriteData(createUserProfileLambda);
    dailyLogsTable.grantReadWriteData(createUserProfileLambda);
    goalHistoryTable.grantReadWriteData(createUserProfileLambda);
    assetsBucket.grantPut(createUserProfileLambda);

    // ── UpdateUserProfile ───────────────────────────────────────────────────
    // Uses the root lambda/ dir so the handler path "user/update-user-profile"
    // resolves correctly — mirrors the original code exactly.
    const updateUserProfileLambda = new lambda.Function(stack, "UpdateUserProfileLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "user/update-user-profile.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../lambda")),
      environment: {
        ASSETS_BUCKET: assetsBucket.bucketName,
        USERS_TABLE: usersTable.tableName,
        WEIGHT_HISTORY_TABLE: weightHistoryTable.tableName,
        GOAL_HISTORY_TABLE: goalHistoryTable.tableName,
        STAGE: stage,
      },
    });

    usersTable.grantReadWriteData(updateUserProfileLambda);
    weightHistoryTable.grantReadWriteData(updateUserProfileLambda);
    goalHistoryTable.grantReadWriteData(updateUserProfileLambda);
    assetsBucket.grantPut(updateUserProfileLambda);
    assetsBucket.grantRead(updateUserProfileLambda);

    // ── API routes: /user/profile ───────────────────────────────────────────
    const user = api.root.addResource("user");
    const profile = user.addResource("profile");
    profile.addMethod("POST", new apigw.LambdaIntegration(createUserProfileLambda));
    profile.addMethod("GET", new apigw.LambdaIntegration(getUserProfileLambda));
    profile.addMethod("PUT", new apigw.LambdaIntegration(updateUserProfileLambda));
  }
}
