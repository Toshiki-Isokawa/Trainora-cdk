import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const s3 = new S3Client({});
const BUCKET_NAME = process.env.ASSETS_BUCKET!;
const USERS_TABLE = process.env.USERS_TABLE!;
const WEIGHT_HISTORY_TABLE = process.env.WEIGHT_HISTORY_TABLE!;
const GOAL_HISTORY_TABLE = process.env.GOAL_HISTORY_TABLE!;

export const handler = async (event: any) => {
  console.log("ENV:", {
    USERS_TABLE: process.env.USERS_TABLE,
    WEIGHT_HISTORY_TABLE: process.env.WEIGHT_HISTORY_TABLE,
    GOAL_HISTORY_TABLE: process.env.GOAL_HISTORY_TABLE,
    ASSETS_BUCKET: process.env.ASSETS_BUCKET,
  });

  try {
    const body = JSON.parse(event.body);

    const {
      userId,
      name,
      dateOfBirth,
      profile,
      activity,
      goal,
    } = body;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing userId" }),
      };
    }

    const now = new Date().toISOString();


    // ===============================
    // S3 UPLOAD (Base64 image)
    // ===============================

    console.log("PROFILE PAYLOAD:", JSON.stringify(profile));
    console.log("HAS image:", !!profile?.imageKey);

    // Ensure profile and exist image)
    const imageUrl = profile.imageKey
        ? `https://${BUCKET_NAME}.s3.amazonaws.com/${profile.imageKey}`
        : null;
  
    // Extract values
    const height = Number(profile.height);
    const weight = Number(profile.weight);
    const gender = profile.gender;
    const age = calcAge(dateOfBirth);

    // ---------- CALCULATE BMR & TDEE ----------
    const bmr = calcBMR(profile.gender, weight, height, age);
    const activityMultiplier = getActivityMultiplier(activity);
    const tdee = Math.round(bmr * activityMultiplier);
    const recommendedCalories = calcRecommendedCalories(tdee, goal.goalType);

    const summary = {
      bmr,
      tdee,
      recommendedCalories,
    };

    // ---------- SAVE MAIN USER PROFILE ----------
    await ddb.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: {
          userId,
          name,
          dateOfBirth,
          height,
          gender,
          profile: {
            imageUrl: imageUrl || null,
          },
          activity,
          goal,
          summary,
          createdAt: now,
          updatedAt: now,
        },
      })
    );

    // ---------- SAVE INITIAL WEIGHT ----------
    await ddb.send(
      new PutCommand({
        TableName: WEIGHT_HISTORY_TABLE,
        Item: {
          userId,
          date: now.slice(0, 10), // YYYY-MM-DD
          weight,
          createdAt: now,
        },
      })
    );

    // ---------- SAVE INITIAL GOAL HISTORY ----------
    await ddb.send(
      new PutCommand({
        TableName: GOAL_HISTORY_TABLE,
        Item: {
          userId,
          changedAt: now,
          ...goal,
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "User profile created successfully",
        summary,
      }),
    };
  } catch (error: any) {
    console.error("Error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// ------------------------------------------------------
// Helper Functions
// ------------------------------------------------------

function calcAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}

function calcBMR(
  gender: string,
  weight: number,
  height: number,
  age: number
) {
  if (gender === "male") {
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  } else if (gender === "female") {
    return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  } else {
    // fallback if gender = "other"
    return Math.round(10 * weight + 6.25 * height - 5 * age);
  }
}

function getActivityMultiplier(activity: any) {
  // Customize this logic as needed
  let base = 1.2;

  if (activity.workStyle === "standing") base += 0.1;

  if (activity.highIntensity === "1-2") base += 0.1;
  if (activity.highIntensity === "3-4") base += 0.2;
  if (activity.highIntensity === "more") base += 0.3;

  return base;
}

function calcRecommendedCalories(tdee: number, goalType: string) {
  switch (goalType) {
    case "gain_muscle":
      return Math.round(tdee * 1.10);

    case "gain_both":
      return Math.round(tdee * 1.15);

    case "lose_fat":
      return Math.round(tdee * 0.85);

    default:
      return tdee;
  }
}
