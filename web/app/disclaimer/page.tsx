import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Disclaimer | Privacy Policy Archive',
  description: 'Important legal and usage disclaimer.',
};

export default function DisclaimerPage(): JSX.Element {
  return (
    <article className="prose max-w-3xl prose-slate">
      <h1>Disclaimer</h1>
      <p>
        This website provides AI-assisted policy analysis for informational purposes only. It does not constitute legal
        advice.
      </p>
      <h2>Accuracy</h2>
      <p>
        While we aim for high-quality outputs, automated extraction and model analysis may be incomplete or inaccurate.
        Always verify against official policy text.
      </p>
      <h2>No Legal Opinion</h2>
      <p>
        You should consult qualified professionals for legal interpretation, compliance decisions, or risk acceptance.
      </p>
    </article>
  );
}
