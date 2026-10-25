# Raat Ka Rason
Mobile-first midnight snack store for hostel students. JavaScript, React, Next.js APIs, Tailwind CSS and Neon PostgreSQL. The hosted Sites runtime uses Vinext and Cloudflare Workers; image uploads use its private R2 binding.

## Customer experience
- Guest browsing and checkout; no customer accounts.
- Search, categories, sorting, photos, prices, MRP, descriptions and exact remaining stock.
- Stock refreshes every 10 seconds while the page is visible and when the tab returns to focus.
- Persistent device-local bag. Server checks current prices, fees and stock at order placement.
- Cash on delivery, supported-hostel selector, room number and delivery notes.
- Order confirmation and live status, available under My orders on the same device.

## Admin
Email/password login with bcrypt hashing, HttpOnly session cookies, database-backed sessions and throttling. No public registration. All admin API operations check the session server-side and all writes verify Origin.

The mobile-first dashboard supports:
- Product creation/editing, image uploads, category, description, price/MRP, sorting, stock and visibility.
- Restocking, low-stock overview and reversible product hiding.
- Orders, customer contact/delivery details, fulfilment states, cancellation with automatic restocking, and delivered revenue.
- Store open/closed switch, displayed hours, supported hostels, delivery fee and minimum order.
- Homepage copy, announcement, branding, category list, footer and support phone.

## Neon setup
1. Create a dedicated Neon project and a temporary development branch. Select a region near your users.
2. Set `DATABASE_URL_UNPOOLED` to the direct connection for the development branch and run `pnpm db:setup`.
3. Run `pnpm test` to verify transaction and API rules locally; test a complete order on the development branch before production.
4. Apply the schema to the production branch. Configure pooled `DATABASE_URL`, `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` as hosting secrets. Never commit credentials.
5. Use a bcrypt hash at cost 12 for the chosen password; do not put the plaintext password in an environment file.
6. Add real products, photos, quantities and supported hostels in admin, then enable “Accept new orders”. No sample products are seeded into the real database.

`db/store-schema.sql` is idempotent. SQL functions atomically create orders, validate prices, lock stock rows, enforce per-phone order limits and restore cancelled stock exactly once. Idempotency keys prevent duplicate orders from request retries. Inventory writes use row versions to prevent an admin edit overwriting a concurrent purchase.

## Important operating details
Opening hours are display text; availability is controlled by the admin switch. Online card/UPI payments are not integrated. Delivered COD orders record cash collected. Guest order tokens are private bearer references stored only on the shopper’s device; the public status endpoint omits customer names, phones and addresses.

Without a database connection, the site shows a clearly marked sample catalogue and blocks checkout and admin login. With a connection, it shows actual inventory only; database failures never silently become sample inventory.

## Development
- `pnpm dev`
- `pnpm test`
- `pnpm build`

The application uses `.jsx` and `.js`. Supplied hosting/build infrastructure retains its original TypeScript files. Do not remove the Sites build integration when deploying to this host.
