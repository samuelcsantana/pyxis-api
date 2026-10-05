export const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
export const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const MAX_PATH_LENGTH = 256;

export const MAX_REFERRER_HOST_LENGTH = 128;
export const HOSTNAME_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;
export const MAX_UTM_VALUE_LENGTH = 64;

export const MAX_PROPERTIES = 10;
export const PROPERTY_KEY_PATTERN = /^[a-z0-9_]{1,40}$/;
export const MAX_PROPERTY_STRING_LENGTH = 100;

export const MAX_ROUTE_LENGTH = 100;
export const MIN_HTTP_STATUS = 0;
export const MAX_HTTP_STATUS = 599;
export const MAX_REQUEST_DURATION_MS = 600_000;
export const ERROR_CODE_PATTERN = /^[a-z0-9_.]{1,64}$/;
