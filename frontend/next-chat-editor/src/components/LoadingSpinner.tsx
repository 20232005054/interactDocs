export default function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-green-200 border-t-green-500"></div>
        <p className="mt-2 text-gray-600">加载中...</p>
      </div>
    </div>
  );
}
