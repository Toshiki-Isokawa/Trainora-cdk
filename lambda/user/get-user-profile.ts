import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const s3 = new S3Client({});
const BUCKET_NAME = process.env.ASSETS_BUCKET!;
const USERS_TABLE = process.env.USERS_TABLE!;
const WEIGHT_HISTORY_TABLE = process.env.WEIGHT_HISTORY_TABLE!;
const GOAL_HISTORY_TABLE = process.env.GOAL_HISTORY_TABLE!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export const handler = async (event: any) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing userId" }),
      };
    }

    // Get main profile
    const user = await ddb.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId },
      })
    );

    console.log("Fetching user profile for userId:", userId);
    console.log("User fetched:", user);
    console.log("User Item:", user.Item);

    if (!user.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    const profile = user.Item?.profile || null;
    let signedImageUrl = null;

    if (profile?.imageUrl) {
      try {
        const url = new URL(profile.imageUrl);
        const key = decodeURIComponent(url.pathname.substring(1)); // remove leading "/"

        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        });

        signedImageUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      } catch (err) {
        console.error("Failed to generate signed URL:", err);
      }
    }

    // Get latest weight
    const weightHistory = await ddb.send(
      new QueryCommand({
        TableName: WEIGHT_HISTORY_TABLE,
        KeyConditionExpression: "userId = :u",
        ExpressionAttributeValues: {
          ":u": userId,
        },
        ScanIndexForward: false, // order by date DESC
        Limit: 1,
      })
    );

    // Get latest goal
    const goalHistory = await ddb.send(
      new QueryCommand({
        TableName: GOAL_HISTORY_TABLE,
        KeyConditionExpression: "userId = :u",
        ExpressionAttributeValues: {
          ":u": userId,
        },
        ScanIndexForward: false,
        Limit: 1,
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        user: {
          userId: user.Item.userId,
          name: user.Item.name,
          dateOfBirth: user.Item.dateOfBirth,
          gender: user.Item.gender,
          height: user.Item.height,
          activity: user.Item.activity,
          goal: user.Item.goal,
          summary: user.Item.summary,
          createdAt: user.Item.createdAt,
          updatedAt: user.Item.updatedAt,
          profile: {
            ...(user.Item.profile || {}),
            signedImageUrl,
          },
        },
        latestWeight: weightHistory.Items?.[0] ?? null,
        latestGoal: goalHistory.Items?.[0] ?? null,
      }),
    };
  } catch (error: any) {
    console.error("Error:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
