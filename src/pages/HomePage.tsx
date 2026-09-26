import { AboutSection } from '../components/AboutSection';
import { Masthead } from '../components/Masthead';
import { PostList } from '../components/PostList';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import siteData from '../data/site.json';
import { listPosts } from '../lib/posts';
import type { SiteContent } from '../types/content';

const site = siteData as SiteContent;

export function HomePage() {
  const posts = listPosts();

  return (
    <div className="page">
      <a className="skip-link" href="#main-content">
        Skip to the writing
      </a>
      <SiteHeader />
      <main id="main-content">
        <Masthead />
        <section
          id="writing"
          className="writing section"
          aria-labelledby="writing-heading"
        >
          <div className="section-grid">
            <div className="section-head">
              <h2 id="writing-heading">{site.writing.heading}</h2>
              <p>{site.writing.lede}</p>
            </div>
            <PostList posts={posts} />
          </div>
        </section>
        <AboutSection />
      </main>
      <SiteFooter />
    </div>
  );
}
