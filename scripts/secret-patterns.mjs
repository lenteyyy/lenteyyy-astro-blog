// Return categories only. Never put a matching credential into audit output.
const patterns = [
  ['GitHub credential', /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}\b/g],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['service credential', /\b(?:sk_live_|rk_live_|sk-proj-|sk-ant-|sb_secret_|xox[baprs]-)[A-Za-z0-9_-]{20,}/g],
  ['Google API key', /\bAIza[A-Za-z0-9_-]{35}\b/g],
  ['database credential URL', /\b(?:postgres(?:ql)?|mysql|rediss?|mongodb(?:\+srv)?):\/\/[^\s"'<>:@/]+:([^\s"'<>@]+)@[^\s"'<>]+/g],
];

export function secretFindings(text, knownValues = []) {
  const findings = new Set();
  if (knownValues.some(value => text.includes(value))) findings.add('known local secret literal');
  for (const [kind, pattern] of patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (/placeholder|replace|your[-_]|example|test-only/i.test(match[0])) continue;
      findings.add(kind);
    }
  }
  for (const match of text.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try {
      const payload = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString());
      if (payload.role === 'service_role') findings.add('service role JWT');
    } catch { /* Invalid token-like prose is not a valid JWT payload. */ }
  }
  return [...findings];
}
