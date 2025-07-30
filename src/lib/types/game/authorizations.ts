export type EpicAPIErrorData = {
  errorCode: string;
  errorMessage: string;
  messageVars: any[];
  numericErrorCode: number;
  continuation?: string;
  continuationUrl?: string;
  correctiveAction?: string;
  validationFailures?: Record<string, any>;
};

export type EpicTokenType = 'eg1' | 'bearer';

export type EpicOAuthData = {
  access_token: string;
  expires_in: number;
  expires_at: string;
  token_type: string;
  refresh_token: string;
  refresh_expires: number;
  refresh_expires_at: string;
  account_id: string;
  client_id: string;
  internal_client: boolean;
  client_service: string;
  displayName: string;
  app: string;
  in_app_id: string;
  product_id: string;
  application_id: string;
  acr: string;
  auth_time: string;
};

export type EpicExchangeCodeLoginData = EpicOAuthData;
export type EpicDeviceAuthLoginData = EpicOAuthData;
export type EpicExchangeCodeData = {
  expiresInSeconds: number;
  code: string;
  creatingClientId: string;
};

export type EpicVerifyAccessTokenData = Omit<EpicOAuthData, 'access_token' | 'displayName' | 'refresh_token' | 'refresh_expires_at' | 'refresh_expires'> & {
  display_name: string;
  token: string;
};

export type DeviceAuthData = {
  accountId: string;
  deviceId: string;
  secret: string;
};

export type EpicDeviceAuthData = {
  deviceId: string;
  accountId: string;
  secret: string;
  userAgent: string;
  deviceInfo?: {
    type: string;
    model: string;
    os: string;
  };
  created?: {
    location: string;
    ipAddress: string;
    dateTime: string;
  };
  lastAccess?: {
    location: string;
    ipAddress: string;
    dateTime: string;
  };
};

export type DeviceCodeLoginData = {
  user_code: string;
  device_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  prompt: 'login';
  expires_in: number;
  interval: number;
  client_id: string;
};