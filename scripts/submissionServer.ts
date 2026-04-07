import { startSubmissionServer } from '../src/server/submissionServer';

const port = Number(process.env.SUBMISSION_API_PORT ?? '8787');

if (!Number.isFinite(port) || port <= 0) {
  throw new Error(`Invalid SUBMISSION_API_PORT: ${process.env.SUBMISSION_API_PORT ?? ''}`);
}

startSubmissionServer(port);
