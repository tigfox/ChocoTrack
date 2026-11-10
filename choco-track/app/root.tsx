import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

/** The pick list lives in #print-root: hidden on screen, the only thing shown when printing. */
const PRINT_CSS = `
  #print-root { display: none; }
  .pick-sheet { font-family: Helvetica, Arial, sans-serif; color: #000; }
  .pick-sheet table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  .pick-sheet th, .pick-sheet td { border: 1px solid #999; padding: 5px 8px; text-align: left; }
  .pick-sheet .box-cell { font-size: 18px; text-align: center; }
  .pick-sheet .sign-line { margin-top: 28px; }
  @media print {
    #app-root { display: none !important; }
    #print-root { display: block; }
    body { background: #fff; }
  }
`;

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
        <style>{PRINT_CSS}</style>
      </head>
      <body>
        <div id="app-root">
          <Outlet />
        </div>
        <div id="print-root" />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
