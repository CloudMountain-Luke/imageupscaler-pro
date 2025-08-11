export function FullScreenError() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full rounded-2xl shadow p-6 border bg-white dark:bg-gray-800">
        <h1 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">App crashed</h1>
        <p className="text-sm opacity-80 text-gray-700 dark:text-gray-300">Please try again. If this persists, check Auth config and network.</p>
      </div>
    </div>
  );
}