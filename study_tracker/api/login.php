<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    response(['error' => 'Method not allowed.'], 405);
}

$data = input();
$email = trim($data['email'] ?? '');
$password = trim($data['password'] ?? '');
$role = trim($data['role'] ?? 'user');

if (!$email || !$password || !$role) {
    response(['error' => 'Email, password and role are required.'], 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    response(['error' => 'Invalid email address.'], 400);
}

$pdo = getDb();
try {
    $stmt = $pdo->prepare('SELECT id, name, email, password, role FROM users WHERE email = ? AND role = ?');
    $stmt->execute([$email, $role]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        response(['error' => 'Invalid credentials.'], 401);
    }

    response(['user' => ['id' => (int) $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => $user['role']]]);
} catch (PDOException $ex) {
    response(['error' => 'Failed to login.', 'details' => $ex->getMessage()], 500);
}
