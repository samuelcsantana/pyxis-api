export type AccountNotice =
  | { readonly kind: 'access_ended'; readonly deletionOn: Date }
  | { readonly kind: 'deletion_reminder'; readonly deletionOn: Date }
  | { readonly kind: 'account_deleted' }
  | { readonly kind: 'withdrawn_to_free'; readonly refundedAmount: number }
  | { readonly kind: 'back_to_free'; readonly eventsPerMonth: number };

export type AccountNoticeKind = AccountNotice['kind'];
