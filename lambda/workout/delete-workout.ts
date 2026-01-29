import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TRAINORA_DAILY_LOGS_TABLE!;

export const handler = async (event: any) => {
  try {
    const body = JSON.parse(event.body);

    const { userId, date, workoutId } = body;

    if (!userId || !date || !workoutId) {
      return response(400, {
        error: "Missing userId, date, or workoutId",
      });
    }

    const dateWorkoutId = `${date}#${workoutId}`;

    await ddb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          userId,
          dateWorkoutId,
        },
        ConditionExpression: "attribute_exists(dateWorkoutId)",
      })
    );

    return response(200, {
      message: "Workout deleted successfully",
      workoutId,
    });
  } catch (error: any) {
    console.error("delete-workout error:", error);

    if (error.name === "ConditionalCheckFailedException") {
      return response(404, {
        error: "Workout not found",
      });
    }

    return response(500, {
      error: "Failed to delete workout",
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
