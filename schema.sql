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
('ConfortBook Pro X', 'Laptop premium de alto rendimiento.', 1499.00, 50, 'assets/premium_laptop_1778531221300.png'),
('Chrono Elite Gold', 'Smartwatch lujoso con detalles en oro.', 399.00, 100, 'assets/premium_smartwatch_1778531397408.png'),
('Aura Sound Max', 'Audífonos premium con cancelación de ruido.', 299.00, 75, 'assets/premium_headphones_1778531409537.png'),
('Monitor Vision 4K', 'Monitor 4K de alta definición.', 450.00, 40, 'assets/premium_monitor.jpg'),
('Teclado Titan RGB', 'Teclado mecánico con iluminación RGB.', 120.00, 60, 'assets/premium_keyboard.jpg'),
('Ratón Viper Pro', 'Ratón gaming de precisión.', 85.00, 80, 'assets/premium_mouse.jpg'),
('Silla Ergonomic Plus', 'Silla ergonómica de oficina de alta gama.', 320.00, 25, 'assets/premium_chair.jpg'),
('Cámara Stream 4K', 'Cámara web 4K para streaming y grabación profesional.', 150.00, 35, 'assets/premium_camera.jpg'),
('Micro Studio Voice', 'Micrófono de estudio profesional con cápsula dorada.', 190.00, 30, 'assets/premium_microphone.jpg'),
('Gafas Reality Max', 'Gafas de realidad virtual premium de última generación.', 599.00, 20, 'assets/premium_glasses.jpg'),
('Drone SkyEye Pro', 'Drone profesional con cámara de alta precisión y estabilizador.', 899.00, 15, 'assets/premium_drone.jpg'),
('Tablet ArtPad 12"', 'Tablet profesional para diseño y productividad con lápiz óptico.', 250.00, 45, 'assets/premium_tablet.jpg'),
('Altavoz Smart Echo', 'Altavoz inteligente con sonido envolvente y asistente de voz.', 99.00, 60, 'assets/premium_speaker.jpg');

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

