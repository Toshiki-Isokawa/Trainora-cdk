import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { recordDailyWeight } from "../lib/recordDailyWeight";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const s3 = new S3Client({});
const BUCKET_NAME = process.env.ASSETS_BUCKET!;
const USERS_TABLE = process.env.USERS_TABLE!;
const WEIGHT_HISTORY_TABLE = process.env.WEIGHT_HISTORY_TABLE!;
const GOAL_HISTORY_TABLE = process.env.GOAL_HISTORY_TABLE!;

export const handler = async (event: any) => {
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
      return { statusCode: 400, body: "Missing userId" };
    }

    const now = new Date().toISOString();

    // --------------------------------------------------
    // 1. Load existing user
    // --------------------------------------------------
    const existing = await ddb.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId },
      })
    );

    if (!existing.Item) {
      return { statusCode: 404, body: "User not found" };
    }

    const prev = existing.Item;

    // --------------------------------------------------
    // 2. Resolve merged values
    // --------------------------------------------------
    const mergedProfile = {
      ...prev.profile,
      ...profile,
    };

    const mergedActivity = activity ?? prev.activity;
    const mergedGoal = goal ?? prev.goal;

    const imageUrl = mergedProfile.imageKey
      ? `https://${BUCKET_NAME}.s3.amazonaws.com/${mergedProfile.imageKey}`
      : prev.profile?.imageUrl ?? null;

    // --------------------------------------------------
    // 3. Recalculate metrics
    // --------------------------------------------------
    const height = Number(mergedProfile.height);
    const weight = Number(mergedProfile.weight);
    const gender = mergedProfile.gender;
    const birthDate = dateOfBirth ?? prev.dateOfBirth;

    const age = calcAge(birthDate);
    const bmr = calcBMR(gender, weight, height, age);
    const activityMultiplier = getActivityMultiplier(mergedActivity);
    const tdee = Math.round(bmr * activityMultiplier);
    const recommendedCalories = calcRecommendedCalories(
      tdee,
      mergedGoal.goalType
    );

    const summary = { bmr, tdee, recommendedCalories };
    // --------------------------------------------------

    if (!isNaN(weight)) {
      const weightResult = await recordDailyWeight(
        ddb,
        WEIGHT_HISTORY_TABLE,
        { userId, weight }
      );

      if (weightResult === "ALREADY_EXISTS") {
        console.log(
          `Weight already recorded today for user ${userId}, skipping`
        );
      }
    }

    // --------------------------------------------------
    // 4. Update USERS_TABLE 
    // --------------------------------------------------
    await ddb.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression: `
          SET
            #name = :name,
            dateOfBirth = :dob,
            profile = :profile,
            gender = :gender,
            height = :height,
            activity = :activity,
            goal = :goal,
            summary = :summary,
            updatedAt = :updatedAt
        `,
        ExpressionAttributeNames: {
          "#name": "name",
        },
        ExpressionAttributeValues: {
          ":name": name ?? prev.name,
          ":dob": birthDate,
          ":gender": gender,
          ":height": height,
          ":profile": {
            ...mergedProfile,
            imageUrl,
          },
          ":activity": mergedActivity,
          ":goal": mergedGoal,
          ":summary": summary,
          ":updatedAt": now,
        },
      })
    );

    // --------------------------------------------------
    // 5. Goal history (only if changed)
    // --------------------------------------------------
    if (mergedGoal.goalType !== prev.goal?.goalType) {
      await ddb.send(
        new PutCommand({
          TableName: GOAL_HISTORY_TABLE,
          Item: {
            userId,
            changedAt: now,
            ...mergedGoal,
          },
        })
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "User profile updated successfully",
        summary,
      }),
    };
  } catch (err: any) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
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