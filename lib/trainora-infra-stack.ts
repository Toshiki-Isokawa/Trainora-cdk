import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Stage } from "./types";
import { StorageConstruct } from "./constructs/storage-construct";
import { DataConstruct } from "./constructs/data-construct";
import { AuthConstruct } from "./constructs/auth-construct";
import { ApiConstruct } from "./constructs/api-construct";
import { UserConstruct } from "./constructs/user-construct";
import { WeightConstruct } from "./constructs/weight-construct";
import { WorkoutConstruct } from "./constructs/workout-construct";
import { ImageConstruct } from "./constructs/image-construct";

/**
 * TrainoraInfraStack — single CloudFormation stack (name: TrainoraInfraStack-{stage}).
 */
export class TrainoraInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stage = (this.node.tryGetContext("stage") ?? "dev") as Stage;

    // ── Storage (S3) ─────────────────────────────────────────────────────────
    const storage = new StorageConstruct(this, { stage });

    // ── Data (DynamoDB) ───────────────────────────────────────────────────────
    const data = new DataConstruct(this, { stage });

    // ── Auth (Cognito) ────────────────────────────────────────────────────────
    new AuthConstruct(this, { stage });

    // ── API Gateway ───────────────────────────────────────────────────────────
    const { api } = new ApiConstruct(this);

    // ── Feature constructs (Lambdas + routes) ─────────────────────────────────
    new UserConstruct(this, {
      stage,
      assetsBucket: storage.assetsBucket,
      usersTable: data.usersTable,
      weightHistoryTable: data.weightHistoryTable,
      dailyLogsTable: data.dailyLogsTable,
      goalHistoryTable: data.goalHistoryTable,
      api,
    });

    new WeightConstruct(this, {
      stage,
      weightHistoryTable: data.weightHistoryTable,
      usersTable: data.usersTable,
      api,
    });

    new WorkoutConstruct(this, {
      stage,
      dailyLogsTable: data.dailyLogsTable,
      api,
    });

    new ImageConstruct(this, {
      stage,
      assetsBucket: storage.assetsBucket,
      api,
    });
  }
}
