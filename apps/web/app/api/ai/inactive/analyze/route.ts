import { handleAiProxyForPath } from '../../_shared';

const SUB_PATH = 'inactive/analyze' as const;

export async function GET(request: Request) {
  return handleAiProxyForPath(request, SUB_PATH);
}

export async function POST(request: Request) {
  return handleAiProxyForPath(request, SUB_PATH);
}
