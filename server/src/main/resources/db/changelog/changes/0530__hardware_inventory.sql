CREATE TABLE baitly_hardware_stock (
    id VARCHAR(100) PRIMARY KEY, country VARCHAR(2) NOT NULL CHECK(country IN ('FR','MA','SA')), sku VARCHAR(80) NOT NULL,
    available INTEGER NOT NULL DEFAULT 0 CHECK(available>=0), reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0), UNIQUE(country,sku)
);
CREATE TABLE baitly_hardware_stock_changes (
    id BIGSERIAL PRIMARY KEY, stock_id VARCHAR(100) NOT NULL REFERENCES baitly_hardware_stock(id), request_id UUID NOT NULL UNIQUE,
    delta INTEGER NOT NULL CHECK(delta<>0), before_quantity INTEGER NOT NULL CHECK(before_quantity>=0),
    proof VARCHAR(255) NOT NULL, actor VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE baitly_hardware_reservations (
    id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL, order_id BIGINT NOT NULL REFERENCES hardware_orders(id),
    stock_id VARCHAR(100) NOT NULL REFERENCES baitly_hardware_stock(id), quantity INTEGER NOT NULL CHECK(quantity>0),
    state VARCHAR(20) NOT NULL CHECK(state IN ('HELD','SOLD','RELEASED','RETURNED')), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(order_id,stock_id)
);
CREATE INDEX baitly_hardware_reserved_orders ON baitly_hardware_reservations(state,created_at);
