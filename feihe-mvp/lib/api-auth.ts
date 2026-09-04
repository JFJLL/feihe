const PUBLIC_WORKSPACE_USER = {
  userId: 'public-workspace',
  email: '',
  displayName: '公开访问',
  fullName: '公开访问',
};

export async function apiUser(requireWrite = false) {
  void requireWrite;
  return PUBLIC_WORKSPACE_USER;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}
