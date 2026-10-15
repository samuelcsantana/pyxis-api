export type AccountNotice =
  | { readonly kind: 'access_ended'; readonly deletionOn: Date }
  | { readonly kind: 'deletion_reminder'; readonly deletionOn: Date }
  | { readonly kind: 'account_deleted' };

export type AccountNoticeKind = AccountNotice['kind'];
