export type MessagingProviderId = 'meta' | 'twilio';

export type MessageDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MetaWhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
  apiVersion: string;
}

export interface SendTemplateMessageInput {
  type: 'template';
  phone: string;
  templateName: string;
  templateLanguage?: string;
  templateVariables?: string[];
  body?: string;
}

export interface SendTextMessageInput {
  type: 'text';
  phone: string;
  body: string;
}

export type SendMessageInput = {
  provider?: MessagingProviderId;
  config?: MetaWhatsAppConfig;
} & (SendTemplateMessageInput | SendTextMessageInput);

export interface SendMessageResult {
  provider: MessagingProviderId;
  wamid: string | null;
  status: MessageDeliveryStatus;
  phone: string;
  templateName?: string;
  messageBody?: string;
  raw: unknown;
  errorMessage?: string;
}

export interface MessageStatusResult {
  wamid: string;
  status: MessageDeliveryStatus;
  raw: unknown;
}
