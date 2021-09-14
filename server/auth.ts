import express from 'express';
import session from 'express-session';
import {
  Client as OpenIDClient,
  generators,
  Issuer,
  TokenSet,
} from 'openid-client';
import passport from 'passport';
import { SITE_ROOT } from '../shared/constants';
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
      this.openIdClient = new issuer.Client({
        client_id: this.config.auth.openId.clientId,
        client_secret: this.config.auth.openId.clientSecret,
        redirect_uris: [
          `${this.config.server.publicUrl}/${this.path}/callback`,
        ],
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
      new Date(req.session.tokenSet.expires_at) < new Date()
    ) {
      rsp.redirect(this.path + '?redirect=' + encodeURI(req.path));
      return;
    }

    return next();
  };

  doAuth = async (req: AuthRequestSession, rsp: express.Response) => {
    if (this.openIdClient) {
      const codeVerifier = generators.codeVerifier();
      req.session.code = codeVerifier;
      req.session.redirect = req.params.redirect;
      const codeChallenge = generators.codeChallenge(codeVerifier);

      rsp.redirect(
        this.openIdClient.authorizationUrl({
          scope: 'openid profile email',
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        })
      );
      return;
    }

    throw new Error('No auth scheme');
  };

  authCallback = async (req: AuthRequestSession, rsp: express.Response) => {
    if (this.openIdClient) {
      const params = this.openIdClient.callbackParams(req);
      // TODO: what goes in this first argument?
      const tokenSet = await this.openIdClient.callback(undefined, params, {
        code_verifier: req.session.code,
      });
      console.log(tokenSet, tokenSet && tokenSet.claims());
      req.session.tokenSet = tokenSet;
      rsp.redirect(decodeURI(req.session.redirect));
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

  app.express.use(path, auth.doAuth);
  app.express.use(path + '/callback', auth.authCallback);
  return auth;
}
