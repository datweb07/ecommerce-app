import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FanCards } from '../src/components/common/fan-cards';
import { storeBenefits } from '../src/config/site';
import { fanCardPose } from '../src/lib/fan-cards';

describe('FanCards', () => {
  it('fans exactly three cards symmetrically around the lowest pivot', () => {
    expect([0, 1, 2].map((index) => fanCardPose(index, 3).angle)).toEqual([
      -6, 0, 6,
    ]);
    expect([0, 1, 2].map((index) => fanCardPose(index, 3).drop)).toEqual([
      12, 0, 12,
    ]);
    expect(fanCardPose(0, 2).angle).toBe(0);
  });

  it('server-renders the original copy and a fixed focus slot per card', () => {
    const markup = renderToStaticMarkup(
      <FanCards
        items={storeBenefits.map((item) => ({
          ...item,
          id: item.icon,
          icon: null,
        }))}
      />,
    );
    expect(markup.match(/tabindex="0"/gi)).toHaveLength(3);
    let previous = -1;
    for (const { title, description } of storeBenefits) {
      expect(markup.indexOf(title)).toBeGreaterThan(previous);
      expect(markup).toContain(description);
      previous = markup.indexOf(title);
    }
  });
});
