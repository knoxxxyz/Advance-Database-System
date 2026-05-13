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
        $stmt = $pdo->prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC');
        $stmt->execute([$userId]);
        response(['goals' => $stmt->fetchAll()]);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to load goals.', 'details' => $ex->getMessage()], 500);
    }
}

if ($method === 'POST') {
    $data = input();
    $userId = (int) ($data['user_id'] ?? 0);
    $type = trim($data['type'] ?? '');
    $target = (float) ($data['target'] ?? 0);
    $current = (float) ($data['current'] ?? 0);
    $deadline = trim($data['deadline'] ?? null);
    $subjectId = isset($data['subject_id']) ? (int) $data['subject_id'] : null;

    if (!$userId || !$type || !$target) {
        response(['error' => 'user_id, type, and target are required.'], 400);
    }
    try {
        $stmt = $pdo->prepare('INSERT INTO goals (user_id, subject_id, type, target, current, deadline) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$userId, $subjectId ?: null, $type, $target, $current, $deadline ?: null]);
        $goalId = (int) $pdo->lastInsertId();
        response(['id' => $goalId, 'user_id' => $userId, 'subject_id' => $subjectId, 'type' => $type, 'target' => $target, 'current' => $current, 'deadline' => $deadline, 'title' => $type, 'created_at' => date('Y-m-d H:i:s')], 201);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to create goal.', 'details' => $ex->getMessage()], 500);
    }
}

if ($method === 'PUT') {
    $data = input();
    $id = (int) ($data['id'] ?? 0);
    $current = isset($data['current']) ? (float) $data['current'] : null;
    $target = isset($data['target']) ? (float) $data['target'] : null;
    $deadline = trim($data['deadline'] ?? null);
    $type = trim($data['type'] ?? '');

    if (!$id) {
        response(['error' => 'Missing id.'], 400);
    }
    try {
        $stmt = $pdo->prepare('UPDATE goals SET type = ?, target = ?, current = ?, deadline = ? WHERE id = ?');
        $stmt->execute([$type, $target, $current, $deadline ?: null, $id]);
        response(['success' => true]);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to update goal.', 'details' => $ex->getMessage()], 500);
    }
}

if ($method === 'DELETE') {
    $data = input();
    $id = (int) ($data['id'] ?? 0);
    if (!$id) {
        response(['error' => 'Missing id.'], 400);
    }
    try {
        $stmt = $pdo->prepare('DELETE FROM goals WHERE id = ?');
        $stmt->execute([$id]);
        response(['success' => true]);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to delete goal.', 'details' => $ex->getMessage()], 500);
    }
}

response(['error' => 'Method not allowed.'], 405);
