import { SITE_ROOT } from '@datastation/shared/constants';
import express from 'express';
import session from 'express-session';
import {
  Client as OpenIDClient,
  generators,
  Issuer,
  TokenSet,
} from 'openid-client';
import passport from 'passport';
import { App } from './app';
import { Config } from './config';
import log from './log';

interface AuthRequestSession extends express.Request {
  session: session.Session &
    Partial<session.SessionData> & {
      tokenSet: TokenSet;
      code: string;
      redirect: string;
    };
}

export class Auth {
  config: Config;
  openIdClient?: OpenIDClient;
  path: string;

  constructor(config: Config, path: string) {
    this.config = config;
    this.path = path;
  }

  async init() {
    if (this.config.auth.openId) {
      const issuer = await Issuer.discover(this.config.auth.openId.realm);
      const callbackUrl = `${this.config.server.publicUrl}${this.path}/callback`;
      this.openIdClient = new issuer.Client({
        client_id: this.config.auth.openId.clientId,
        client_secret: this.config.auth.openId.clientSecret,
        redirect_uris: [callbackUrl],
        response_types: ['code'],
      });
    } else {
      log.fatal(
        `Missing auth scheme. Review ${SITE_ROOT}/docs/auth.html for how to configure auth.`
      );
    }
  }

  requireAuth = (
    req: AuthRequestSession,
    rsp: express.Response,
    next: () => void
  ) => {
    if (
      !req.session.tokenSet ||
      new Date(req.session.tokenSet.expires_at * 1000) < new Date()
    ) {
      req.session.redirect = ('/?projectId=' + req.query.projectId) as string;
      rsp.status(401).json({});
      return;
    }

    return next();
  };

  doAuth = async (req: AuthRequestSession, rsp: express.Response) => {
    if (this.openIdClient) {
      const codeVerifier = generators.codeVerifier();
      req.session.code = codeVerifier;
      const codeChallenge = generators.codeChallenge(codeVerifier);

      const externalRedirect = this.openIdClient.authorizationUrl({
        scope: 'openid profile email',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
      rsp.redirect(externalRedirect);
      return;
    }

    throw new Error('No auth scheme');
  };

  authCallback = async (req: AuthRequestSession, rsp: express.Response) => {
    if (this.openIdClient) {
      const params = this.openIdClient.callbackParams(req);
      const tokenSet = await this.openIdClient.callback(
        this.openIdClient.metadata.redirect_uris[0],
        params,
        {
          code_verifier: req.session.code,
        }
      );
      req.session.tokenSet = tokenSet;
      rsp.redirect(req.session.redirect);
      return;
    }

    throw new Error('No auth scheme');
  };
}

export async function registerAuth(
  path: string,
  app: App,
  config: Config
): Promise<Auth> {
  app.express.use(
    session({
      secret: config.auth.sessionSecret,
      resave: true,
      saveUninitialized: true,
    })
  );
  app.express.use(passport.initialize());
  app.express.use(passport.session());

  const auth = new Auth(config, path);
  await auth.init();

  app.express.get(path + '/', auth.doAuth);
  app.express.get(path + '/callback', auth.authCallback);
  return auth;
}
