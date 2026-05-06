import { Layout } from '../common/Layout';
import { AnalyticsChatPanel } from '../common/AnalyticsChatPanel';

export function Chat() {
  return (
    <Layout contentContainerClassName="h-[calc(100vh-90px)] max-w-none px-0 py-0">
      <div className="h-full">
        <AnalyticsChatPanel />
      </div>
    </Layout>
  );
}
