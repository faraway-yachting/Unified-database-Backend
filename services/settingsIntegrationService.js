const KNOWN_INTEGRATIONS = [
  { key: 'resend', name: 'Resend', description: 'Email delivery', envKey: 'RESEND_API_KEY' },
  { key: 'aws_s3', name: 'AWS S3', description: 'File storage', envKey: 'AWS_S3_BUCKET' },
  { key: 'stripe', name: 'Stripe', description: 'Payments', envKey: 'STRIPE_SECRET_KEY' },
];

export async function listIntegrations() {
  const integrations = KNOWN_INTEGRATIONS.map((i) => ({
    key: i.key,
    name: i.name,
    description: i.description,
    connected: !!(process.env[i.envKey] && process.env[i.envKey].trim()),
  }));
  return { integrations };
}

export async function updateIntegration(key, data) {
  const integration = KNOWN_INTEGRATIONS.find((i) => i.key === key);
  if (!integration) {
    const err = new Error('Integration not found');
    err.status = 404;
    throw err;
  }
  return {
    key: integration.key,
    name: integration.name,
    message: 'Configure integration via environment variables (e.g. ' + integration.envKey + '). Restart the server after updating env.',
  };
}

export async function disconnectIntegration(key) {
  const integration = KNOWN_INTEGRATIONS.find((i) => i.key === key);
  if (!integration) {
    const err = new Error('Integration not found');
    err.status = 404;
    throw err;
  }
  return {
    key: integration.key,
    message: 'Remove ' + integration.envKey + ' from environment and restart the server to disconnect.',
  };
}
