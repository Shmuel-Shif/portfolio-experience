// Plug a real delivery service in here. Nothing is sent until this returns ok: true.
export async function submitContact(payload) {
  void payload;
  return { ok: false, reason: 'not-configured' };
}
