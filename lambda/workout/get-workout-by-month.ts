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
    const month = event.queryStringParameters?.month; // YYYY-MM

    if (!userId || !month) {
      return response(400, {
        error: "Missing userId or month",
      });
    }

    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression:
          "userId = :uid AND begins_with(dateWorkoutId, :monthPrefix)",

        ExpressionAttributeValues: {
          ":uid": userId,
          ":monthPrefix": `${month}-`,
        },

        ExpressionAttributeNames: {
          "#d": "date",
        },
        ProjectionExpression: "#d",
      })
    );

    // Deduplicate dates
    const dateSet = new Set<string>();
    (result.Items ?? []).forEach((item: any) => {
      if (item.date) dateSet.add(item.date);
    });

    return response(200, {
      month,
      datesWithWorkout: Array.from(dateSet).sort(),
    });
  } catch (error: any) {
    console.error("get-workout-by-month error:", error);

    return response(500, {
      error: "Failed to fetch workout dates",
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
