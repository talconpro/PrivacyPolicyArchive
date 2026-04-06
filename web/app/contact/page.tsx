import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact | Privacy Policy Archive',
  description: 'Contact and correction channel for Privacy Policy Archive.',
};

export default function ContactPage(): JSX.Element {
  return (
    <article className="prose max-w-3xl prose-slate">
      <h1>Contact</h1>
      <p>
        If you found incorrect data, missing context, or want to request corrections, please contact the maintainers.
      </p>
      <h2>Correction Requests</h2>
      <p>
        Include app name, policy URL, and a brief explanation of the issue. We prioritize critical risk inaccuracies and
        source-link corrections.
      </p>
      <h2>Email</h2>
      <p>
        <a href="talconpro@outlook.com">talconpro@outlook.com</a>
      </p>
    </article>
  );
}
