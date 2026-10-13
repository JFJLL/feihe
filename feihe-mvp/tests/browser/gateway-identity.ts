export async function gatewayIdentity(userId: string, timestamp = String(Date.now())) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(process.env.FEIHE_GATEWAY_TEST_SECRET || 'isolated-gateway-fixture-only'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userId + '\n' + timestamp))).toString('hex');
  return { 'x-feihe-user-id': userId, 'x-feihe-auth-timestamp': timestamp, 'x-feihe-auth-signature': signature };
}
