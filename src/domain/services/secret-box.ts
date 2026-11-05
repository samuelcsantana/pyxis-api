export interface SecretBox {
  seal(plain: string, context: string): string;
  open(sealed: string, context: string): string;
}

export const SECRET_BOX = Symbol('SecretBox');
