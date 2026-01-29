import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TRAINORA_DAILY_LOGS_TABLE!;

export const handler = async (event: any) => {
  try {
    const body = JSON.parse(event.body);

    const {
      userId,
      date,
      workoutId,
      bodyParts,
      workouts,
    } = body;

    if (!userId || !date || !workoutId) {
      return response(400, {
        error: "Missing userId, date, or workoutId",
      });
    }

    if (!Array.isArray(bodyParts) || !Array.isArray(workouts)) {
      return response(400, {
        error: "Invalid bodyParts or workouts format",
      });
    }

    const now = new Date().toISOString();
    const dateWorkoutId = `${date}#${workoutId}`;

    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          userId,
          dateWorkoutId,
        },
        UpdateExpression: `
          SET
            bodyParts = :bodyParts,
            workouts = :workouts,
            updatedAt = :updatedAt
        `,
        ExpressionAttributeValues: {
          ":bodyParts": bodyParts,
          ":workouts": workouts,
          ":updatedAt": now,
        },
        ConditionExpression: "attribute_exists(dateWorkoutId)",
      })
    );

    return response(200, {
      message: "Workout updated successfully",
      workoutId,
    });
  } catch (error: any) {
    console.error("update-workout error:", error);

    // ConditionalCheckFailedException → not found
    if (error.name === "ConditionalCheckFailedException") {
      return response(404, {
        error: "Workout not found",
      });
    }

    return response(500, {
      error: "Failed to update workout",
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
