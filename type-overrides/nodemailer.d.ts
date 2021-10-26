declare module 'nodemailer' {
  export interface SendMailOptions {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }
  export class SMTPTransport {
    sendMail(SendMailOptions): Promise<unknown>;
  }

  export interface TransportOptions {
    host: string;
    port: number;
    auth?: {
      user: string;
      pass: string;
    };
  }

  export function createTransport(TransportOptions);
}
