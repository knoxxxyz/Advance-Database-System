<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDb();

if ($method === 'GET') {
    try {
        $stmt = $pdo->query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
        $users = $stmt->fetchAll();
        response(['users' => $users]);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to load users.', 'details' => $ex->getMessage()], 500);
    }
}

if ($method === 'DELETE') {
    $data = input();
    $id = (int) ($data['id'] ?? 0);
    if (!$id) {
        response(['error' => 'Missing user id.'], 400);
    }
    try {
        $stmt = $pdo->prepare('DELETE FROM users WHERE id = ? AND role != ?');
        $stmt->execute([$id, 'admin']);
        response(['success' => true]);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to delete user.', 'details' => $ex->getMessage()], 500);
    }
}

response(['error' => 'Method not allowed.'], 405);
