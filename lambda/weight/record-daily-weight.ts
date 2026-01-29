import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { recordDailyWeight } from "../lib/recordDailyWeight";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const WEIGHT_HISTORY_TABLE = process.env.WEIGHT_HISTORY_TABLE!;

export const handler = async (event: any) => {
  try {
    const body = JSON.parse(event.body ?? "{}");

    const { userId, weight } = body;

    if (!userId || typeof weight !== "number") {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "userId and weight are required",
        }),
      };
    }

    const result = await recordDailyWeight(
      ddb,
      WEIGHT_HISTORY_TABLE,
      { userId, weight }
    );

    if (result === "ALREADY_EXISTS") {
      return {
        statusCode: 409,
        body: JSON.stringify({
          message: "Weight already recorded for today",
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Weight recorded successfully",
      }),
    };
  } catch (error: any) {
    console.error("record-daily-weight error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message ?? "Internal server error",
      }),
    };
  }
};