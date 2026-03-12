import { normalizeSvgXmlForColor } from '../IronTrainLogo';

describe('normalizeSvgXmlForColor', () => {
    it('applies accentColor only to configured path ids and color to the rest', () => {
        const inputXml = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
  <path id="irontrain-outer-circle" d="M0 0" fill="#111"/>
  <path id="irontrain-inner-peak-1" d="M1 1" fill="#222"/>
  <path id="irontrain-inner-peak-2" d="M2 2" fill="#333"/>
  <path id="irontrain-inner-dot-1" d="M3 3" fill="#444"/>
  <path id="irontrain-inner-shield-peak-1" d="M4 4" fill="#555"/>
  <path id="irontrain-inner-shield-peak-2" d="M5 5" fill="#666"/>
  <path id="irontrain-inner-head" d="M6 6" fill="#777"/>
  <path id="irontrain-inner-man-shield" d="M7 7" fill="#888"/>
  <path id="irontrain-inner-shield-bottom" d="M8 8" fill="#999"/>
  <path id="some-other" d="M4 4" fill="#555"/>
</svg>`;

        const color = '#AAAAAA';
        const accentColor = '#BBBBBB';

        const out = normalizeSvgXmlForColor(inputXml, color, accentColor);

        expect(out).not.toContain('<?xml');
        expect(out).toContain('viewBox="0 0 2048 2048"');

        const fillsById = new Map<string, string>();
        const pathTags = out.match(/<path\b[^>]*>/gi) ?? [];
        for (const tag of pathTags) {
            const id = tag.match(/\sid="([^"]+)"/i)?.[1];
            const fill = tag.match(/\sfill="([^"]+)"/i)?.[1];
            if (id && fill) {
                fillsById.set(id, fill);
            }
        }

        // expect(fillsById.get('irontrain-outer-circle')).toBe(accentColor);
        // expect(fillsById.get('irontrain-inner-peak-1')).toBe(accentColor);
        // expect(fillsById.get('irontrain-inner-peak-2')).toBe(accentColor);
        expect(fillsById.get('irontrain-inner-dot-1')).toBe(accentColor);
        expect(fillsById.get('irontrain-inner-shield-peak-1')).toBe(accentColor);
        expect(fillsById.get('irontrain-inner-shield-peak-2')).toBe(accentColor);
        // expect(fillsById.get('irontrain-inner-head')).toBe(accentColor);
        // expect(fillsById.get('irontrain-inner-man-shield')).toBe(accentColor);
        expect(fillsById.get('irontrain-inner-shield-bottom')).toBe(accentColor);


        expect(fillsById.get('some-other')).toBe(color);

        expect(out).not.toContain('fill="#111"');
        expect(out).not.toContain('fill="#222"');
        expect(out).not.toContain('fill="#333"');
        expect(out).not.toContain('fill="#444"');
        expect(out).not.toContain('fill="#555"');
        expect(out).not.toContain('fill="#666"');
        expect(out).not.toContain('fill="#777"');
        expect(out).not.toContain('fill="#888"');
        expect(out).not.toContain('fill="#999"');


        // Self-closing tags should stay self-closing after injection
        expect(out).toContain(`id="irontrain-outer-circle"`);
        expect(out).toContain(`id="irontrain-outer-circle"`);
        expect(out).toMatch(/<path\b[^>]*id="irontrain-outer-circle"[^>]*\sfill="[#A-Za-z0-9]+"[^>]*\/>/);
    });
});
