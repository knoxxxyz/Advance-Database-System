<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDb();

if ($method === 'GET') {
    $userId = (int) (getParam('user_id') ?? 0);
    if (!$userId) {
        response(['error' => 'Missing user_id.'], 400);
    }
    try {
        $stmt = $pdo->prepare('SELECT * FROM subjects WHERE user_id = ? ORDER BY created_at DESC');
        $stmt->execute([$userId]);
        response(['subjects' => $stmt->fetchAll()]);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to load subjects.', 'details' => $ex->getMessage()], 500);
    }
}

if ($method === 'POST') {
    $data = input();
    $userId = (int) ($data['user_id'] ?? 0);
    $name = trim($data['name'] ?? '');
    $category = trim($data['category'] ?? 'General');
    $icon = trim($data['icon'] ?? '📚');
    $monthlyGoal = (float) ($data['monthly_goal'] ?? 15);

    if (!$userId || !$name) {
        response(['error' => 'user_id and name are required.'], 400);
    }
    try {
        $stmt = $pdo->prepare('INSERT INTO subjects (user_id, name, category, icon, monthly_goal) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$userId, $name, $category, $icon, $monthlyGoal]);
        $id = $pdo->lastInsertId();
        response(['id' => (int) $id, 'user_id' => $userId, 'name' => $name, 'category' => $category, 'icon' => $icon, 'monthly_goal' => $monthlyGoal, 'total_time' => 0, 'created_at' => date('Y-m-d H:i:s')], 201);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to create subject.', 'details' => $ex->getMessage()], 500);
    }
}

if ($method === 'PUT') {
    $data = input();
    $id = (int) ($data['id'] ?? 0);
    $name = trim($data['name'] ?? '');
    $category = trim($data['category'] ?? 'General');
    $icon = trim($data['icon'] ?? '📚');
    $monthlyGoal = isset($data['monthly_goal']) ? (float) $data['monthly_goal'] : null;

    if (!$id || !$name) {
        response(['error' => 'id and name are required.'], 400);
    }
    try {
        $sql = 'UPDATE subjects SET name = ?, category = ?, icon = ?';
        $params = [$name, $category, $icon];
        if ($monthlyGoal !== null) {
            $sql .= ', monthly_goal = ?';
            $params[] = $monthlyGoal;
        }
        $sql .= ' WHERE id = ?';
        $params[] = $id;
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        response(['success' => true]);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to update subject.', 'details' => $ex->getMessage()], 500);
    }
}

if ($method === 'DELETE') {
    $data = input();
    $id = (int) ($data['id'] ?? 0);
    if (!$id) {
        response(['error' => 'Missing id.'], 400);
    }
    try {
        $stmt = $pdo->prepare('DELETE FROM subjects WHERE id = ?');
        $stmt->execute([$id]);
        response(['success' => true]);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to delete subject.', 'details' => $ex->getMessage()], 500);
    }
}

response(['error' => 'Method not allowed.'], 405);
