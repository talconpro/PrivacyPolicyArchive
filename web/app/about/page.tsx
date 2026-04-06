import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About | Privacy Policy Archive',
  description: 'About Privacy Policy Archive and data sources.',
};

export default function AboutPage(): JSX.Element {
  return (
    <article className="prose max-w-3xl prose-slate">
      <h1>About</h1>
      <p>
        Privacy Policy Archive tracks public privacy policies of popular applications and summarizes changes over
        time.
      </p>
      <h2>Data Sources</h2>
      <p>
        We only analyze publicly accessible privacy policy documents from official sources, app store pages, or
        developer websites.
      </p>
      <h2>What We Provide</h2>
      <p>
        We provide machine-assisted summaries, structured risk indicators, and historical version tracking to help
        people review policy changes faster.
      </p>
    </article>
  );
}
