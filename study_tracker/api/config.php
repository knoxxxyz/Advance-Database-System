<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function getDb() {
    static $pdo;
    if ($pdo) {
        return $pdo;
    }

    $host = getenv('DB_HOST') ?: '127.0.0.1';
    $name = getenv('DB_NAME') ?: 'study_tracker';
    $user = getenv('DB_USER') ?: 'root';
    $pass = getenv('DB_PASS') ?: '';
    $dsn = "mysql:host={$host};dbname={$name};charset=utf8mb4";

    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        ensureAdmin($pdo);
        return $pdo;
    } catch (PDOException $ex) {
        response(['error' => 'Database connection failed.', 'details' => $ex->getMessage()], 500);
    }
}

function ensureAdmin($pdo) {
    try {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE role = ? LIMIT 1');
        $stmt->execute(['admin']);
        if (!$stmt->fetch()) {
            $password = getenv('ADMIN_PASS') ?: 'admin123';
            $email = getenv('ADMIN_EMAIL') ?: 'admin@studytracker.com';
            $name = getenv('ADMIN_NAME') ?: 'Admin';
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $insert = $pdo->prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
            $insert->execute([$name, $email, $hash, 'admin']);
        }
    } catch (PDOException $ex) {
        // ignore initialization errors if the table doesn't exist yet
    }
}

function input() {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function response($payload, $status = 200) {
    if (is_array($payload) && isset($payload['error']) && !isset($payload['message'])) {
        $payload['message'] = $payload['error'];
    }
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function getParam($key, $default = null) {
    if (isset($_GET[$key])) {
        return trim($_GET[$key]);
    }
    if (isset($_POST[$key])) {
        return trim($_POST[$key]);
    }
    return $default;
}
