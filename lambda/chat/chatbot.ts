import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import OpenAI from "openai";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const MESSAGES_TABLE = process.env.MESSAGES_TABLE!;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
const MEMORIES_TABLE = process.env.MEMORIES_TABLE!;

export const handler = async (event: any) => {
  try {
    const body = JSON.parse(event.body);

    const { userId, mode, message } = body;

    if (!userId || !mode || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing parameters" }),
      };
    }

    const sessionId = `${userId}#${mode}`;
    const now = new Date().toISOString();

    // Load previous messages
    const historyRes = await ddb.send(
      new QueryCommand({
        TableName: MESSAGES_TABLE,
        KeyConditionExpression: "sessionId = :sid",
        ExpressionAttributeValues: {
          ":sid": sessionId,
        },
        ScanIndexForward: false,
        Limit: 15,
      })
    );

    const history =
      historyRes.Items?.reverse().map((item) => ({
        role: item.role,
        content: item.content,
      })) || [];

    // Load memories
    const memoryRes = await ddb.send(
      new QueryCommand({
        TableName: MEMORIES_TABLE,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: {
          ":uid": userId,
        },
        Limit: 10,
      })
    );

    const memoryText =
      memoryRes.Items?.map((m) => `- ${m.content}`).join("\n") ||
      "No stored memory yet.";

    // Build system prompt
    const systemPrompt = `
You are Trainora AI.

You are a calm mentor.
You are emotionally intelligent.
You respond with warmth and clarity.
Match the language of the user.
If Japanese, respond in Japanese.
If English, respond in English.

Mode focus:
${mode === "training" ? "Exercise science and programming."
        : mode === "nutrition" ? "Nutrition and metabolism."
        : "Mindset and life guidance."}

User memories:
${memoryText}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message },
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
    });

    const assistantReply =
      completion.choices[0].message?.content || "Sorry, something went wrong.";

    // Save user message
    await ddb.send(
      new PutCommand({
        TableName: MESSAGES_TABLE,
        Item: {
          sessionId,
          createdAt: now,
          role: "user",
          content: message,
        },
      })
    );

    // Save assistant message
    await ddb.send(
      new PutCommand({
        TableName: MESSAGES_TABLE,
        Item: {
          sessionId,
          createdAt: new Date(Date.now() + 1).toISOString(),
          role: "assistant",
          content: assistantReply,
        },
      })
    );

    // Update session
    await ddb.send(
      new PutCommand({
        TableName: SESSIONS_TABLE,
        Item: {
          userId,
          sessionId,
          mode,
          updatedAt: now,
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        reply: assistantReply,
      }),
    };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
      }),
    };
  }
};