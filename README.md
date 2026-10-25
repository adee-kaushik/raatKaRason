# Raat Ka Rason
A hostel snack storefront built with React / Next.js APIs, JavaScript and Tailwind CSS. Sites uses Vinext to run the Next.js application on its hosted runtime. No customer accounts.

## Current version
- Responsive catalogue with illustrated sample product images and prices
- Search, category filtering, price sorting, stock-aware quantities
- Persistent device-local cart and Buy Now guest checkout entry
- Admin sign-in entry with server-side email allowlist (denies access when unconfigured)

This is a catalogue preview. No real orders, payments, customer data collection or stock writes are enabled. Sample product data is in `lib/catalog.js`. The catalogue reads Neon when DATABASE_URL is configured. The authorized admin can edit prices and stock through a server-protected API. Replace sample stock and images before launch.

## Next integration
Use a dedicated Neon PostgreSQL database. Run `db/store-schema.sql` in its SQL editor and populate it with your actual stock. Configure server-only `DATABASE_URL` and `ADMIN_EMAIL` in hosting secrets. Admin sign-in in this hosted preview uses the platform's managed identity; on standalone hosting, replace that identity adapter with an admin auth provider.

Store products, orders and order items in PostgreSQL. Checkout must validate prices server-side and reserve/decrement stock in a transaction. Never treat localStorage cart totals as trusted. Add order submission only after pickup/delivery details and payment requirements are confirmed.

## Development
`pnpm dev` / `pnpm build`. Application UI source uses `.jsx` and `.js`; platform build infrastructure retains the supplied TypeScript configuration.
