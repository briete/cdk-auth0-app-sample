import * as jwksClient from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';
import * as util from 'util';

interface Auth0AuthorizerEvent {
    type: string;
    authorizationToken: string;
    methodArn: string;
}

interface Policy {
    principalId: string;
    context: any;
    policyDocument: {
        Version: string;
        Statement: {
            Action: string;
            Resource: string;
            Effect: string;
        };
    };
}

interface TokenInfo {
    sub: string;
}

interface DecodedJWT {
    header: {
        alg: string;
        typ: string;
        kid: string;
    };
    payload: {
        iss: string;
        sub: string;
        aud: string;
        iat: number;
        exp: number;
        azp: string;
        gty: string;
    };
    signature: string;
}

// トークンの取得
const getToken = (params: Auth0AuthorizerEvent): string => {
    if (!params.type || params.type !== 'TOKEN') {
        throw new Error(
            'Expected "event.type" parameter to have value "TOKEN"',
        );
    }
    const tokenString = params.authorizationToken;
    if (!tokenString) {
        throw new Error(
            'Expected "event.authorizationToken" parameter to be set',
        );
    }
    const match = tokenString.match(/^Bearer (.*)$/);
    if (!match || match.length < 2) {
        throw new Error(
            `Invalid Authorization token - ${tokenString} does not match "Bearer .*"`,
        );
    }

    console.log('token', match[1]);
    return match[1];
};

// トークンの検証
const getAuthentication = async (token: string): Promise<TokenInfo | null> => {
    try {
        const decoded = jwt.decode(token, { complete: true }) as DecodedJWT;
        if (!decoded || !decoded.header || !decoded.header.kid) {
            throw new jwt.JsonWebTokenError('invalid token');
        }
        console.log('decoded', decoded);

        const client = jwksClient({ jwksUri: process.env.JWKS_URI! });
        const getSigningKey = util.promisify(client.getSigningKey);
        const key = await getSigningKey(decoded.header.kid);
        console.log(key);
        const tokenInfo = (await jwt.verify(token, key.getPublicKey(), {
            audience: process.env.AUDIENCE!,
            issuer: process.env.TOKEN_ISSUER!,
        })) as TokenInfo;
        console.log('tokenInfo', tokenInfo);

        return tokenInfo;
    } catch (e) {
        if (e instanceof jwt.TokenExpiredError) {
            console.error(e);
            return null;
        } else if (e instanceof jwt.TokenExpiredError) {
            console.error(e);
            return null;
        } else {
            throw e;
        }
    }
};

// ポリシーの作成
const generatePolicy = async (
    principalId: string,
    effect: string,
    resource: string,
    context: { [key: string]: string },
): Promise<Policy> => {
    return {
        principalId,
        policyDocument: {
            Version: '2012-10-17',
            Statement: {
                Action: 'execute-api:Invoke',
                Effect: effect,
                Resource: resource,
            },
        },
        context,
    };
};

export async function handler(event: Auth0AuthorizerEvent): Promise<Policy> {
    try {
        console.log('event', event);
        const token = getToken(event);
        const tokenInfo = await getAuthentication(token);
        const policy = !tokenInfo
            ? await generatePolicy('', 'Deny', event.methodArn, {
                  msg: 'failure',
              })
            : await generatePolicy(tokenInfo.sub, 'Allow', event.methodArn, {
                  msg: 'success',
              });

        console.log('policy', policy);
        return policy;
    } catch (e) {
        console.error(e);
        throw e;
    }
}
