<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\Exception as MailException;
use PHPMailer\PHPMailer\PHPMailer;
use Dompdf\Dompdf;

$configFile = __DIR__ . '/config.local.php';
if (!is_file($configFile)) {
    error_log('Confort Market API: falta api/config.local.php.');
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'El servicio no está configurado. Contacta al administrador.']);
    exit;
}
$config = require $configFile;
require_once __DIR__ . '/../vendor/autoload.php';

function respond(int $status, array $data): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function requestData(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 32768) {
        respond(413, ['error' => 'La solicitud supera el tamaño permitido.']);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        respond(400, ['error' => 'La solicitud no tiene un formato válido.']);
    }
    return $data;
}

function database(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    global $config;
    $host = $config['db']['host'] ?? '';
    $name = $config['db']['name'] ?? '';
    $user = $config['db']['user'] ?? '';
    $password = $config['db']['password'] ?? '';
    if (!$host || !$name || !$user || !$password || str_contains($password, 'REPLACE_WITH_')) {
        error_log('Confort Market API: falta configurar la conexión MySQL.');
        respond(503, ['error' => 'El servicio no está configurado. Contacta al administrador.']);
    }

    try {
        $pdo = new PDO(
            "mysql:host={$host};dbname={$name};charset=utf8mb4",
            $user,
            $password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]
        );
        $pdo->exec("SET time_zone = '+00:00'");
        return $pdo;
    } catch (PDOException $exception) {
        error_log('Confort Market API database connection failed: ' . $exception->getMessage());
        respond(503, ['error' => 'No fue posible conectar con el servicio. Intenta más tarde.']);
    }
}

function startSecureSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
    $host = strtolower(explode(':', $_SERVER['HTTP_HOST'] ?? '')[0]);
    if (!$isHttps && !in_array($host, ['localhost', '127.0.0.1'], true)) {
        respond(400, ['error' => 'La conexión segura HTTPS es obligatoria.']);
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.gc_maxlifetime', '28800');
    session_name('confort_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}

function assertSameOrigin(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return;
    }
    $originScheme = strtolower((string)parse_url($origin, PHP_URL_SCHEME));
    $originHost = strtolower((string)parse_url($origin, PHP_URL_HOST));
    $originPort = parse_url($origin, PHP_URL_PORT);
    $requestHost = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $requestScheme = ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https') ? 'https' : 'http';
    $defaultRequestPort = $requestScheme === 'https' ? 443 : 80;
    $requestPort = (int)($_SERVER['HTTP_X_FORWARDED_PORT'] ?? (
        strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https'
            ? 443
            : ($_SERVER['SERVER_PORT'] ?? $defaultRequestPort)
    ));
    $effectiveOriginPort = $originPort ?? ($originScheme === 'https' ? 443 : 80);
    $requestHostName = strtolower(explode(':', $requestHost)[0]);
    if (!$originHost || $originHost !== $requestHostName || $originScheme !== $requestScheme || $effectiveOriginPort !== $requestPort) {
        respond(403, ['error' => 'Origen de solicitud no permitido.']);
    }
}

function requireCsrf(): void
{
    $expected = $_SESSION['csrf_token'] ?? '';
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        respond(403, ['error' => 'La sesión expiró. Recarga la página e inténtalo nuevamente.']);
    }
}

function requireUser(bool $adminOnly = false): array
{
    if (!isset($_SESSION['user_id'])) {
        respond(401, ['error' => 'Inicia sesión para continuar.']);
    }
    requireCsrf();

    $statement = database()->prepare('SELECT id, username, email, role, email_verified FROM users WHERE id = ?');
    $statement->execute([$_SESSION['user_id']]);
    $user = $statement->fetch();
    if (!$user || !(bool)$user['email_verified']) {
        $_SESSION = [];
        session_destroy();
        respond(401, ['error' => 'La sesión no es válida. Inicia sesión nuevamente.']);
    }
    if ($adminOnly && $user['role'] !== 'admin') {
        respond(403, ['error' => 'No tienes permiso para realizar esta acción.']);
    }
    return $user;
}

function sendMail(string $recipient, string $recipientName, string $subject, string $html, string $text, ?array $attachment = null): void
{
    global $config;
    $host = $config['mail']['host'] ?? '';
    $username = $config['mail']['username'] ?? '';
    $password = $config['mail']['password'] ?? '';
    $fromAddress = $config['mail']['from_address'] ?? '';
    $fromName = $config['mail']['from_name'] ?? 'Confort Market';
    $port = (int)($config['mail']['port'] ?? 587);
    if (!$host || !$username || !$password || !$fromAddress || str_contains($password, 'REPLACE_WITH_') || str_contains($username, 'your-store@')) {
        error_log('Confort Market API: falta configurar SMTP.');
        respond(503, ['error' => 'El correo no está configurado. Contacta al administrador.']);
    }

    try {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = $host;
        $mail->SMTPAuth = true;
        $mail->Username = $username;
        $mail->Password = $password;
        $mail->Port = $port;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->CharSet = 'UTF-8';
        $mail->setFrom($fromAddress, $fromName);
        $mail->addAddress($recipient, $recipientName);
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $html;
        $mail->AltBody = $text;
        if ($attachment) {
            $mail->addStringAttachment($attachment['content'], $attachment['name'], PHPMailer::ENCODING_BASE64, 'application/pdf');
        }
        $mail->send();
    } catch (MailException $exception) {
        error_log('Confort Market API mail delivery failed: ' . $exception->getMessage());
        respond(502, ['error' => 'No se pudo enviar el correo. Intenta nuevamente más tarde.']);
    }
}

function createOtp(PDO $pdo, int $userId, string $email, string $username, string $purpose): void
{
    $statement = $pdo->prepare('SELECT otp_sent_at FROM users WHERE id = ?');
    $statement->execute([$userId]);
    $lastSent = $statement->fetchColumn();
    if ($lastSent && strtotime((string)$lastSent) > time() - 60) {
        respond(429, ['error' => 'Espera un minuto antes de solicitar otro código.']);
    }

    $code = (string)random_int(100000, 999999);
    $update = $pdo->prepare(
        'UPDATE users SET otp_hash = ?, otp_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE), otp_sent_at = UTC_TIMESTAMP(), otp_attempts = 0, otp_purpose = ? WHERE id = ?'
    );
    $update->execute([password_hash($code, PASSWORD_DEFAULT), $purpose, $userId]);

    $safeName = htmlspecialchars($username, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeCode = htmlspecialchars($code, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    sendMail(
        $email,
        $username,
        'Tu código de acceso a Confort Market',
        "<div style=\"font-family:Arial,sans-serif;color:#222;max-width:560px;margin:auto\"><h2>Verifica tu inicio de sesión</h2><p>Hola {$safeName}, usa este código para continuar:</p><p style=\"font-size:32px;font-weight:bold;letter-spacing:8px;color:#aa7c11\">{$safeCode}</p><p>El código vence en 10 minutos. Si no solicitaste este acceso, ignora este mensaje.</p></div>",
        "Hola {$username}. Tu código de acceso es {$code}. Vence en 10 minutos."
    );
}

function publicUser(array $user): array
{
    return [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'email' => $user['email'],
        'role' => $user['role'] === 'admin' ? 'admin' : 'cliente'
    ];
}

function orderResponse(PDO $pdo, array $order): array
{
    $itemsQuery = $pdo->prepare(
        'SELECT product_id AS id, product_name AS name, unit_price AS price, quantity, line_total AS lineTotal FROM order_items WHERE order_id = ? ORDER BY id'
    );
    $itemsQuery->execute([$order['id']]);
    return [
        'id' => $order['public_id'],
        'date' => gmdate('c', strtotime($order['created_at'] . ' UTC')),
        'customerName' => $order['customer_name'],
        'customerEmail' => $order['customer_email'],
        'userName' => $order['account_username'] ?? $order['customer_name'],
        'userEmail' => $order['account_email'] ?? $order['customer_email'],
        'shippingPhone' => $order['shipping_phone'],
        'shippingAddress' => $order['shipping_address'],
        'subtotal' => (float)$order['subtotal'],
        'discount' => (float)$order['discount'],
        'couponCode' => $order['coupon_code'],
        'tax' => (float)$order['tax'],
        'total' => (float)$order['total'],
        'status' => $order['status'],
        'items' => array_map(static function (array $item): array {
            return [
                'id' => $item['id'] === null ? null : (int)$item['id'],
                'name' => $item['name'],
                'price' => (float)$item['price'],
                'quantity' => (int)$item['quantity'],
                'lineTotal' => (float)$item['lineTotal']
            ];
        }, $itemsQuery->fetchAll())
    ];
}

function escapeHtml(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function enforceRequestLimit(PDO $pdo, string $action, int $maximum, int $windowSeconds): void
{
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $bucket = hash('sha256', $action . '|' . $ip);
    $statement = $pdo->prepare('SELECT attempts, window_started_at FROM api_rate_limits WHERE bucket_hash = ?');
    $statement->execute([$bucket]);
    $record = $statement->fetch();
    $windowIsCurrent = $record && strtotime($record['window_started_at'] . ' UTC') > time() - $windowSeconds;
    if ($windowIsCurrent && (int)$record['attempts'] >= $maximum) {
        respond(429, ['error' => 'Se alcanzó el límite de solicitudes. Intenta más tarde.']);
    }
    $attempts = $windowIsCurrent ? (int)$record['attempts'] + 1 : 1;
    $save = $pdo->prepare(
        'INSERT INTO api_rate_limits (bucket_hash, attempts, window_started_at) VALUES (?, ?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempts = VALUES(attempts), window_started_at = VALUES(window_started_at)'
    );
    $save->execute([$bucket, $attempts]);
    $pdo->exec('DELETE FROM api_rate_limits WHERE window_started_at < UTC_TIMESTAMP() - INTERVAL 1 DAY');
}

assertSameOrigin();
startSecureSession();

$action = (string)($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = database();

if ($method === 'POST') {
    $data = requestData();
    if ($action === 'register') {
        enforceRequestLimit($pdo, 'register', 8, 900);
        $username = trim((string)($data['username'] ?? ''));
        $email = strtolower(trim((string)($data['email'] ?? '')));
        $password = (string)($data['password'] ?? '');
        if (mb_strlen($username) < 3 || mb_strlen($username) > 40 || preg_match('/[\x00-\x1F\x7F]/u', $username) || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8 || strlen($password) > 72) {
            respond(422, ['error' => 'Revisa el nombre, correo y contraseña (8 a 72 bytes).']);
        }
        try {
            $statement = $pdo->prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
            $statement->execute([$username, $email, password_hash($password, PASSWORD_DEFAULT)]);
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23000') {
                respond(409, ['error' => 'No se pudo registrar la cuenta con esos datos.']);
            }
            error_log('Confort Market API registration failed: ' . $exception->getMessage());
            respond(500, ['error' => 'No fue posible completar el registro.']);
        }
        $userId = (int)$pdo->lastInsertId();
        unset($_SESSION['user_id'], $_SESSION['csrf_token']);
        session_regenerate_id(true);
        $_SESSION['pending_user_id'] = $userId;
        $_SESSION['pending_purpose'] = 'login';
        createOtp($pdo, $userId, $email, $username, 'login');
        respond(201, ['message' => 'Enviamos un código de verificación a tu correo.']);
    }

    if ($action === 'login') {
        $email = strtolower(trim((string)($data['email'] ?? '')));
        $password = (string)($data['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254 || strlen($password) > 72) {
            respond(401, ['error' => 'Correo o contraseña incorrectos.']);
        }
        $pdo->exec('DELETE FROM auth_login_attempts WHERE window_started_at < UTC_TIMESTAMP() - INTERVAL 1 DAY');
        $bucketHash = hash('sha256', $email . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
        $attemptQuery = $pdo->prepare('SELECT attempts, window_started_at, blocked_until FROM auth_login_attempts WHERE bucket_hash = ?');
        $attemptQuery->execute([$bucketHash]);
        $attemptRecord = $attemptQuery->fetch();
        if ($attemptRecord && $attemptRecord['blocked_until'] && strtotime($attemptRecord['blocked_until'] . ' UTC') > time()) {
            respond(429, ['error' => 'Demasiados intentos. Espera 15 minutos e inténtalo nuevamente.']);
        }
        $statement = $pdo->prepare('SELECT id, username, email, password_hash FROM users WHERE email = ?');
        $statement->execute([$email]);
        $user = $statement->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            $windowIsCurrent = $attemptRecord && strtotime($attemptRecord['window_started_at'] . ' UTC') > time() - 900;
            $attempts = $windowIsCurrent ? (int)$attemptRecord['attempts'] + 1 : 1;
            $blockedUntil = $attempts >= 10 ? gmdate('Y-m-d H:i:s', time() + 900) : null;
            $saveAttempt = $pdo->prepare(
                'INSERT INTO auth_login_attempts (bucket_hash, attempts, window_started_at, blocked_until) VALUES (?, ?, UTC_TIMESTAMP(), ?) ON DUPLICATE KEY UPDATE attempts = VALUES(attempts), window_started_at = VALUES(window_started_at), blocked_until = VALUES(blocked_until)'
            );
            $saveAttempt->execute([$bucketHash, $attempts, $blockedUntil]);
            respond(401, ['error' => 'Correo o contraseña incorrectos.']);
        }
        $pdo->prepare('DELETE FROM auth_login_attempts WHERE bucket_hash = ?')->execute([$bucketHash]);
        unset($_SESSION['user_id'], $_SESSION['csrf_token']);
        session_regenerate_id(true);
        $_SESSION['pending_user_id'] = (int)$user['id'];
        $_SESSION['pending_purpose'] = 'login';
        createOtp($pdo, (int)$user['id'], $user['email'], $user['username'], 'login');
        respond(200, ['message' => 'Enviamos un código de verificación a tu correo.']);
    }

    if ($action === 'resend-otp') {
        $userId = (int)($_SESSION['pending_user_id'] ?? 0);
        if (!$userId) {
            respond(401, ['error' => 'Solicita nuevamente el inicio de sesión.']);
        }
        $statement = $pdo->prepare('SELECT id, username, email FROM users WHERE id = ?');
        $statement->execute([$userId]);
        $user = $statement->fetch();
        if (!$user) {
            respond(401, ['error' => 'La solicitud de verificación ya no es válida.']);
        }
        createOtp($pdo, $userId, $user['email'], $user['username'], (string)($_SESSION['pending_purpose'] ?? 'login'));
        respond(200, ['message' => 'Enviamos un nuevo código a tu correo.']);
    }

    if ($action === 'request-password-reset') {
        enforceRequestLimit($pdo, 'password-reset', 5, 3600);
        $email = strtolower(trim((string)($data['email'] ?? '')));
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $statement = $pdo->prepare('SELECT id, username, email FROM users WHERE email = ? AND email_verified = 1');
            $statement->execute([$email]);
            $user = $statement->fetch();
            if ($user) {
                $_SESSION['pending_user_id'] = (int)$user['id'];
                $_SESSION['pending_purpose'] = 'reset';
                createOtp($pdo, (int)$user['id'], $user['email'], $user['username'], 'reset');
            }
        }
        respond(200, ['message' => 'Si el correo corresponde a una cuenta, recibirás instrucciones para restablecer tu contraseña.']);
    }

    if ($action === 'reset-password') {
        $userId = (int)($_SESSION['pending_user_id'] ?? 0);
        $code = trim((string)($data['code'] ?? ''));
        $password = (string)($data['password'] ?? '');
        if (!$userId || ($_SESSION['pending_purpose'] ?? '') !== 'reset' || !preg_match('/^\d{6}$/', $code) || strlen($password) < 8 || strlen($password) > 72) {
            respond(422, ['error' => 'Revisa el código y la nueva contraseña.']);
        }
        $statement = $pdo->prepare('SELECT otp_hash, otp_expires_at, otp_attempts, otp_purpose FROM users WHERE id = ?');
        $statement->execute([$userId]);
        $user = $statement->fetch();
        if (!$user || $user['otp_purpose'] !== 'reset' || !$user['otp_hash'] || !$user['otp_expires_at'] || strtotime($user['otp_expires_at'] . ' UTC') < time() || (int)$user['otp_attempts'] >= 5) {
            respond(401, ['error' => 'El código venció o ya no es válido. Solicita uno nuevo.']);
        }
        if (!password_verify($code, $user['otp_hash'])) {
            $pdo->prepare('UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id = ?')->execute([$userId]);
            respond(401, ['error' => 'El código ingresado no es correcto.']);
        }
        $pdo->prepare('UPDATE users SET password_hash = ?, otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0, otp_purpose = NULL WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $userId]);
        unset($_SESSION['pending_user_id'], $_SESSION['pending_purpose']);
        respond(200, ['message' => 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.']);
    }

    if ($action === 'verify-otp') {
        $userId = (int)($_SESSION['pending_user_id'] ?? 0);
        $code = trim((string)($data['code'] ?? ''));
        if (!$userId || ($_SESSION['pending_purpose'] ?? '') !== 'login' || !preg_match('/^\d{6}$/', $code)) {
            respond(422, ['error' => 'Ingresa el código de seis dígitos.']);
        }
        $statement = $pdo->prepare('SELECT id, username, email, role, email_verified, otp_hash, otp_expires_at, otp_attempts, otp_purpose FROM users WHERE id = ?');
        $statement->execute([$userId]);
        $user = $statement->fetch();
        if (!$user || $user['otp_purpose'] !== 'login' || !$user['otp_hash'] || !$user['otp_expires_at'] || strtotime($user['otp_expires_at'] . ' UTC') < time() || (int)$user['otp_attempts'] >= 5) {
            respond(401, ['error' => 'El código venció o ya no es válido. Solicita uno nuevo.']);
        }
        if (!password_verify($code, $user['otp_hash'])) {
            $pdo->prepare('UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id = ?')->execute([$userId]);
            respond(401, ['error' => 'El código ingresado no es correcto.']);
        }
        $pdo->prepare('UPDATE users SET email_verified = 1, otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0, otp_purpose = NULL WHERE id = ?')->execute([$userId]);
        session_regenerate_id(true);
        unset($_SESSION['pending_user_id'], $_SESSION['pending_purpose']);
        $_SESSION['user_id'] = $userId;
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        respond(200, ['user' => publicUser($user), 'csrfToken' => $_SESSION['csrf_token']]);
    }

    if ($action === 'logout') {
        requireUser();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], '', $params['secure'], $params['httponly']);
        }
        session_destroy();
        respond(200, ['message' => 'Sesión cerrada.']);
    }

    if ($action === 'create-order') {
        $user = requireUser();
        enforceRequestLimit($pdo, 'create-order-' . $user['id'], 10, 600);
        $items = $data['items'] ?? null;
        $customerName = trim((string)($data['customerName'] ?? ''));
        $phone = trim((string)($data['shippingPhone'] ?? ''));
        $address = trim((string)($data['shippingAddress'] ?? ''));
        $couponCode = strtoupper(trim((string)($data['couponCode'] ?? '')));
        if (!is_array($items) || count($items) < 1 || count($items) > 50 || mb_strlen($customerName) < 2 || mb_strlen($customerName) > 100 || mb_strlen($phone) < 7 || mb_strlen($phone) > 30 || mb_strlen($address) < 5 || mb_strlen($address) > 255) {
            respond(422, ['error' => 'Revisa los productos y los datos de envío.']);
        }

        $coupons = ['SENA2026' => 0.20, 'CONFORT10' => 0.10, 'BCPPRO' => 0.15];
        if ($couponCode !== '' && !isset($coupons[$couponCode])) {
            respond(422, ['error' => 'El cupón no es válido.']);
        }

        $pdo->beginTransaction();
        try {
            $productQuery = $pdo->prepare('SELECT id, name, price FROM products WHERE id = ?');
            $normalizedItems = [];
            $subtotal = 0.0;
            foreach ($items as $item) {
                $productId = filter_var($item['id'] ?? null, FILTER_VALIDATE_INT);
                $quantity = filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT);
                if (!$productId || !$quantity || $quantity < 1 || $quantity > 99) {
                    throw new DomainException('Uno de los productos del carrito no es válido.');
                }
                $productQuery->execute([$productId]);
                $product = $productQuery->fetch();
                if (!$product) {
                    throw new DomainException('Uno de los productos ya no está disponible.');
                }
                $price = (float)$product['price'];
                $lineTotal = round($price * $quantity, 2);
                $subtotal += $lineTotal;
                $normalizedItems[] = [
                    'id' => (int)$product['id'],
                    'name' => $product['name'],
                    'price' => $price,
                    'quantity' => $quantity,
                    'lineTotal' => $lineTotal
                ];
            }
            $subtotal = round($subtotal, 2);
            $discount = round($subtotal * ($coupons[$couponCode] ?? 0), 2);
            $tax = round(($subtotal - $discount) * 0.19, 2);
            $total = round($subtotal - $discount + $tax, 2);
            $publicId = 'ORD-' . strtoupper(bin2hex(random_bytes(4)));

            $insertOrder = $pdo->prepare(
                'INSERT INTO orders (public_id, user_id, customer_name, customer_email, shipping_phone, shipping_address, subtotal, discount, coupon_code, tax, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $insertOrder->execute([
                $publicId, $user['id'], $customerName, $user['email'], $phone, $address,
                $subtotal, $discount, $couponCode !== '' ? $couponCode : null, $tax, $total
            ]);
            $orderId = (int)$pdo->lastInsertId();
            $insertItem = $pdo->prepare(
                'INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?)'
            );
            foreach ($normalizedItems as $item) {
                $insertItem->execute([$orderId, $item['id'], $item['name'], $item['price'], $item['quantity'], $item['lineTotal']]);
            }
            $pdo->commit();
            respond(201, ['order' => [
                'id' => $publicId,
                'date' => gmdate('c'),
                'customerName' => $customerName,
                'customerEmail' => $user['email'],
                'shippingPhone' => $phone,
                'shippingAddress' => $address,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'couponCode' => $couponCode ?: null,
                'tax' => $tax,
                'total' => $total,
                'status' => 'Procesando',
                'items' => $normalizedItems
            ]]);
        } catch (DomainException $exception) {
            $pdo->rollBack();
            respond(422, ['error' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('Confort Market API order creation failed: ' . $exception->getMessage());
            respond(500, ['error' => 'No fue posible registrar el pedido.']);
        }
    }

    if ($action === 'update-order-status') {
        requireUser(true);
        $orderId = trim((string)($data['orderId'] ?? ''));
        $status = (string)($data['status'] ?? '');
        if (!preg_match('/^ORD-[A-F0-9]{8}$/', $orderId) || !in_array($status, ['Procesando', 'Enviado', 'Entregado'], true)) {
            respond(422, ['error' => 'El pedido o el estado no son válidos.']);
        }
        $statement = $pdo->prepare('UPDATE orders SET status = ? WHERE public_id = ?');
        $statement->execute([$status, $orderId]);
        if ($statement->rowCount() === 0) {
            $exists = $pdo->prepare('SELECT id FROM orders WHERE public_id = ?');
            $exists->execute([$orderId]);
            if (!$exists->fetchColumn()) {
                respond(404, ['error' => 'No se encontró el pedido.']);
            }
        }
        respond(200, ['message' => 'Estado del pedido actualizado.']);
    }

    if ($action === 'send-invoice') {
        $user = requireUser();
        $orderId = trim((string)($data['orderId'] ?? ''));
        if (!preg_match('/^ORD-[A-F0-9]{8}$/', $orderId)) {
            respond(422, ['error' => 'El número de pedido no es válido.']);
        }
        $query = 'SELECT * FROM orders WHERE public_id = ?';
        $params = [$orderId];
        if ($user['role'] !== 'admin') {
            $query .= ' AND user_id = ?';
            $params[] = $user['id'];
        }
        $statement = $pdo->prepare($query);
        $statement->execute($params);
        $order = $statement->fetch();
        if (!$order) {
            respond(404, ['error' => 'No se encontró el pedido autorizado para esta cuenta.']);
        }
        if ($order['invoice_sent_at'] && strtotime($order['invoice_sent_at'] . ' UTC') > time() - 60) {
            respond(429, ['error' => 'Espera un minuto antes de volver a enviar este resumen.']);
        }
        $invoice = orderResponse($pdo, $order);
        $rows = '';
        $textItems = [];
        foreach ($invoice['items'] as $item) {
            $name = escapeHtml($item['name']);
            $rows .= '<tr><td style="padding:10px;border-bottom:1px solid #eee">' . $name . '</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:center">' . $item['quantity'] . '</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:right">' . number_format($item['price'], 2) . '</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:right">' . number_format($item['lineTotal'], 2) . '</td></tr>';
            $textItems[] = $item['name'] . ' x' . $item['quantity'] . ' - ' . number_format($item['lineTotal'], 2);
        }
        $safeCustomer = escapeHtml($invoice['customerName']);
        $safeAddress = escapeHtml($invoice['shippingAddress']);
        $safeStatus = escapeHtml($invoice['status']);
        $invoiceContent = '<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:DejaVu Sans,Arial,sans-serif;color:#222;font-size:12px}h1{color:#aa7c11}h2{margin-bottom:6px}.meta{color:#555;line-height:1.7}.items{width:100%;border-collapse:collapse;margin-top:22px}.items th{background:#f7f4eb;text-align:left}.items th,.items td{padding:10px;border-bottom:1px solid #ddd}.number{text-align:right}.totals{width:270px;margin:18px 0 0 auto;line-height:1.8}.grand{font-size:15px;font-weight:bold;border-top:1px solid #999;padding-top:8px}.notice{margin-top:30px;padding:12px;background:#f6f6f6;color:#555;font-size:10px}</style></head><body><h1>CONFORT MARKET</h1><h2>Resumen informativo del pedido ' . escapeHtml($invoice['id']) . '</h2><p class="meta">Cliente: ' . $safeCustomer . '<br>Correo: ' . escapeHtml($invoice['customerEmail']) . '<br>Fecha: ' . escapeHtml(date('d/m/Y', strtotime($invoice['date']))) . '<br>Estado: ' . $safeStatus . '<br>Dirección de envío: ' . $safeAddress . '</p><table class="items"><thead><tr><th>Producto</th><th>Cantidad</th><th class="number">Precio unitario</th><th class="number">Total</th></tr></thead><tbody>' . $rows . '</tbody></table><div class="totals">Subtotal: ' . number_format($invoice['subtotal'], 2) . '<br>Descuento: -' . number_format($invoice['discount'], 2) . '<br>IVA: ' . number_format($invoice['tax'], 2) . '<div class="grand">Total del pedido: ' . number_format($invoice['total'], 2) . '</div></div><p class="notice">Documento informativo del pedido. No es factura electrónica ni comprobante de pago. La tienda no procesa cobros en línea.</p></body></html>';
        $html = '<div style="font-family:Arial,sans-serif;color:#222;max-width:680px;margin:auto"><h1 style="color:#aa7c11">Confort Market</h1><h2>Resumen del pedido ' . escapeHtml($invoice['id']) . '</h2><p>Hola ' . $safeCustomer . ', adjuntamos el detalle informativo de tu pedido en PDF.</p><p>Estado: ' . $safeStatus . '</p><p>Total del pedido: <strong>' . number_format($invoice['total'], 2) . '</strong></p><p style="color:#777;font-size:12px">No es factura electrónica ni comprobante de pago.</p></div>';
        $text = "Factura de pedido {$invoice['id']}\nCliente: {$invoice['customerName']}\nFecha: {$invoice['date']}\n" . implode("\n", $textItems) . "\nSubtotal: " . number_format($invoice['subtotal'], 2) . "\nDescuento: " . number_format($invoice['discount'], 2) . "\nIVA: " . number_format($invoice['tax'], 2) . "\nTotal: " . number_format($invoice['total'], 2);
        $pdf = new Dompdf(['isRemoteEnabled' => false]);
        $pdf->loadHtml($invoiceContent, 'UTF-8');
        $pdf->setPaper('A4', 'portrait');
        $pdf->render();
        sendMail(
            $invoice['customerEmail'],
            $invoice['customerName'],
            "Resumen de tu pedido {$invoice['id']}",
            $html,
            $text,
            ['content' => $pdf->output(), 'name' => "Resumen_ConfortMarket_{$invoice['id']}.pdf"]
        );
        $pdo->prepare('UPDATE orders SET invoice_sent_at = UTC_TIMESTAMP() WHERE id = ?')->execute([$order['id']]);
        respond(200, ['message' => 'Enviamos el resumen PDF al correo de tu cuenta.']);
    }

    if ($action === 'product-save') {
        requireUser(true);
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        $name = trim((string)($data['name'] ?? ''));
        $price = filter_var($data['price'] ?? null, FILTER_VALIDATE_FLOAT);
        $oldPriceInput = $data['oldPrice'] ?? null;
        $oldPrice = $oldPriceInput === null || $oldPriceInput === '' ? null : filter_var($oldPriceInput, FILTER_VALIDATE_FLOAT);
        $category = trim((string)($data['category'] ?? ''));
        $rating = filter_var($data['rating'] ?? 5, FILTER_VALIDATE_FLOAT);
        $reviews = filter_var($data['reviews'] ?? 0, FILTER_VALIDATE_INT);
        $image = trim((string)($data['image'] ?? ''));
        $badge = $data['badge'] ?? null;
        if (mb_strlen($name) < 2 || mb_strlen($name) > 150 || $price === false || $price < 0 || ($oldPriceInput !== null && $oldPriceInput !== '' && ($oldPrice === false || $oldPrice < 0)) || mb_strlen($category) < 2 || mb_strlen($category) > 80 || !filter_var($image, FILTER_VALIDATE_URL) && !preg_match('/^[a-zA-Z0-9_./-]+$/', $image) || !in_array($badge, [null, '', 'new', 'sale'], true)) {
            respond(422, ['error' => 'Revisa los datos del producto.']);
        }
        if ($id) {
            $statement = $pdo->prepare('UPDATE products SET name = ?, price = ?, old_price = ?, category = ?, rating = ?, reviews = ?, image = ?, badge = ? WHERE id = ?');
            $statement->execute([$name, $price, $oldPrice, $category, $rating ?: 5, max(0, (int)$reviews), $image, $badge ?: null, $id]);
            if (!$statement->rowCount()) {
                $exists = $pdo->prepare('SELECT id FROM products WHERE id = ?');
                $exists->execute([$id]);
                if (!$exists->fetchColumn()) {
                    respond(404, ['error' => 'No se encontró el producto.']);
                }
            }
            respond(200, ['message' => 'Producto actualizado.']);
        }
        $statement = $pdo->prepare('INSERT INTO products (name, price, old_price, category, rating, reviews, image, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $statement->execute([$name, $price, $oldPrice, $category, $rating ?: 5, max(0, (int)$reviews), $image, $badge ?: null]);
        respond(201, ['id' => (int)$pdo->lastInsertId(), 'message' => 'Producto creado.']);
    }

    if ($action === 'product-delete') {
        requireUser(true);
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) {
            respond(422, ['error' => 'El producto no es válido.']);
        }
        $statement = $pdo->prepare('DELETE FROM products WHERE id = ?');
        $statement->execute([$id]);
        if (!$statement->rowCount()) {
            respond(404, ['error' => 'No se encontró el producto.']);
        }
        respond(200, ['message' => 'Producto eliminado.']);
    }

    respond(404, ['error' => 'La acción solicitada no existe.']);
}

if ($method === 'GET' && $action === 'products') {
    $statement = $pdo->query('SELECT id, name, price, old_price AS oldPrice, category, rating, reviews, image, badge FROM products ORDER BY id');
    $products = array_map(static function (array $product): array {
        $product['id'] = (int)$product['id'];
        $product['price'] = (float)$product['price'];
        $product['oldPrice'] = $product['oldPrice'] === null ? null : (float)$product['oldPrice'];
        $product['rating'] = (float)$product['rating'];
        $product['reviews'] = (int)$product['reviews'];
        return $product;
    }, $statement->fetchAll());
    respond(200, ['products' => $products]);
}

if ($method === 'GET' && $action === 'me') {
    if (!isset($_SESSION['user_id'])) {
        respond(200, ['user' => null]);
    }
    $statement = $pdo->prepare('SELECT id, username, email, role, email_verified FROM users WHERE id = ?');
    $statement->execute([$_SESSION['user_id']]);
    $user = $statement->fetch();
    if (!$user || !(bool)$user['email_verified']) {
        respond(200, ['user' => null]);
    }
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    respond(200, ['user' => publicUser($user), 'csrfToken' => $_SESSION['csrf_token']]);
}

if ($method === 'GET' && $action === 'orders') {
    $user = requireUser();
    if ($user['role'] === 'admin') {
        $statement = $pdo->query('SELECT o.*, u.username AS account_username, u.email AS account_email FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC');
    } else {
        $statement = $pdo->prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC');
        $statement->execute([$user['id']]);
    }
    $orders = array_map(static fn(array $order): array => orderResponse($pdo, $order), $statement->fetchAll());
    respond(200, ['orders' => $orders]);
}

if ($method === 'GET' && $action === 'users') {
    requireUser(true);
    $statement = $pdo->query(
        "SELECT u.username, u.email, u.role, COUNT(o.id) AS order_count FROM users u LEFT JOIN orders o ON o.user_id = u.id GROUP BY u.id ORDER BY u.created_at DESC"
    );
    $users = array_map(static function (array $user): array {
        return [
            'username' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role'] === 'admin' ? 'admin' : 'cliente',
            'orderCount' => (int)$user['order_count']
        ];
    }, $statement->fetchAll());
    respond(200, ['users' => $users]);
}

respond(405, ['error' => 'Método no permitido.']);
