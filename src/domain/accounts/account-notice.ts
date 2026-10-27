export type AccountNotice =
  | { readonly kind: 'access_ended'; readonly deletionOn: Date }
  | { readonly kind: 'deletion_reminder'; readonly deletionOn: Date }
  | { readonly kind: 'account_deleted' }
  | { readonly kind: 'withdrawn_to_free'; readonly refundedAmount: number };

export type AccountNoticeKind = AccountNotice['kind'];
