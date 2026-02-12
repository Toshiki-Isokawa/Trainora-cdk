import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: "ap-northeast-1" });

export const handler = async (event: any) => {
  const { filename, contentType } = JSON.parse(event.body);

  const key = `users/${Date.now()}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.ASSETS_BUCKET!,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 60 });

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({ url, key }),
  };
};