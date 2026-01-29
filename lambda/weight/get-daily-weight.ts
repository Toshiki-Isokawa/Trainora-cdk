import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const WEIGHT_HISTORY_TABLE = process.env.WEIGHT_HISTORY_TABLE!;

export const handler = async (event: any) => {
  try {
    /**
     * You can pass userId either:
     * - via query string (?userId=xxx)
     */
    const userId =
      event.queryStringParameters?.userId ||
      event.requestContext?.authorizer?.claims?.sub;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing userId" }),
      };
    }

    const result = await ddb.send(
      new QueryCommand({
        TableName: WEIGHT_HISTORY_TABLE,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: {
          ":uid": userId,
        },
        ScanIndexForward: true, // ascending by date
      })
    );

    const items = (result.Items ?? []).map((item) => ({
      date: item.date,
      weight: item.weight,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        userId,
        count: items.length,
        items,
      }),
    };
  } catch (error: any) {
    console.error("GET DAILY WEIGHT ERROR:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
