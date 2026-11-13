export function refuseServiceWorker(host: string, production: boolean, framed: boolean, disabled: boolean) {
  const hostname = host.toLowerCase();
  const platform = /\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(hostname);
  const label = hostname.split('.')[0] ?? '';
  return !production || framed || disabled ||
    (platform && (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(label) || /^project--.+-dev$/.test(label))) ||
    /(^|\.)(lovableproject\.com|lovableproject-dev\.com|beta\.lovable\.dev)$/.test(hostname);
}