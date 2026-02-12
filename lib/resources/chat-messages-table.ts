import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export interface TrainoraChatMessagesTableProps {
  stage: "dev" | "prod";
}

export class TrainoraChatMessagesTable extends Construct {
  public readonly table: dynamodb.Table;

  constructor(
    scope: Construct,
    id: string,
    props: TrainoraChatMessagesTableProps
  ) {
    super(scope, id);

    const { stage } = props;

    this.table = new dynamodb.Table(this, "TrainoraChatMessagesTable", {
      tableName: `TrainoraChatMessages-${stage}`,
      partitionKey: {
        name: "sessionId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "createdAt",
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
  }
}
