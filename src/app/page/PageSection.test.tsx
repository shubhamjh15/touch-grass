import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageSection, PageStack } from './PageSection';

describe('<PageSection>', () => {
  it('is a landmark named by its heading, so a screen reader can jump to it', () => {
    render(
      <PageStack>
        <PageSection title="This week" lead="Three things to try.">
          <p>content</p>
        </PageSection>
      </PageStack>,
    );
    const region = screen.getByRole('region', { name: 'This week' });
    expect(region).toHaveTextContent('Three things to try.');
    expect(screen.getByRole('heading', { level: 2, name: 'This week' })).toBeInTheDocument();
  });

  it('offers a See all door that goes where the page says', () => {
    render(
      <PageSection title="Badges" id="badges" seeAll={{ href: '/me#badges' }}>
        <p>content</p>
      </PageSection>,
    );
    expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/me#badges');
  });

  it('lets a page put its own control beside the heading when there is no See all', () => {
    render(
      <PageSection title="History" aside={<button type="button">Filter</button>}>
        <p>content</p>
      </PageSection>,
    );
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'See all' })).not.toBeInTheDocument();
  });
});
