#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkAuth0LambdaAuthoraizerSampleStack } from '../lib/stacks/cdk-auth0-lambda-authoraizer-sample-stack';

const app = new cdk.App();
new CdkAuth0LambdaAuthoraizerSampleStack(
    app,
    'CdkAuth0LambdaAuthoraizerSampleStack',
);
