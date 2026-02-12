// lib/resources/users-table.ts
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export interface TrainoraUsersTableProps {
  stage: "dev" | "prod";
}

export class TrainoraUsersTable extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: TrainoraUsersTableProps) {
    super(scope, id);

    const { stage } = props;

    this.table = new dynamodb.Table(this, "TrainoraUsersTable", {
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: stage === "prod",
      removalPolicy:
        stage === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });
  }
}
