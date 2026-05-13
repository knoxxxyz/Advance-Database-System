<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    response(['error' => 'Method not allowed.'], 405);
}

$data = input();
$name = trim($data['name'] ?? '');
$email = trim($data['email'] ?? '');
$password = trim($data['password'] ?? '');

if (!$name || !$email || !$password) {
    response(['error' => 'Name, email and password are required.'], 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    response(['error' => 'Invalid email address.'], 400);
}
if (strlen($password) < 6) {
    response(['error' => 'Password must be at least 6 characters.'], 400);
}

$pdo = getDb();
try {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        response(['error' => 'A user with that email already exists.'], 409);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
    $stmt->execute([$name, $email, $hash, 'user']);

    $userId = $pdo->lastInsertId();
    response(['user' => ['id' => (int) $userId, 'name' => $name, 'email' => $email, 'role' => 'user'] ], 201);
} catch (PDOException $ex) {
    response(['error' => 'Failed to register user.', 'details' => $ex->getMessage()], 500);
}
