import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Methodology | Privacy Policy Archive',
  description: 'How Privacy Policy Archive fetches, analyzes, and scores policy risks.',
};

export default function MethodologyPage(): JSX.Element {
  return (
    <article className="prose max-w-3xl prose-slate">
      <h1>Methodology</h1>
      <p>
        The pipeline runs in stages: discovery, fetch, parse, versioning, AI analysis, rule-based scoring, review
        decision, and snapshot generation.
      </p>
      <h2>Analysis Pipeline</h2>
      <p>
        AI output is parsed as JSON, validated with strict schema rules, normalized into stable fields, and then scored
        by deterministic risk rules.
      </p>
      <h2>Risk Scoring</h2>
      <p>
        Final <code>riskScore</code> and <code>riskLevel</code> come from explainable rules, including hard triggers such
        as data sale, forced arbitration, and widespread third-party sharing.
      </p>
      <h2>Human Review Queue</h2>
      <p>
        Items with critical risk, low confidence, abnormal text length, or sensitive flags are queued for manual
        verification.
      </p>
    </article>
  );
}
