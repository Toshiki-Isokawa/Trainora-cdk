import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as path from "path";
import { Stage } from "../types";

export interface WeightConstructProps {
  stage: Stage;
  weightHistoryTable: dynamodb.Table;
  usersTable: dynamodb.Table;
  api: apigw.RestApi;
}

/**
 * Encapsulates the two weight Lambda functions and their API routes.
 *
 * Logical IDs preserved:
 *   RecordDailyWeightLambda[hash]  — handler: weight/record-daily-weight, code: lambda/
 *   GetDailyWeightLambda[hash]     — handler: get-daily-weight,           code: lambda/weight/
 */
export class WeightConstruct {
  constructor(stack: cdk.Stack, props: WeightConstructProps) {
    const { stage, weightHistoryTable, usersTable, api } = props;

    // ── RecordDailyWeight ───────────────────────────────────────────────────
    // Original used lambda/ root (handler prefix "weight/")
    const recordDailyWeightLambda = new lambda.Function(stack, "RecordDailyWeightLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "weight/record-daily-weight.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../lambda")),
      environment: {
        WEIGHT_HISTORY_TABLE: weightHistoryTable.tableName,
        USERS_TABLE: usersTable.tableName,
        STAGE: stage,
      },
    });

    weightHistoryTable.grantReadWriteData(recordDailyWeightLambda);
    usersTable.grantReadData(recordDailyWeightLambda);

    // ── GetDailyWeight ──────────────────────────────────────────────────────
    // Original used lambda/weight/ sub-directory (no handler prefix)
    const getDailyWeightLambda = new lambda.Function(stack, "GetDailyWeightLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "get-daily-weight.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../lambda/weight")),
      environment: {
        WEIGHT_HISTORY_TABLE: weightHistoryTable.tableName,
        USERS_TABLE: usersTable.tableName,
        STAGE: stage,
      },
    });

    weightHistoryTable.grantReadData(getDailyWeightLambda);
    usersTable.grantReadData(getDailyWeightLambda);

    // ── API routes: /weight/daily ───────────────────────────────────────────
    const weight = api.root.addResource("weight");
    const daily = weight.addResource("daily");
    daily.addMethod("POST", new apigw.LambdaIntegration(recordDailyWeightLambda));
    daily.addMethod("GET", new apigw.LambdaIntegration(getDailyWeightLambda));
  }
}
