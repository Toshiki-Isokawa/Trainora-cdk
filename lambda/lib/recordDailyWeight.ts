import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

export type RecordDailyWeightResult =
  | "RECORDED"
  | "ALREADY_EXISTS";

type RecordDailyWeightParams = {
  userId: string;
  weight: number;
  /**
   * Optional date (YYYY-MM-DD).
   * If not provided, today's date will be used.
   */
  date?: string;
};

/**
 * Records a user's weight once per day.
 *
 * Rule:
 * - One weight record per user per date
 * - Does NOT overwrite existing records
 *
 * Used by:
 * - record-daily-weight Lambda
 * - create-user-profile Lambda
 * - update-user-profile Lambda
 */
export async function recordDailyWeight(
  ddb: DynamoDBDocumentClient,
  tableName: string,
  params: RecordDailyWeightParams
): Promise<RecordDailyWeightResult> {
  const { userId, weight } = params;

  if (!userId) {
    throw new Error("recordDailyWeight: userId is required");
  }

  if (typeof weight !== "number" || isNaN(weight)) {
    throw new Error("recordDailyWeight: weight must be a valid number");
  }

  const date =
    params.date ??
    new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const now = new Date().toISOString();

  try {
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          userId,
          date, // sort key
          weight,
          createdAt: now,
        },
        /**
         * Prevent overwriting same-day record
         */
        ConditionExpression: "attribute_not_exists(#date)",
        ExpressionAttributeNames: {
          "#date": "date",
        },
      })
    );

    return "RECORDED";
  } catch (err: any) {
    if (err.name === "ConditionalCheckFailedException") {
      return "ALREADY_EXISTS";
    }

    console.error("recordDailyWeight error:", err);
    throw err;
  }
}
