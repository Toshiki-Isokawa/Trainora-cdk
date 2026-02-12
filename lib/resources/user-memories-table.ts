import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export interface TrainoraUserMemoriesTableProps {
  stage: "dev" | "prod";
}

export class TrainoraUserMemoriesTable extends Construct {
  public readonly table: dynamodb.Table;

  constructor(
    scope: Construct,
    id: string,
    props: TrainoraUserMemoriesTableProps
  ) {
    super(scope, id);

    const { stage } = props;

    this.table = new dynamodb.Table(this, "TrainoraUserMemoriesTable", {
      tableName: `TrainoraUserMemories-${stage}`,
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "memoryId",
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

    // Optional GSI: query memories by type
    this.table.addGlobalSecondaryIndex({
      indexName: "byUserMemoryType",
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "type",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}
