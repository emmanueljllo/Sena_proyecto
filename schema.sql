-- Esquema de Base de Datos para Confort Market BCP

-- 1. Tabla de Usuarios (Autenticación y Gestión de Clientes/Administradores)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('customer', 'admin') DEFAULT 'customer',
    mfa_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Productos (Catálogo Premium)
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Pedidos (Dashboard de Cliente)
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Tabla de Registros del Plan de Continuidad (Admin BCP)
CREATE TABLE IF NOT EXISTS bcp_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type ENUM('backup_local', 'backup_cloud', 'backup_offline', 'drp_test', 'security_alert', 'server_status') NOT NULL,
    status ENUM('success', 'warning', 'failed', 'ongoing') NOT NULL,
    description TEXT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar datos de prueba iniciales
INSERT IGNORE INTO products (name, description, price, stock, image_url) VALUES
('ConfortBook Pro X', 'Laptop premium de alto rendimiento.', 1499.00, 50, 'assets/premium_laptop.png'),
('Chrono Elite Gold', 'Smartwatch lujoso con detalles en oro.', 399.00, 100, 'assets/premium_smartwatch.png'),
('Aura Sound Max', 'Audífonos premium con cancelación de ruido.', 299.00, 75, 'assets/premium_headphones.png');

INSERT IGNORE INTO bcp_logs (event_type, status, description) VALUES
('backup_local', 'success', 'Copia de seguridad local completada correctamente.'),
('backup_offline', 'success', 'Disco externo desconectado de la red según el protocolo BCP.'),
('server_status', 'success', 'Servidor principal operativo al 100%.');


-- 5. Tabla de Pagos (Simulada para Checkout Seguro)
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('processing', 'completed', 'failed') DEFAULT 'processing',
    transaction_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

