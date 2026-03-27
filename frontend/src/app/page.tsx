import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
            Welcome to Next.js!
          </h1>
          <p className="mt-3 max-w-3xl mx-auto text-xl text-gray-500 sm:mt-5">
            Get started by editing <code className="text-blue-600 font-mono">src/app/page.tsx</code>
          </p>
          <div className="mt-10 max-w-lg mx-auto grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/api/hello"
              className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              API Route
            </Link>
            <Link
              href="https://nextjs.org/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-5 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Documentation
            </Link>
          </div>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900">Fast</h2>
            <p className="mt-2 text-gray-600">
              Next.js provides automatic code splitting and prefetching for faster page loads.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900">SEO Ready</h2>
            <p className="mt-2 text-gray-600">
              Next.js generates static HTML pages that are easily crawlable by search engines.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900">Easy to Use</h2>
            <p className="mt-2 text-gray-600">
              Next.js comes with built-in features like routing, image optimization, and more.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
