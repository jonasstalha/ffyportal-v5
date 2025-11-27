import React from 'react';

// A simple, self-contained guidelines viewer component.
// Tailwind classes are used to match the project's styling approach.

export const UiUxGuidelines: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-md shadow-sm">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">UI / UX Guidelines</h1>

      <section className="mb-6">
        <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">Purpose</h2>
        <p className="mt-2 text-gray-700 dark:text-gray-300">A single-source-of-truth for consistent, accessible, and predictable interfaces across the platform.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">Design tokens</h2>
        <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
          <li>Primary: use <span className="font-semibold text-emerald-600">emerald (primary)</span></li>
          <li>Accent: <span className="font-semibold text-amber-400">amber</span></li>
          <li>Spacing: 4px × [1,2,3,4,6,8] (use Tailwind spacing scale)</li>
          <li>Border radius: rounded-md</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">Accessibility</h2>
        <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
          <li>Keyboard accessible controls with visible focus states (ring or outline).</li>
          <li>Semantic HTML and ARIA where necessary.</li>
          <li>All images must have descriptive alt text.</li>
          <li>Text contrast must meet WCAG AA.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">Forms & Buttons</h2>
        <div className="mt-2 text-gray-700 dark:text-gray-300 space-y-2">
          <p>- Labels above inputs; inline validation and clear error text.</p>
          <p>- Primary action: solid emerald button. Secondary: outline or neutral.</p>
          <div className="mt-3 flex gap-3">
            <button className="px-4 py-2 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300">Primary</button>
            <button className="px-4 py-2 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200">Secondary</button>
            <button className="px-4 py-2 rounded-md bg-gray-100 text-gray-400 cursor-not-allowed" disabled>Disabled</button>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">States & Feedback</h2>
        <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
          <li>Use skeletons or spinners during loading.</li>
          <li>Toasts for transient messages; keep them dismissible and non-blocking.</li>
          <li>Clear success/error messaging and undo when appropriate.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">Do's & Don'ts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="p-3 border rounded-md bg-green-50">
            <h3 className="font-semibold text-green-800">Do</h3>
            <ul className="list-disc list-inside text-green-800 mt-2">
              <li>Prioritize clarity.</li>
              <li>Test keyboard navigation.</li>
              <li>Keep actions consistent.</li>
            </ul>
          </div>
          <div className="p-3 border rounded-md bg-red-50">
            <h3 className="font-semibold text-red-800">Don't</h3>
            <ul className="list-disc list-inside text-red-800 mt-2">
              <li>Rely only on color for meaning.</li>
              <li>Overload screens with actions.</li>
              <li>Use unlabeled icon-only buttons.</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="text-sm text-gray-500 dark:text-gray-400 mt-6">
        Last updated: 2025-10-09 — Add this component into your documentation route or import into `App.tsx` to view it in the running app.
      </footer>
    </div>
  );
};

export default UiUxGuidelines;
