import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { TrainoraUsersTable } from './resources/users-table';
import { TrainoraWeightHistoryTable } from './resources/weight-history';
import { TrainoraDailyLogsTable } from './resources/daily-logs';
import { TrainoraGoalHistoryTable } from './resources/goal-history';

export class TrainoraInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 開発用途のユーザー資産バケット
    // - バケット名は自動生成（グローバル重複回避のため）
    // - 開発中は削除を許可（removalPolicy: DESTROY & autoDeleteObjects: true）
    const assetsBucket = new s3.Bucket(this, 'TrainoraUserAssets', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // 出力（デバッグ用）
    new cdk.CfnOutput(this, 'AssetsBucketName', {
      value: assetsBucket.bucketName,
      description: 'S3 bucket for user assets (images)',
    });

    // ============================
    // DynamoDB
    // ============================
    const stage = "dev"; // or from context

    const usersTable = new TrainoraUsersTable(this, "UsersTable", { stage });
    const weightHistoryTable = new TrainoraWeightHistoryTable(this, "WeightHistoryTable", { stage });
    const dailyLogsTable = new TrainoraDailyLogsTable(this, "DailyLogsTable", { stage });
    const goalHistoryTable = new TrainoraGoalHistoryTable(this, "GoalHistoryTable", { stage });


    // ============================
    // Lambda
    // ============================
    const getUserProfileLambda = new lambda.Function(this, "GetUserProfileLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "get-user-profile.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambda/user")
      ),
      environment: {
        ASSETS_BUCKET: assetsBucket.bucketName,
        USERS_TABLE: usersTable.table.tableName,
        WEIGHT_HISTORY_TABLE: weightHistoryTable.table.tableName,
        GOAL_HISTORY_TABLE: goalHistoryTable.table.tableName,
      },
    });

    usersTable.table.grantReadData(getUserProfileLambda);
    weightHistoryTable.table.grantReadData(getUserProfileLambda);
    goalHistoryTable.table.grantReadData(getUserProfileLambda);
    assetsBucket.grantRead(getUserProfileLambda);

    // CreateUser Lambda
    const createUserProfileLambda = new lambda.Function(this, "CreateUserProfileLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "create-user-profile.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambda/user")
      ),
      environment: {
        ASSETS_BUCKET: assetsBucket.bucketName,
        USERS_TABLE: usersTable.table.tableName,
        WEIGHT_HISTORY_TABLE: weightHistoryTable.table.tableName,
        DAILY_LOGS_TABLE: dailyLogsTable.table.tableName,
        GOAL_HISTORY_TABLE: goalHistoryTable.table.tableName,
        STAGE: stage,
      },
    });

    usersTable.table.grantReadWriteData(createUserProfileLambda);
    weightHistoryTable.table.grantReadWriteData(createUserProfileLambda);
    dailyLogsTable.table.grantReadWriteData(createUserProfileLambda);
    goalHistoryTable.table.grantReadWriteData(createUserProfileLambda);
    assetsBucket.grantPut(createUserProfileLambda);

    const updateUserProfileLambda = new lambda.Function(
      this,
      "UpdateUserProfileLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "user/update-user-profile.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda")
        ),
        environment: {
          ASSETS_BUCKET: assetsBucket.bucketName,
          USERS_TABLE: usersTable.table.tableName,
          WEIGHT_HISTORY_TABLE: weightHistoryTable.table.tableName,
          GOAL_HISTORY_TABLE: goalHistoryTable.table.tableName,
          STAGE: stage,
        },
      }
    );

    usersTable.table.grantReadWriteData(updateUserProfileLambda);
    weightHistoryTable.table.grantReadWriteData(updateUserProfileLambda);
    goalHistoryTable.table.grantReadWriteData(updateUserProfileLambda);
    assetsBucket.grantPut(updateUserProfileLambda);
    assetsBucket.grantRead(updateUserProfileLambda);

    const recordDailyWeightLambda = new lambda.Function(
      this,
      "RecordDailyWeightLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "weight/record-daily-weight.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda")
        ),
        environment: {
          WEIGHT_HISTORY_TABLE: weightHistoryTable.table.tableName,
          USERS_TABLE: usersTable.table.tableName,
          STAGE: stage,
        },
      }
    );
    
    weightHistoryTable.table.grantReadWriteData(recordDailyWeightLambda);
    usersTable.table.grantReadData(recordDailyWeightLambda);

    const getDailyWeightLambda = new lambda.Function(
      this,
      "GetDailyWeightLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "get-daily-weight.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda/weight")
        ),
        environment: {
          WEIGHT_HISTORY_TABLE: weightHistoryTable.table.tableName,
          USERS_TABLE: usersTable.table.tableName,
          STAGE: stage,
        },
      }
    );

    weightHistoryTable.table.grantReadData(getDailyWeightLambda);
    usersTable.table.grantReadData(getDailyWeightLambda);

    const recordWorkoutLambda = new lambda.Function(
      this,
      "RecordWorkoutLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "workout/record-workout.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda")
        ),
        environment: {
          TRAINORA_DAILY_LOGS_TABLE: dailyLogsTable.table.tableName,
          STAGE: stage,
        },
      }
    );

    const getWorkoutByDateLambda = new lambda.Function(
      this,
      "GetWorkoutByDateLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "workout/get-workout-by-date.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda")
        ),
        environment: {
          TRAINORA_DAILY_LOGS_TABLE: dailyLogsTable.table.tableName,
          STAGE: stage,
        },
      }
    );

    const getWorkoutByMonthLambda = new lambda.Function(
      this,
      "GetWorkoutByMonthLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "workout/get-workout-by-month.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda")
        ),
        environment: {
          TRAINORA_DAILY_LOGS_TABLE: dailyLogsTable.table.tableName,
          STAGE: stage,
        },
      }
    );

    const updateWorkoutLambda = new lambda.Function(
      this,
      "UpdateWorkoutLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "workout/update-workout.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda")
        ),
        environment: {
          TRAINORA_DAILY_LOGS_TABLE: dailyLogsTable.table.tableName,
          STAGE: stage,
        },
      }
    );

    const deleteWorkoutLambda = new lambda.Function(
      this,
      "DeleteWorkoutLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "workout/delete-workout.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda")
        ),
        environment: {
          TRAINORA_DAILY_LOGS_TABLE: dailyLogsTable.table.tableName,
          STAGE: stage,
        },
      }
    );

    dailyLogsTable.table.grantReadWriteData(recordWorkoutLambda);
    dailyLogsTable.table.grantReadData(getWorkoutByDateLambda);
    dailyLogsTable.table.grantReadData(getWorkoutByMonthLambda);
    dailyLogsTable.table.grantReadWriteData(updateWorkoutLambda);
    dailyLogsTable.table.grantReadWriteData(deleteWorkoutLambda);


    // ============================
    // API Gateway
    // ============================
    const api = new apigw.RestApi(this, "TrainoraApi");

    const user = api.root.addResource("user");
    const profile = user.addResource("profile");

    profile.addMethod(
      "POST",
      new apigw.LambdaIntegration(createUserProfileLambda)
    );

    profile.addMethod(
      "GET",
      new apigw.LambdaIntegration(getUserProfileLambda)
    );

    profile.addMethod(
      "PUT",
      new apigw.LambdaIntegration(updateUserProfileLambda)
    );

    const weight = api.root.addResource("weight");
    const daily = weight.addResource("daily");

    daily.addMethod(
      "POST",
      new apigw.LambdaIntegration(recordDailyWeightLambda)
    );

    daily.addMethod(
      "GET",
      new apigw.LambdaIntegration(getDailyWeightLambda)
    );


    const workout = api.root.addResource("workout");
    // POST /workout
    workout.addMethod(
      "POST",
      new apigw.LambdaIntegration(recordWorkoutLambda)
    );

    // PUT /workout
    workout.addMethod(
      "PUT",
      new apigw.LambdaIntegration(updateWorkoutLambda)
    );

    // DELETE /workout
    workout.addMethod(
      "DELETE",
      new apigw.LambdaIntegration(deleteWorkoutLambda)
    );

    // GET /workout/date
    const workoutByDate = workout.addResource("date");
    workoutByDate.addMethod(
      "GET",
      new apigw.LambdaIntegration(getWorkoutByDateLambda)
    );

    // GET /workout/month
    const workoutByMonth = workout.addResource("month");
    workoutByMonth.addMethod(
      "GET",
      new apigw.LambdaIntegration(getWorkoutByMonthLambda)
    );


    // ============================
    // Cognito: User Pool + App Client (Hosted UI)
    // ============================
    const userPool = new cognito.UserPool(this, 'TrainoraUserPool', {
      userPoolName: 'trainora-user-pool',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
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

    // App client (no secret, for frontend)
    const userPoolClient = new cognito.UserPoolClient(this, 'TrainoraUserPoolClient', {
      userPool,
      generateSecret: false,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: ['http://localhost:3000/api/auth/callback/cognito'],
        logoutUrls: ['http://localhost:3000'],
      },
    });

    // 出力
    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito UserPool Id',
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito App Client Id (no secret)',
    });
  }
}
