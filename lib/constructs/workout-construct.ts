import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as path from "path";
import { Stage } from "../types";

export interface WorkoutConstructProps {
  stage: Stage;
  dailyLogsTable: dynamodb.Table;
  api: apigw.RestApi;
}

/**
 * Encapsulates the five workout Lambda functions and their API routes.
 *
 * Logical IDs preserved (all registered on the stack directly):
 *   RecordWorkoutLambda[hash]
 *   GetWorkoutByDateLambda[hash]
 *   GetWorkoutByMonthLambda[hash]
 *   UpdateWorkoutLambda[hash]
 *   DeleteWorkoutLambda[hash]
 *
 * All use the lambda/ root directory with "workout/<handler>" prefix,
 * mirroring the original stack exactly.
 */
export class WorkoutConstruct {
  constructor(stack: cdk.Stack, props: WorkoutConstructProps) {
    const { stage, dailyLogsTable, api } = props;

    const lambdaRoot = path.join(__dirname, "../../lambda");
    const env = { TRAINORA_DAILY_LOGS_TABLE: dailyLogsTable.tableName, STAGE: stage };

    // ── RecordWorkout ───────────────────────────────────────────────────────
    const recordWorkoutLambda = new lambda.Function(stack, "RecordWorkoutLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "workout/record-workout.handler",
      code: lambda.Code.fromAsset(lambdaRoot),
      environment: env,
    });

    // ── GetWorkoutByDate ────────────────────────────────────────────────────
    const getWorkoutByDateLambda = new lambda.Function(stack, "GetWorkoutByDateLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "workout/get-workout-by-date.handler",
      code: lambda.Code.fromAsset(lambdaRoot),
      environment: env,
    });

    // ── GetWorkoutByMonth ───────────────────────────────────────────────────
    const getWorkoutByMonthLambda = new lambda.Function(stack, "GetWorkoutByMonthLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "workout/get-workout-by-month.handler",
      code: lambda.Code.fromAsset(lambdaRoot),
      environment: env,
    });

    // ── UpdateWorkout ───────────────────────────────────────────────────────
    const updateWorkoutLambda = new lambda.Function(stack, "UpdateWorkoutLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "workout/update-workout.handler",
      code: lambda.Code.fromAsset(lambdaRoot),
      environment: env,
    });

    // ── DeleteWorkout ───────────────────────────────────────────────────────
    const deleteWorkoutLambda = new lambda.Function(stack, "DeleteWorkoutLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "workout/delete-workout.handler",
      code: lambda.Code.fromAsset(lambdaRoot),
      environment: env,
    });

    // IAM
    dailyLogsTable.grantReadWriteData(recordWorkoutLambda);
    dailyLogsTable.grantReadData(getWorkoutByDateLambda);
    dailyLogsTable.grantReadData(getWorkoutByMonthLambda);
    dailyLogsTable.grantReadWriteData(updateWorkoutLambda);
    dailyLogsTable.grantReadWriteData(deleteWorkoutLambda);

    // ── API routes: /workout ────────────────────────────────────────────────
    const workout = api.root.addResource("workout");
    workout.addMethod("POST", new apigw.LambdaIntegration(recordWorkoutLambda));
    workout.addMethod("PUT", new apigw.LambdaIntegration(updateWorkoutLambda));
    workout.addMethod("DELETE", new apigw.LambdaIntegration(deleteWorkoutLambda));

    const workoutByDate = workout.addResource("date");
    workoutByDate.addMethod("GET", new apigw.LambdaIntegration(getWorkoutByDateLambda));

    const workoutByMonth = workout.addResource("month");
    workoutByMonth.addMethod("GET", new apigw.LambdaIntegration(getWorkoutByMonthLambda));
  }
}
