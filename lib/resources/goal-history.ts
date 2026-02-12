import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';

interface TrainoraGoalHistoryTableProps {
  stage: "dev" | "prod";
}

export class TrainoraGoalHistoryTable extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: TrainoraGoalHistoryTableProps) {
    super(scope, id);

    const { stage } = props;

    this.table = new dynamodb.Table(this, 'TrainoraGoalHistory', {

      // PK: userId
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },

      // SK: changedAt (ISO8601)
      sortKey: {
        name: 'changedAt',
        type: dynamodb.AttributeType.STRING,
      },

      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Dev only
    });
  }
}
