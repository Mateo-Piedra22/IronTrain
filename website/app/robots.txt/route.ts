export async function GET() {
  const body = `User-agent: *\nAllow: /\nSitemap: https://irontrain.motiona.xyz/sitemap.xml\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

