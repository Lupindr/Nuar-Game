import { Outlet, ScrollRestoration, createRootRoute } from '@tanstack/react-router'
import { HeadContent, Scripts } from '@tanstack/start'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <HeadContent />
      </head>
      <body className="bg-zinc-950 text-zinc-100">
        <div id="app" className="min-h-screen">
          <Outlet />
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
