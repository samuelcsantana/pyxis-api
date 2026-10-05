export interface MailSender {
  sendSignInCode(email: string, code: string): Promise<void>;
}
