/** The settings the admin console can edit. Shared by the console and the server. */

export type ConfigField = {
  key: string;
  label: string;
  secret: boolean;
  hint?: string;
  /** When set, the console offers a choice instead of free text. */
  options?: { value: string; label: string }[];
};

export type ConfigGroup = { title: string; fields: ConfigField[] };

export const CONFIG_GROUPS: ConfigGroup[] = [
  {
    title: "Commission and limits",
    fields: [
      { key: "COMMISSION_PERCENT", label: "Sub-admin commission (%)", secret: false, hint: "Share of each referred player's deposit paid to their sub-admin. Default 60." },
      { key: "FIRST_DEPOSIT_BONUS", label: "First deposit bonus", secret: false, hint: "One-time bonus on a player's first confirmed deposit. Default 100." },
      { key: "PARTNER_CREDIT_MAX", label: "Sub-admin credit per top-up", secret: false, hint: "Default 5000." },
      { key: "PARTNER_CREDIT_DAILY_MAX", label: "Sub-admin credit per day", secret: false, hint: "Default 20000." },
    ],
  },
  {
    title: "Fixtures and odds",
    fields: [{ key: "API_FOOTBALL_KEY", label: "API-Football key", secret: true }],
  },
  {
    title: "Flutterwave · cards and mobile money",
    fields: [
      { key: "FLUTTERWAVE_CLIENT_ID", label: "Client ID (v4)", secret: false },
      { key: "FLUTTERWAVE_CLIENT_SECRET", label: "Client secret (v4)", secret: true },
      { key: "FLUTTERWAVE_ENCRYPTION_KEY", label: "Encryption key (v4)", secret: true },
      { key: "FLUTTERWAVE_ENV", label: "Environment", secret: false, hint: "Type sandbox for testing. Anything else is live." },
      { key: "FLUTTERWAVE_SECRET_KEY", label: "Secret key (v3)", secret: true, hint: "FLWSECK-… Used for Ghana mobile money on the v3 API." },
      { key: "FLUTTERWAVE_WEBHOOK_HASH", label: "Webhook secret hash", secret: true, hint: "Must match the secret hash under Settings → Webhooks on the Flutterwave dashboard." },
      {
        key: "DEPOSIT_GATEWAY_GH",
        label: "Ghana deposits via",
        secret: false,
        hint: "Which rail takes Ghana mobile-money deposits.",
        options: [
          { value: "flutterwave_v3_momo", label: "Flutterwave mobile money (v3)" },
          { value: "flutterwave_momo", label: "Flutterwave mobile money (v4)" },
          { value: "edibytes", label: "Edibytes" },
          { value: "manual", label: "Manual transfer" },
        ],
      },
    ],
  },
  {
    title: "Edibytes",
    fields: [
      { key: "EDIBYTES_SECRET_KEY", label: "Secret key", secret: true, hint: "sk_test_… for testing, sk_live_… once your account is approved." },
      { key: "EDIBYTES_DOMAIN", label: "Whitelisted domain", secret: false, hint: "Must match a domain under Domains on your Edibytes dashboard. Leave empty to use this site's own address." },
    ],
  },
  {
    title: "SMS (Arkesel)",
    fields: [
      { key: "ARKESEL_API_KEY", label: "API key", secret: true },
      { key: "ARKESEL_SENDER_ID", label: "Sender name", secret: false },
    ],
  },
];

export const CONFIG_FIELDS: ConfigField[] = CONFIG_GROUPS.flatMap((group) => group.fields);
