import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as path from "path";
import { Stage } from "../types";

export interface ImageConstructProps {
  stage: Stage;
  assetsBucket: s3.Bucket;
  api: apigw.RestApi;
}

/**
 * Encapsulates the presigned-URL generation Lambda and its API route.
 *
 * Logical ID preserved:
 *   UploadUrlLambda[hash]  — handler: image/create-upload-url, code: lambda/
 */
export class ImageConstruct {
  constructor(stack: cdk.Stack, props: ImageConstructProps) {
    const { assetsBucket, api } = props;

    const uploadUrlLambda = new lambda.Function(stack, "UploadUrlLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "image/create-upload-url.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../lambda")),
      environment: {
        ASSETS_BUCKET: assetsBucket.bucketName,
      },
    });

    assetsBucket.grantPut(uploadUrlLambda);

    // ── API route: POST /upload-url ─────────────────────────────────────────
    const upload = api.root.addResource("upload-url");
    upload.addMethod("POST", new apigw.LambdaIntegration(uploadUrlLambda));
  }
}
