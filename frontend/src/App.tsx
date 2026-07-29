import { motion } from 'framer-motion'

const installedFeatures = [
  'React and TypeScript',
  'Vite development server',
  'Tailwind CSS',
  'React Router',
  'TanStack Query',
  'Axios',
  'React Hook Form and Zod',
  'Framer Motion',
]

function App() {
  const appName =
    import.meta.env.VITE_APP_NAME ?? 'Wedding Invitation'

  const appEnvironment =
    import.meta.env.VITE_APP_ENV ?? 'development'

  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ??
    'http://127.0.0.1:8000/api'

  return (
    <main className="min-h-screen bg-gradient-to-b from-powder-100 via-white to-powder-50 px-5 py-12 text-slate-800">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-3xl rounded-3xl border border-powder-200 bg-white/90 p-7 shadow-xl shadow-powder-200/40 backdrop-blur sm:p-10"
        aria-labelledby="page-title"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-gold-500">
          Local workstation
        </p>

        <h1
          id="page-title"
          className="mt-3 font-serif text-4xl text-powder-900 sm:text-5xl"
        >
          {appName}
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Phase 2 is running locally. This page verifies that the
          frontend development toolchain is configured correctly
          without any cloud services.
        </p>

        <dl className="mt-8 grid gap-4 rounded-2xl bg-powder-50 p-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold text-slate-500">
              Environment
            </dt>
            <dd className="mt-1 font-mono text-sm text-powder-800">
              {appEnvironment}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-semibold text-slate-500">
              Future local API
            </dt>
            <dd className="mt-1 break-all font-mono text-sm text-powder-800">
              {apiBaseUrl}
            </dd>
          </div>
        </dl>

        <h2 className="mt-8 font-serif text-2xl text-powder-900">
          Installed frontend foundation
        </h2>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {installedFeatures.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-3 rounded-xl border border-powder-100 bg-white px-4 py-3"
            >
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-powder-200 text-sm font-bold text-powder-800"
                aria-hidden="true"
              >
                ✓
              </span>

              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-2xl border border-dashed border-gold-400 bg-amber-50/60 p-5 text-sm leading-6 text-slate-700">
          Vercel, Cloudflare, GitHub Actions, public domains, and
          production services are intentionally not configured.
        </div>
      </motion.section>
    </main>
  )
}

export default App