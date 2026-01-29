import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TRAINORA_DAILY_LOGS_TABLE!;

export const handler = async (event: any) => {
  try {
    if (!event.body) {
      return response(400, { error: "Missing request body" });
    }

    const body = JSON.parse(event.body);

    const { userId, date, bodyParts, workouts } = body;

    // -----------------------
    // Validation
    // -----------------------
    if (!userId) {
      return response(400, { error: "Missing userId" });
    }

    if (!date) {
      return response(400, { error: "Missing date (YYYY-MM-DD)" });
    }

    if (!Array.isArray(workouts) || workouts.length === 0) {
      return response(400, { error: "Workouts must be a non-empty array" });
    }

    // -----------------------
    // Generate IDs
    // -----------------------
    const workoutId = randomUUID();
    const dateWorkoutId = `${date}#${workoutId}`;

    const now = new Date().toISOString();

    // -----------------------
    // Save to DynamoDB
    // -----------------------
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          userId,
          dateWorkoutId,
          // Query helpers
          date, // YYYY-MM-DD
          workoutId,
          bodyParts: Array.isArray(bodyParts) ? bodyParts : [],
          workouts,
          createdAt: now,
          updatedAt: now,
        },
      })
    );

    return response(201, {
      message: "Workout recorded successfully",
      workoutId,
    });
  } catch (error: any) {
    console.error("record-workouts error:", error);

    return response(500, {
      error: "Failed to record workout",
      detail: error.message,
    });
  }
};

// -----------------------
// Helpers
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
