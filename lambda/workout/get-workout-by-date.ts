import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TRAINORA_DAILY_LOGS_TABLE!;

export const handler = async (event: any) => {
  try {
    const userId = event.queryStringParameters?.userId;
    const date = event.queryStringParameters?.date; // YYYY-MM-DD

    if (!userId || !date) {
      return response(400, {
        error: "Missing userId or date",
      });
    }

    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression:
          "userId = :uid AND begins_with(dateWorkoutId, :datePrefix)",
        ExpressionAttributeValues: {
          ":uid": userId,
          ":datePrefix": `${date}#`,
        },
        ScanIndexForward: true, // old → new
      })
    );

    return response(200, {
      date,
      workouts: result.Items ?? [],
    });
  } catch (error: any) {
    console.error("get-workout-by-date error:", error);

    return response(500, {
      error: "Failed to fetch workouts",
      detail: error.message,
    });
  }
};

// -----------------------
function response(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}
