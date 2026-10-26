-- Raat Ka Rason: apply to a dedicated Neon database. Safe to re-run.
CREATE TABLE IF NOT EXISTS products (
 id text PRIMARY KEY, name text NOT NULL, brand text NOT NULL DEFAULT '', category text NOT NULL,
 size text NOT NULL, price integer NOT NULL CHECK(price >= 0), stock integer NOT NULL DEFAULT 0 CHECK(stock >= 0),
 tag text, image text NOT NULL, active boolean NOT NULL DEFAULT true
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS mrp integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS store_settings(id integer PRIMARY KEY CHECK(id=1),data jsonb NOT NULL,version integer NOT NULL DEFAULT 1);
INSERT INTO store_settings(id,data) VALUES(1,'{"store_name":"Raat Ka Rason","announcement":"FOR THE ONE MORE EPISODE KIND OF NIGHT · HELPLINE: 9996301793","hero_title":"Big cravings.\nSmall hours.","hero_subtitle":"Your favourite snacks, just a few taps away. Because hunger doesn’t follow hostel timings.","hero_eyebrow":"THE HOSTEL AFTER-HOURS CLUB","hero_cta":"Find your midnight fix","banner_title":"For study nights. And movie nights.","banner_text":"Keep the good snacks close, and the good times going.","footer_text":"A little store for your late-night cravings. Call or WhatsApp 9996301793.","is_open":false,"closed_message":"We’re setting up our snack stash. Check back soon!","opening_hours":"Late nights · 10 PM - 4 AM","delivery_fee":0,"minimum_order":0,"delivery_note":"Delivery within supported hostels only","contact_phone":"9996301793","hostels":[],"categories":[{"name":"Chips & snacks","emoji":"🥔"},{"name":"Instant meals","emoji":"🍜"},{"name":"Drinks","emoji":"🥤"},{"name":"Biscuits","emoji":"🍪"},{"name":"Chocolates","emoji":"🍫"}]}'::jsonb) ON CONFLICT(id) DO NOTHING;
-- Additional dashboard accounts can only receive read-only access.
CREATE TABLE IF NOT EXISTS admin_accounts (
 email text PRIMARY KEY CHECK(email=lower(trim(email))),
 password_hash text NOT NULL CHECK(password_hash LIKE '$2%'),
 role text NOT NULL DEFAULT 'read_only' CHECK(role='read_only'),
 active boolean NOT NULL DEFAULT true,
 credentials_updated_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_sessions(token_hash text PRIMARY KEY,email text NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sessions_expiry ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS request_limits(key text PRIMARY KEY,window_start timestamptz NOT NULL DEFAULT now(),attempts integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS orders(
 id uuid PRIMARY KEY,request_key uuid NOT NULL UNIQUE,lookup_token text NOT NULL UNIQUE,request_payload jsonb NOT NULL,
 customer_name text NOT NULL,phone text NOT NULL,hostel text NOT NULL,room text NOT NULL,notes text NOT NULL DEFAULT '',
 subtotal integer NOT NULL CHECK(subtotal >= 0),delivery_fee integer NOT NULL CHECK(delivery_fee >= 0),total integer NOT NULL CHECK(total >= 0),
 payment_method text NOT NULL DEFAULT 'prepaid' CHECK(payment_method IN ('prepaid','cod')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','accepted','packing','out_for_delivery','delivered','cancelled')),
 payment_status text NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN('unpaid','paid')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_phone_created ON orders(phone,created_at DESC);
CREATE TABLE IF NOT EXISTS order_items(
 order_id uuid NOT NULL REFERENCES orders(id),product_id text NOT NULL REFERENCES products(id),
 name text NOT NULL,size text NOT NULL,unit_price integer NOT NULL CHECK(unit_price >= 0),quantity integer NOT NULL CHECK(quantity > 0),
 PRIMARY KEY(order_id,product_id)
);
-- All order creation and inventory changes happen in one database transaction.
CREATE OR REPLACE FUNCTION place_store_order(p_id uuid,p_key uuid,p_token text,p_customer jsonb,p_items jsonb,p_fee integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE existing orders%ROWTYPE; settings jsonb; item jsonb; product products%ROWTYPE; subtotal integer:=0; fee integer; result jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 SELECT * INTO existing FROM orders WHERE request_key=p_key;
 IF FOUND THEN
  IF existing.request_payload<>jsonb_build_object('customer',p_customer,'items',p_items,'fee',p_fee) THEN RAISE EXCEPTION 'REQUEST_CHANGED'; END IF;
  RETURN jsonb_build_object('id',existing.id,'token',existing.lookup_token,'total',existing.total,'status',existing.status);
 END IF;
 SELECT data INTO settings FROM store_settings WHERE id=1 FOR SHARE;
 IF settings IS NULL OR NOT coalesce((settings->>'is_open')::boolean,false) THEN RAISE EXCEPTION 'STORE_CLOSED'; END IF;
 IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)<1 OR jsonb_array_length(p_items)>30 THEN RAISE EXCEPTION 'INVALID_CART'; END IF;
 IF (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_items)x)<>jsonb_array_length(p_items) THEN RAISE EXCEPTION 'INVALID_CART'; END IF;
 IF jsonb_array_length(coalesce(settings->'hostels','[]'::jsonb))=0 OR NOT (settings->'hostels' @> jsonb_build_array(p_customer->>'hostel')) THEN RAISE EXCEPTION 'HOSTEL_UNSUPPORTED'; END IF;
 -- Serialize per phone as well, to enforce the order rate limit across instances.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_customer->>'phone',1));
 IF (SELECT count(*) FROM orders WHERE phone=p_customer->>'phone' AND created_at>now()-interval '15 minutes')>=5 THEN RAISE EXCEPTION 'TOO_MANY_ORDERS'; END IF;
 -- Lock in a stable order to avoid deadlocks for overlapping carts.
 PERFORM 1 FROM products WHERE id IN(SELECT x->>'id' FROM jsonb_array_elements(p_items)x) ORDER BY id FOR UPDATE;
 FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  SELECT * INTO product FROM products WHERE id=item->>'id';
  IF NOT FOUND OR NOT product.active THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
  IF (item->>'quantity')::integer<1 OR (item->>'quantity')::integer>99 THEN RAISE EXCEPTION 'INVALID_CART'; END IF;
  IF product.stock<(item->>'quantity')::integer THEN RAISE EXCEPTION 'STOCK_CHANGED'; END IF;
  IF product.price<>(item->>'price')::integer THEN RAISE EXCEPTION 'PRICE_CHANGED'; END IF;
  subtotal:=subtotal+product.price*(item->>'quantity')::integer;
 END LOOP;
 IF subtotal<coalesce((settings->>'minimum_order')::integer,0) THEN RAISE EXCEPTION 'MINIMUM_ORDER'; END IF;
 fee:=coalesce((settings->>'delivery_fee')::integer,0);
 IF fee<>p_fee THEN RAISE EXCEPTION 'DELIVERY_FEE_CHANGED'; END IF;
 INSERT INTO orders(id,request_key,lookup_token,request_payload,customer_name,phone,hostel,room,notes,subtotal,delivery_fee,total)
 VALUES(p_id,p_key,p_token,jsonb_build_object('customer',p_customer,'items',p_items,'fee',p_fee),p_customer->>'name',p_customer->>'phone',p_customer->>'hostel',p_customer->>'room',coalesce(p_customer->>'notes',''),subtotal,fee,subtotal+fee);
 FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  SELECT * INTO product FROM products WHERE id=item->>'id';
  INSERT INTO order_items(order_id,product_id,name,size,unit_price,quantity) VALUES(p_id,product.id,product.name,product.size,product.price,(item->>'quantity')::integer);
  UPDATE products SET stock=stock-(item->>'quantity')::integer,version=version+1,updated_at=now() WHERE id=product.id;
 END LOOP;
 RETURN jsonb_build_object('id',p_id,'token',p_token,'total',subtotal+fee,'status','pending');
END $$;
CREATE OR REPLACE FUNCTION update_store_order(p_id uuid,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE current_order orders%ROWTYPE; allowed boolean; item record;
BEGIN
 SELECT * INTO current_order FROM orders WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF current_order.status=p_status THEN RETURN jsonb_build_object('id',p_id,'status',p_status); END IF;
 allowed:=CASE current_order.status
  WHEN 'pending' THEN p_status IN('accepted','cancelled')
  WHEN 'accepted' THEN p_status IN('packing','cancelled')
  WHEN 'packing' THEN p_status IN('out_for_delivery','cancelled')
  WHEN 'out_for_delivery' THEN p_status IN('delivered','cancelled') ELSE false END;
 IF NOT allowed THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
 IF p_status='cancelled' THEN
  FOR item IN SELECT product_id,quantity FROM order_items WHERE order_id=p_id ORDER BY product_id LOOP
   UPDATE products SET stock=stock+item.quantity,version=version+1,updated_at=now() WHERE id=item.product_id;
  END LOOP;
 END IF;
 UPDATE orders SET status=p_status,payment_status=CASE WHEN p_status='delivered' THEN 'paid' ELSE payment_status END,updated_at=now() WHERE id=p_id;
 RETURN jsonb_build_object('id',p_id,'status',p_status);
END $$;
REVOKE ALL ON FUNCTION place_store_order(uuid,uuid,text,jsonb,jsonb,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_store_order(uuid,text) FROM PUBLIC;
-- The server connects as the database owner. Never expose DATABASE_URL to a browser.
