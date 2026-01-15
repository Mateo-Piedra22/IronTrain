import { getChangelog } from '../../src/lib/changelog';

export async function GET() {
  const base = 'https://irontrain.motiona.xyz';
  const changelog = await getChangelog();
  const urls = [
    '/',
    '/downloads',
    '/changelog',
    '/faq',
    '/support',
    '/donate',
    '/privacy',
    ...changelog.releases.filter((r) => r.unreleased !== true).map((r) => `/changelog#v${r.version}`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((u) => `<url><loc>${base}${u}</loc></url>`)
      .join('\n') +
    `\n</urlset>\n`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
