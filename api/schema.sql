CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(40) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('client', 'admin') NOT NULL DEFAULT 'client',
    email_verified TINYINT(1) NOT NULL DEFAULT 0,
    otp_hash VARCHAR(255) NULL,
    otp_expires_at DATETIME NULL,
    otp_sent_at DATETIME NULL,
    otp_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    otp_purpose ENUM('login', 'reset') NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_login_attempts (
    bucket_hash CHAR(64) PRIMARY KEY,
    attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    window_started_at DATETIME NOT NULL,
    blocked_until DATETIME NULL,
    INDEX idx_auth_attempt_window (window_started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_rate_limits (
    bucket_hash CHAR(64) PRIMARY KEY,
    attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    window_started_at DATETIME NOT NULL,
    INDEX idx_api_limit_window (window_started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    old_price DECIMAL(10,2) NULL,
    category VARCHAR(80) NOT NULL,
    rating DECIMAL(2,1) NOT NULL DEFAULT 5.0,
    reviews INT UNSIGNED NOT NULL DEFAULT 0,
    image VARCHAR(500) NOT NULL,
    badge ENUM('new', 'sale') NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (price >= 0),
    CHECK (old_price IS NULL OR old_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO products (id, name, price, old_price, category, rating, reviews, image, badge) VALUES
(1, 'ConfortBook Pro X', 1499.00, 1699.00, 'Computadores', 4.9, 128, 'assets/premium_laptop_1778531221300.png', 'new'),
(2, 'Chrono Elite Gold', 399.00, NULL, 'Accesorios', 4.8, 85, 'assets/premium_smartwatch_1778531397408.png', NULL),
(3, 'Aura Sound Max', 299.00, 349.00, 'Audio', 4.7, 210, 'assets/premium_headphones_1778531409537.png', 'sale'),
(4, 'Monitor Vision 4K', 450.00, NULL, 'Computadores', 4.6, 54, 'assets/premium_monitor.jpg', NULL),
(5, 'Teclado Titan RGB', 120.00, 150.00, 'Accesorios', 4.8, 320, 'assets/premium_keyboard.jpg', 'sale'),
(6, 'Ratón Viper Pro', 85.00, NULL, 'Accesorios', 4.5, 112, 'assets/premium_mouse.jpg', NULL),
(7, 'Silla Ergonomic Plus', 320.00, NULL, 'Hogar', 4.7, 89, 'assets/premium_chair.jpg', NULL),
(8, 'Cámara Stream 4K', 150.00, NULL, 'Accesorios', 4.4, 67, 'assets/premium_camera.jpg', NULL),
(9, 'Micro Studio Voice 24K', 190.00, 220.00, 'Audio', 4.9, 145, 'assets/premium_microphone.jpg', 'sale'),
(10, 'Gafas Reality Max', 599.00, NULL, 'Drones', 4.6, 34, 'assets/premium_glasses.jpg', 'new'),
(11, 'Drone SkyEye Pro', 899.00, 999.00, 'Drones', 4.8, 42, 'assets/premium_drone.jpg', 'sale'),
(12, 'Tablet ArtPad 12"', 250.00, NULL, 'Computadores', 4.5, 76, 'assets/premium_tablet.jpg', NULL),
(13, 'Altavoz Smart Echo', 99.00, NULL, 'Hogar', 4.3, 201, 'assets/premium_speaker.jpg', NULL);

CREATE TABLE IF NOT EXISTS orders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(32) NOT NULL UNIQUE,
    user_id BIGINT UNSIGNED NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(254) NOT NULL,
    shipping_phone VARCHAR(30) NOT NULL,
    shipping_address VARCHAR(255) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) NOT NULL DEFAULT 0,
    coupon_code VARCHAR(32) NULL,
    tax DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status ENUM('Procesando', 'Enviado', 'Entregado') NOT NULL DEFAULT 'Procesando',
    invoice_sent_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_orders_user_date (user_id, created_at),
    INDEX idx_orders_status_date (status, created_at),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NULL,
    product_name VARCHAR(150) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    quantity SMALLINT UNSIGNED NOT NULL,
    line_total DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
