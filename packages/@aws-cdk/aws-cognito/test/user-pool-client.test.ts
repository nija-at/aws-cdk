import { ABSENT, arrayWith } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import { Stack, Duration } from '@aws-cdk/core';
import { OAuthScope, ResourceServerScope, UserPool, UserPoolClient, UserPoolClientIdentityProvider, UserPoolIdentityProvider, ClientAttributes } from '../lib';

describe('User Pool Client', () => {
  test('default setup', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    new UserPoolClient(stack, 'Client', {
      userPool: pool,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Cognito::UserPoolClient', {
      UserPoolId: stack.resolve(pool.userPoolId),
      AllowedOAuthFlows: ['implicit', 'code'],
      AllowedOAuthScopes: ['profile', 'phone', 'email', 'openid', 'aws.cognito.signin.user.admin'],
      CallbackURLs: ['https://example.com'],
      SupportedIdentityProviders: ['COGNITO'],
    });
  });

  test('client name', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    const client1 = new UserPoolClient(stack, 'Client1', {
      userPool: pool,
      userPoolClientName: 'myclient',
    });
    const client2 = new UserPoolClient(stack, 'Client2', {
      userPool: pool,
    });

    // THEN
    expect(client1.userPoolClientName).toEqual('myclient');
    expect(() => client2.userPoolClientName).toThrow(/available only if specified on the UserPoolClient during initialization/);
  });

  test('import', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const client = UserPoolClient.fromUserPoolClientId(stack, 'Client', 'client-id-1');

    // THEN
    expect(client.userPoolClientId).toEqual('client-id-1');
  });

  test('ExplicitAuthFlows is absent by default', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    pool.addClient('Client');

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      ExplicitAuthFlows: ABSENT,
    });
  });

  test('ExplicitAuthFlows are correctly named', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    pool.addClient('Client', {
      authFlows: {
        adminUserPassword: true,
        custom: true,
        userPassword: true,
        userSrp: true,
      },
    });

    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      ExplicitAuthFlows: [
        'ALLOW_USER_PASSWORD_AUTH',
        'ALLOW_ADMIN_USER_PASSWORD_AUTH',
        'ALLOW_CUSTOM_AUTH',
        'ALLOW_USER_SRP_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH',
      ],
    });
  });

  test('ExplicitAuthFlows makes refreshToken true by default', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    pool.addClient('Client', {
      authFlows: {
        userSrp: true,
      },
    });

    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      ExplicitAuthFlows: [
        'ALLOW_USER_SRP_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH',
      ],
    });
  });

  test('AllowedOAuthFlows are correctly named', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    pool.addClient('Client1', {
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [OAuthScope.PHONE],
      },
    });
    pool.addClient('Client2', {
      oAuth: {
        flows: {
          clientCredentials: true,
        },
        scopes: [OAuthScope.PHONE],
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      AllowedOAuthFlows: ['implicit', 'code'],
      AllowedOAuthFlowsUserPoolClient: true,
    });

    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      AllowedOAuthFlows: ['client_credentials'],
      AllowedOAuthFlowsUserPoolClient: true,
    });
  });

  test('callbackUrl defaults are correctly chosen', () => {
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    pool.addClient('Client1', {
      oAuth: {
        flows: {
          clientCredentials: true,
        },
      },
    });

    pool.addClient('Client2', {
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
      },
    });

    pool.addClient('Client3', {
      oAuth: {
        flows: {
          implicitCodeGrant: true,
        },
      },
    });

    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      AllowedOAuthFlows: ['client_credentials'],
      CallbackURLs: ABSENT,
    });

    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      AllowedOAuthFlows: ['implicit'],
      CallbackURLs: ['https://example.com'],
    });

    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      AllowedOAuthFlows: ['code'],
      CallbackURLs: ['https://example.com'],
    });
  });

  test('callbackUrls are not rendered if OAuth is disabled ', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    new UserPoolClient(stack, 'PoolClient', {
      userPool: pool,
      disableOAuth: true,
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      CallbackURLs: ABSENT,
    });
  });

  test('fails when callbackUrls is empty for codeGrant or implicitGrant', () => {
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    expect(() => pool.addClient('Client1', {
      oAuth: {
        flows: { implicitCodeGrant: true },
        callbackUrls: [],
      },
    })).toThrow(/callbackUrl must not be empty/);

    expect(() => pool.addClient('Client3', {
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: [],
      },
    })).toThrow(/callbackUrl must not be empty/);

    expect(() => pool.addClient('Client4', {
      oAuth: {
        flows: { clientCredentials: true },
        callbackUrls: [],
      },
    })).not.toThrow();
  });

  test('logoutUrls can be set', () => {
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    pool.addClient('Client', {
      oAuth: {
        logoutUrls: ['https://example.com'],
      },
    });

    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      LogoutURLs: ['https://example.com'],
    });
  });

  test('fails when clientCredentials OAuth flow is selected along with codeGrant or implicitGrant', () => {
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    expect(() => pool.addClient('Client1', {
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          clientCredentials: true,
        },
        scopes: [OAuthScope.PHONE],
      },
    })).toThrow(/clientCredentials OAuth flow cannot be selected/);

    expect(() => pool.addClient('Client2', {
      oAuth: {
        flows: {
          implicitCodeGrant: true,
          clientCredentials: true,
        },
        scopes: [OAuthScope.PHONE],
      },
    })).toThrow(/clientCredentials OAuth flow cannot be selected/);
  });

  test('OAuth scopes', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    pool.addClient('Client', {
      oAuth: {
        flows: { clientCredentials: true },
        scopes: [
          OAuthScope.PHONE,
          OAuthScope.EMAIL,
          OAuthScope.OPENID,
          OAuthScope.PROFILE,
          OAuthScope.COGNITO_ADMIN,
          OAuthScope.custom('my-resource-server/my-own-scope'),
        ],
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      AllowedOAuthScopes: [
        'phone',
        'email',
        'openid',
        'profile',
        'aws.cognito.signin.user.admin',
        'my-resource-server/my-own-scope',
      ],
    });
  });

  test('OAuth scopes - resource server', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');
    const scope = new ResourceServerScope({ scopeName: 'scope-name', scopeDescription: 'scope-desc' });
    const resourceServer = pool.addResourceServer('ResourceServer', {
      identifier: 'resource-server',
      scopes: [scope],
    });

    // WHEN
    pool.addClient('Client', {
      oAuth: {
        flows: { clientCredentials: true },
        scopes: [
          OAuthScope.resourceServer(resourceServer, scope),
        ],
      },
    });

    // THEN
    expect(stack).toHaveResource('AWS::Cognito::UserPoolClient', {
      AllowedOAuthScopes: [
        {
          'Fn::Join': [
            '', [
              stack.resolve(resourceServer.userPoolResourceServerId),
              '/scope-name',
            ],
          ],
        },
      ],
    });
  });

  test('OAuthScope - openid is included when email or phone is specified', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    pool.addClient('Client1', {
      userPoolClientName: 'Client1',
      oAuth: {
        flows: { clientCredentials: true },
        scopes: [OAuthScope.PHONE],
      },
    });
    pool.addClient('Client2', {
      userPoolClientName: 'Client2',
      oAuth: {
        flows: { clientCredentials: true },
        scopes: [OAuthScope.EMAIL],
      },
    });
    pool.addClient('Client3', {
      userPoolClientName: 'Client3',
      oAuth: {
        flows: { clientCredentials: true },
        scopes: [OAuthScope.PROFILE],
      },
    });
    pool.addClient('Client4', {
      userPoolClientName: 'Client4',
      oAuth: {
        flows: { clientCredentials: true },
        scopes: [OAuthScope.COGNITO_ADMIN],
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      ClientName: 'Client1',
      AllowedOAuthScopes: ['phone', 'openid'],
    });
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      ClientName: 'Client2',
      AllowedOAuthScopes: ['email', 'openid'],
    });
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      ClientName: 'Client3',
      AllowedOAuthScopes: ['profile', 'openid'],
    });
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      ClientName: 'Client4',
      AllowedOAuthScopes: ['aws.cognito.signin.user.admin'],
    });
  });

  test('enable user existence errors prevention', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    new UserPoolClient(stack, 'Client', {
      userPool: pool,
      preventUserExistenceErrors: true,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Cognito::UserPoolClient', {
      UserPoolId: stack.resolve(pool.userPoolId),
      PreventUserExistenceErrors: 'ENABLED',
    });
  });

  test('disable user existence errors prevention', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    new UserPoolClient(stack, 'Client', {
      userPool: pool,
      preventUserExistenceErrors: false,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Cognito::UserPoolClient', {
      UserPoolId: stack.resolve(pool.userPoolId),
      PreventUserExistenceErrors: 'LEGACY',
    });
  });

  test('user existence errors prevention is absent by default', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    new UserPoolClient(stack, 'Client', {
      userPool: pool,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Cognito::UserPoolClient', {
      UserPoolId: stack.resolve(pool.userPoolId),
      PreventUserExistenceErrors: ABSENT,
    });
  });

  test('default supportedIdentityProviders', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    const idp = UserPoolIdentityProvider.fromProviderName(stack, 'imported', 'userpool-idp');
    pool.registerIdentityProvider(idp);

    // WHEN
    new UserPoolClient(stack, 'Client', {
      userPool: pool,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Cognito::UserPoolClient', {
      SupportedIdentityProviders: [
        'userpool-idp',
        'COGNITO',
      ],
    });
  });

  test('supportedIdentityProviders', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    pool.addClient('AllEnabled', {
      userPoolClientName: 'AllEnabled',
      supportedIdentityProviders: [
        UserPoolClientIdentityProvider.COGNITO,
        UserPoolClientIdentityProvider.FACEBOOK,
        UserPoolClientIdentityProvider.AMAZON,
        UserPoolClientIdentityProvider.GOOGLE,
        UserPoolClientIdentityProvider.APPLE,
      ],
    });

    // THEN
    expect(stack).toHaveResource('AWS::Cognito::UserPoolClient', {
      ClientName: 'AllEnabled',
      SupportedIdentityProviders: ['COGNITO', 'Facebook', 'LoginWithAmazon', 'Google', 'SignInWithApple'],
    });
  });

  test('disableOAuth', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    pool.addClient('OAuthDisabled', {
      userPoolClientName: 'OAuthDisabled',
      disableOAuth: true,
    });
    pool.addClient('OAuthEnabled', {
      userPoolClientName: 'OAuthEnabled',
      disableOAuth: false,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Cognito::UserPoolClient', {
      ClientName: 'OAuthDisabled',
      AllowedOAuthFlows: ABSENT,
      AllowedOAuthScopes: ABSENT,
      AllowedOAuthFlowsUserPoolClient: false,
    });
    expect(stack).toHaveResource('AWS::Cognito::UserPoolClient', {
      ClientName: 'OAuthEnabled',
      AllowedOAuthFlows: ['implicit', 'code'],
      AllowedOAuthScopes: ['profile', 'phone', 'email', 'openid', 'aws.cognito.signin.user.admin'],
      AllowedOAuthFlowsUserPoolClient: true,
    });
  });

  test('fails when oAuth is specified but is disableOAuth is set', () => {
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    expect(() => pool.addClient('Client', {
      disableOAuth: true,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
      },
    })).toThrow(/disableOAuth is set/);
  });

  describe('token validity', () => {
    test('default', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'Pool');

      // WHEN
      pool.addClient('Client1', {
        userPoolClientName: 'Client1',
        accessTokenValidity: Duration.minutes(60),
        idTokenValidity: Duration.minutes(60),
        refreshTokenValidity: Duration.days(30),
      });
      pool.addClient('Client2', {
        userPoolClientName: 'Client2',
        accessTokenValidity: Duration.minutes(60),
      });
      pool.addClient('Client3', {
        userPoolClientName: 'Client3',
        idTokenValidity: Duration.minutes(60),
      });
      pool.addClient('Client4', {
        userPoolClientName: 'Client4',
        refreshTokenValidity: Duration.days(30),
      });
      pool.addClient('Client5', {
        userPoolClientName: 'Client5',
      });

      // THEN
      expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
        ClientName: 'Client1',
        AccessTokenValidity: 60,
        IdTokenValidity: 60,
        RefreshTokenValidity: 43200,
        TokenValidityUnits: {
          AccessToken: 'minutes',
          IdToken: 'minutes',
          RefreshToken: 'minutes',
        },
      });
      expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
        ClientName: 'Client2',
        AccessTokenValidity: 60,
        IdTokenValidity: ABSENT,
        RefreshTokenValidity: ABSENT,
        TokenValidityUnits: {
          AccessToken: 'minutes',
          IdToken: ABSENT,
          RefreshToken: ABSENT,
        },
      });
      expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
        ClientName: 'Client3',
        AccessTokenValidity: ABSENT,
        IdTokenValidity: 60,
        RefreshTokenValidity: ABSENT,
        TokenValidityUnits: {
          AccessToken: ABSENT,
          IdToken: 'minutes',
          RefreshToken: ABSENT,
        },
      });
      expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
        ClientName: 'Client4',
        AccessTokenValidity: ABSENT,
        IdTokenValidity: ABSENT,
        RefreshTokenValidity: 43200,
        TokenValidityUnits: {
          AccessToken: ABSENT,
          IdToken: ABSENT,
          RefreshToken: 'minutes',
        },
      });
      expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
        ClientName: 'Client5',
        TokenValidityUnits: ABSENT,
        IdTokenValidity: ABSENT,
        RefreshTokenValidity: ABSENT,
        AccessTokenValidity: ABSENT,
      });
    });

    test.each([
      Duration.minutes(0),
      Duration.minutes(4),
      Duration.days(1).plus(Duration.minutes(1)),
      Duration.days(2),
    ])('validates accessTokenValidity is a duration between 5 minutes and 1 day', (validity) => {
      const stack = new Stack();
      const pool = new UserPool(stack, 'Pool');
      expect(() => {
        pool.addClient('Client1', {
          userPoolClientName: 'Client1',
          accessTokenValidity: validity,
        });
      }).toThrow(`accessTokenValidity: Must be a duration between 5 minutes and 1 day (inclusive); received ${validity.toHumanString()}.`);
    });

    test.each([
      Duration.minutes(0),
      Duration.minutes(4),
      Duration.days(1).plus(Duration.minutes(1)),
      Duration.days(2),
    ])('validates idTokenValidity is a duration between 5 minutes and 1 day', (validity) => {
      const stack = new Stack();
      const pool = new UserPool(stack, 'Pool');
      expect(() => {
        pool.addClient('Client1', {
          userPoolClientName: 'Client1',
          idTokenValidity: validity,
        });
      }).toThrow(`idTokenValidity: Must be a duration between 5 minutes and 1 day (inclusive); received ${validity.toHumanString()}.`);
    });

    test.each([
      Duration.hours(1).plus(Duration.minutes(1)),
      Duration.hours(12),
      Duration.days(1),
    ])('validates accessTokenValidity is not greater than refresh token expiration', (validity) => {
      const stack = new Stack();
      const pool = new UserPool(stack, 'Pool');
      expect(() => {
        pool.addClient('Client1', {
          userPoolClientName: 'Client1',
          accessTokenValidity: validity,
          refreshTokenValidity: Duration.hours(1),
        });
      }).toThrow(`accessTokenValidity: Must be a duration between 5 minutes and 60 minutes (inclusive); received ${validity.toHumanString()}.`);
    });

    test.each([
      Duration.hours(1).plus(Duration.minutes(1)),
      Duration.hours(12),
      Duration.days(1),
    ])('validates idTokenValidity is not greater than refresh token expiration', (validity) => {
      const stack = new Stack();
      const pool = new UserPool(stack, 'Pool');
      expect(() => {
        pool.addClient('Client1', {
          userPoolClientName: 'Client1',
          idTokenValidity: validity,
          refreshTokenValidity: Duration.hours(1),
        });
      }).toThrow(`idTokenValidity: Must be a duration between 5 minutes and 60 minutes (inclusive); received ${validity.toHumanString()}.`);
    });

    test.each([
      Duration.minutes(0),
      Duration.minutes(59),
      Duration.days(10 * 365).plus(Duration.minutes(1)),
      Duration.days(10 * 365 + 1),
    ])('validates refreshTokenValidity is a duration between 60 minutes and 10 years', (validity) => {
      const stack = new Stack();
      const pool = new UserPool(stack, 'Pool');
      expect(() => {
        pool.addClient('Client1', {
          userPoolClientName: 'Client1',
          refreshTokenValidity: validity,
        });
      }).toThrow(`refreshTokenValidity: Must be a duration between 60 minutes and 3650 days (inclusive); received ${validity.toHumanString()}.`);
    });

    test.each([
      Duration.minutes(5),
      Duration.minutes(60),
      Duration.days(1),
    ])('validates accessTokenValidity is a duration between 5 minutes and 1 day (valid)', (validity) => {
      const stack = new Stack();
      const pool = new UserPool(stack, 'Pool');

      // WHEN
      pool.addClient('Client1', {
        userPoolClientName: 'Client1',
        accessTokenValidity: validity,
      });

      // THEN
      expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
        ClientName: 'Client1',
        AccessTokenValidity: validity.toMinutes(),
        TokenValidityUnits: {
          AccessToken: 'minutes',
        },
      });
    });

    test.each([
      Duration.minutes(5),
      Duration.minutes(60),
      Duration.days(1),
    ])('validates idTokenValidity is a duration between 5 minutes and 1 day (valid)', (validity) => {
      const stack = new Stack();
      const pool = new UserPool(stack, 'Pool');

      // WHEN
      pool.addClient('Client1', {
        userPoolClientName: 'Client1',
        idTokenValidity: validity,
      });

      // THEN
      expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
        ClientName: 'Client1',
        IdTokenValidity: validity.toMinutes(),
        TokenValidityUnits: {
          IdToken: 'minutes',
        },
      });
    });

    test.each([
      Duration.minutes(60),
      Duration.minutes(120),
      Duration.days(365),
      Duration.days(10 * 365),
    ])('validates refreshTokenValidity is a duration between 60 minutes and 10 years (valid)', (validity) => {
      const stack = new Stack();
      const pool = new UserPool(stack, 'Pool');

      // WHEN
      pool.addClient('Client1', {
        userPoolClientName: 'Client1',
        refreshTokenValidity: validity,
      });

      // THEN
      expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
        ClientName: 'Client1',
        RefreshTokenValidity: validity.toMinutes(),
        TokenValidityUnits: {
          RefreshToken: 'minutes',
        },
      });
    });

    test.each([
      Duration.minutes(5),
      Duration.minutes(60),
      Duration.hours(1),
    ])('validates accessTokenValidity is not greater than refresh token expiration (valid)', (validity) => {
      const stack = new Stack();
      const pool = new UserPool(stack, 'Pool');

      // WHEN
      pool.addClient('Client1', {
        userPoolClientName: 'Client1',
        accessTokenValidity: validity,
        refreshTokenValidity: Duration.hours(1),
      });

      // THEN
      expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
        ClientName: 'Client1',
        AccessTokenValidity: validity.toMinutes(),
        TokenValidityUnits: {
          AccessToken: 'minutes',
        },
      });
    });

    test.each([
      Duration.minutes(5),
      Duration.minutes(60),
      Duration.hours(1),
    ])('validates idTokenValidity is not greater than refresh token expiration (valid)', (validity) => {
      const stack = new Stack();
      const pool = new UserPool(stack, 'Pool');

      // WHEN
      pool.addClient('Client1', {
        userPoolClientName: 'Client1',
        idTokenValidity: validity,
        refreshTokenValidity: Duration.hours(1),
      });

      // THEN
      expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
        ClientName: 'Client1',
        IdTokenValidity: validity.toMinutes(),
        TokenValidityUnits: {
          IdToken: 'minutes',
        },
      });
    });
  });

  describe('read and write attributes', () => {
    test('undefined by default', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'Pool');

      // WHEN
      pool.addClient('Client', {});

      // EXPECT
      expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
        ReadAttributes: ABSENT,
        WriteAttributes: ABSENT,
      });
    });

    test('set attributes', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'Pool');
      const writeAttributes = (new ClientAttributes()).withCustomAttributes('my_first').withStandardAttributes({ givenName: true, familyName: true });
      const readAttributes = (new ClientAttributes()).withStandardAttributes({
        address: true,
        birthdate: true,
        email: true,
        emailVerified: true,
        familyName: true,
        fullname: true,
        gender: true,
        givenName: true,
        lastUpdateTime: true,
        locale: true,
        middleName: true,
        nickname: true,
        phoneNumber: true,
        phoneNumberVerified: true,
        preferredUsername: true,
        profilePage: true,
        profilePicture: true,
        timezone: true,
        website: true,
      });

      // WHEN
      pool.addClient('Client', {
        readAttributes,
        writeAttributes,
      });

      // EXPECT
      expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
        ReadAttributes: arrayWith('name', 'given_name', 'family_name', 'middle_name', 'nickname', 'preferred_username', 'profile', 'picture', 'website', 'email', 'email_verified', 'gender', 'birthdate', 'zoneinfo', 'locale', 'phone_number', 'phone_number_verified', 'address', 'updated_at'),
        WriteAttributes: arrayWith('given_name', 'family_name', 'custom:my_first'),
      });
    });
  });
});