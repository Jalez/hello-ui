export default function GameRouteLoading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Preparing game...
        </p>
      </div>
    </div>
  );
}
