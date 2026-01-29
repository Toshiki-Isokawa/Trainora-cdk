import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';

interface TrainoraDailyLogsTableProps {
  stage: "dev" | "prod";
}

export class TrainoraDailyLogsTable extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string,props: TrainoraDailyLogsTableProps) {
    super(scope, id);

    const { stage } = props;

    this.table = new dynamodb.Table(this, 'TrainoraDailyLogsV2', {
      tableName: `TrainoraDailyLogsV2-${stage}`,

      // PK: userId
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },

      // SK: dateWorkoutId (YYYY-MM-DD#workoutId)
      sortKey: {
        name: "dateWorkoutId",
        type: dynamodb.AttributeType.STRING,
      },

      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

      removalPolicy: cdk.RemovalPolicy.DESTROY, // Dev only
    });
  }
}
