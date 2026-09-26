import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';

import App from './App';

/** Render a route to static HTML (no client JS required to display it). */
export function render(url: string): string {
  return renderToStaticMarkup(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>,
  );
}

export { listPosts, postSlugs } from './lib/posts';
