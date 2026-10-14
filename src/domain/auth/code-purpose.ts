export const CODE_PURPOSES = ['sign_in', 'sign_up'] as const;

export type CodePurpose = (typeof CODE_PURPOSES)[number];
