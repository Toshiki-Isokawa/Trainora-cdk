import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export interface TrainoraChatSessionsTableProps {
  stage: "dev" | "prod";
}

export class TrainoraChatSessionsTable extends Construct {
  public readonly table: dynamodb.Table;

  constructor(
    scope: Construct,
    id: string,
    props: TrainoraChatSessionsTableProps
  ) {
    super(scope, id);

    const { stage } = props;

    this.table = new dynamodb.Table(this, "TrainoraChatSessionsTable", {
      tableName: `TrainoraChatSessions-${stage}`,
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "sessionId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: stage === "prod",
      removalPolicy:
        stage === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });

    // GSI: list sessions ordered by updatedAt
    this.table.addGlobalSecondaryIndex({
      indexName: "byUserUpdatedAt",
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "updatedAt",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}
