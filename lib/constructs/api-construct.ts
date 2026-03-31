import * as cdk from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigateway";

/**
 * Creates the shared API Gateway RestApi used by all feature constructs.
 *
 * Logical IDs produced:
 *   TrainoraApi[hash]  ← RestApi
 *   ApiBaseUrl         ← CfnOutput
 */
export class ApiConstruct {
  public readonly api: apigw.RestApi;

  constructor(stack: cdk.Stack) {
    this.api = new apigw.RestApi(stack, "TrainoraApi");

    new cdk.CfnOutput(stack, "ApiBaseUrl", {
      value: this.api.url,
      description: "Base URL for Trainora API",
    });
  }
}
