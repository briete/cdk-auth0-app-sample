import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as ssm from '@aws-cdk/aws-ssm';

import { NODE_LAMBDA_LAYER_DIR, NODE_LAMBDA_SRC_DIR } from '../processes/setup';

export class CdkAuth0LambdaAuthoraizerSampleStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const api = new apigateway.RestApi(this, 'api', {
            endpointTypes: [apigateway.EndpointType.REGIONAL],
            deployOptions: {
                stageName: 'v1',
                dataTraceEnabled: true,
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
            },
        });

        const nodeModuleLayer = new lambda.LayerVersion(
            this,
            'nodeModuleLayer',
            {
                compatibleRuntimes: [lambda.Runtime.NODEJS_12_X],
                code: lambda.AssetCode.fromAsset(NODE_LAMBDA_LAYER_DIR),
            },
        );

        // パラメータストアから、Auth0の情報を取得
        const jwksUri = ssm.StringParameter.fromStringParameterAttributes(
            this,
            'jwksURI',
            {
                parameterName: '/cmsatonaoya/JWKS_URI',
            },
        ).stringValue;

        const audience = ssm.StringParameter.fromStringParameterAttributes(
            this,
            'audience',
            {
                parameterName: '/cmsatonaoya/AUDIENCE',
            },
        ).stringValue;

        const tokenIssuer = ssm.StringParameter.fromStringParameterAttributes(
            this,
            'tokenIssuer',
            {
                parameterName: '/cmsatonaoya/TOKEN_ISSUER',
            },
        ).stringValue;

        // Lambda Authorizer
        const auth0AuthorizerFunction = new lambda.Function(
            this,
            'auth0AuthorizerFunction',
            {
                runtime: lambda.Runtime.NODEJS_12_X,
                code: lambda.Code.fromAsset(NODE_LAMBDA_SRC_DIR),
                handler: 'auth/authorizer.handler',
                layers: [nodeModuleLayer],
                environment: {
                    JWKS_URI: jwksUri,
                    AUDIENCE: audience,
                    TOKEN_ISSUER: tokenIssuer,
                },
            },
        );

        // API Gateway オーソライザー
        const auth0TokenAuthorizer = new apigateway.TokenAuthorizer(
            this,
            'auth0Authorizer',
            {
                handler: auth0AuthorizerFunction,
            },
        );

        const hello = api.root.addResource('hello');
        hello.addMethod(
            'GET',
            new apigateway.MockIntegration({
                requestTemplates: {
                    'application/json': JSON.stringify({
                        statusCode: 200,
                    }),
                },
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseTemplates: {
                            'application/json': JSON.stringify({
                                message: 'Hello World!',
                            }),
                        },
                    },
                ],
            }),
            {
                methodResponses: [
                    {
                        statusCode: '200',
                    },
                ],
                authorizer: auth0TokenAuthorizer,
            },
        );
    }
}
