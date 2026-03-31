import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Stage } from "../types";

export interface StorageConstructProps {
  stage: Stage;
}

/**
 * Plain class (not extending Construct) so that resources are registered
 * directly on the provided stack — preserving the same construct-tree paths
 * (and therefore the same CloudFormation logical IDs) as the original code.
 *
 * Logical IDs produced:
 *   TrainoraUserAssets[hash]         ← s3.Bucket
 *   AssetsBucketName                 ← CfnOutput
 */
export class StorageConstruct {
  public readonly assetsBucket: s3.Bucket;

  constructor(stack: cdk.Stack, _props: StorageConstructProps) {
    this.assetsBucket = new s3.Bucket(stack, "TrainoraUserAssets", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    new cdk.CfnOutput(stack, "AssetsBucketName", {
      value: this.assetsBucket.bucketName,
      description: "S3 bucket for user assets (images)",
    });
  }
}
