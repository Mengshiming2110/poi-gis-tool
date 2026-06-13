const REPO_OWNER = 'Mengshiming2110';
const REPO_NAME = 'poi-gis-tool';
const CURRENT_VERSION = '1.0.0';

interface Release {
  tag: string;
  name: string;
  url: string;
  body: string;
  assets: { name: string; url: string; size: number }[];
}

async function fetchLatestRelease(): Promise<Release | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      tag: data.tag_name || '',
      name: data.name || data.tag_name || '',
      url: data.html_url || '',
      body: data.body || '',
      assets: (data.assets || []).map((a: any) => ({
        name: a.name,
        url: a.browser_download_url,
        size: a.size,
      })),
    };
  } catch {
    return null;
  }
}

function parseVersion(tag: string): number[] {
  // Handle "v1.0.0" or "1.0.0"
  const cleaned = tag.replace(/^v/, '');
  return cleaned.split('.').map(Number);
}

function isNewer(latest: string, current: string): boolean {
  const lp = parseVersion(latest);
  const cp = parseVersion(current);
  for (let i = 0; i < Math.max(lp.length, cp.length); i++) {
    const l = lp[i] || 0;
    const c = cp[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

export interface UpdateInfo {
  available: boolean;
  version: string;
  url: string;
  body: string;
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const latest = await fetchLatestRelease();
  if (!latest || !latest.tag) {
    return { available: false, version: '', url: '', body: '' };
  }

  if (isNewer(latest.tag, CURRENT_VERSION)) {
    return {
      available: true,
      version: latest.tag,
      url: latest.url,
      body: latest.body,
    };
  }

  return { available: false, version: '', url: '', body: '' };
}

export { CURRENT_VERSION };
