import { Suspense } from "react";

import YjsPrototypeClient from "./YjsPrototypeClient";

interface PrototypePageProps {
  params: Promise<{
    gameId: string;
  }>;
}

function PrototypeFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">Preparing Yjs prototype...</p>
      </div>
    </div>
  );
}

export default function PrototypePage(props: PrototypePageProps) {
  return (
    <Suspense fallback={<PrototypeFallback />}>
      <YjsPrototypeClient {...props} />
    </Suspense>
  );
}
