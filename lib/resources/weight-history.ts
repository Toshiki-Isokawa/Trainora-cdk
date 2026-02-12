import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';

interface TrainoraWeightHistoryTableProps {
  stage: "dev" | "prod";
}

export class TrainoraWeightHistoryTable extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: TrainoraWeightHistoryTableProps) {
    super(scope, id);

    const { stage } = props;

    this.table = new dynamodb.Table(this, 'TrainoraWeightHistory', {
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'date',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
