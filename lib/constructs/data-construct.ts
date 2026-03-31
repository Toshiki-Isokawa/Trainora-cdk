import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Stage } from "../types";
import { TrainoraUsersTable } from "../resources/users-table";
import { TrainoraWeightHistoryTable } from "../resources/weight-history";
import { TrainoraDailyLogsTable } from "../resources/daily-logs";
import { TrainoraGoalHistoryTable } from "../resources/goal-history";

export interface DataConstructProps {
  stage: Stage;
}

/**
 * Plain class — resources are registered on the stack directly so that
 * construct-tree paths (and logical IDs) are identical to the original code.
 *
 * Logical IDs produced (examples):
 *   UsersTableTrainoraUsersTable[hash]
 *   WeightHistoryTableTrainoraWeightHistory[hash]
 *   DailyLogsTableTrainoraDailyLogsV2[hash]
 *   GoalHistoryTableTrainoraGoalHistory[hash]
 */
export class DataConstruct {
  public readonly usersTable: dynamodb.Table;
  public readonly weightHistoryTable: dynamodb.Table;
  public readonly dailyLogsTable: dynamodb.Table;
  public readonly goalHistoryTable: dynamodb.Table;

  constructor(stack: cdk.Stack, props: DataConstructProps) {
    const { stage } = props;

    this.usersTable = new TrainoraUsersTable(stack, "UsersTable", { stage }).table;
    this.weightHistoryTable = new TrainoraWeightHistoryTable(stack, "WeightHistoryTable", { stage }).table;
    this.dailyLogsTable = new TrainoraDailyLogsTable(stack, "DailyLogsTable", { stage }).table;
    this.goalHistoryTable = new TrainoraGoalHistoryTable(stack, "GoalHistoryTable", { stage }).table;
  }
}
