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
        $stmt = $pdo->prepare('SELECT s.*, sub.name as subject_name FROM sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.user_id = ? ORDER BY s.session_date DESC');
        $stmt->execute([$userId]);
        response(['sessions' => $stmt->fetchAll()]);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to load sessions.', 'details' => $ex->getMessage()], 500);
    }
}

if ($method === 'POST') {
    $data = input();
    $userId = (int) ($data['user_id'] ?? 0);
    $subjectId = (int) ($data['subject_id'] ?? 0);
    $duration = (float) ($data['duration'] ?? 0);
    $notes = trim($data['notes'] ?? '');
    $sessionDate = trim($data['session_date'] ?? '');

    if (!$userId || !$subjectId || !$duration || !$sessionDate) {
        response(['error' => 'user_id, subject_id, duration and session_date are required.'], 400);
    }
    try {
        $stmt = $pdo->prepare('INSERT INTO sessions (user_id, subject_id, duration, notes, session_date) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$userId, $subjectId, $duration, $notes, $sessionDate]);
        $sessionId = (int) $pdo->lastInsertId();
        
        // Get subject name
        $subStmt = $pdo->prepare('SELECT name FROM subjects WHERE id = ?');
        $subStmt->execute([$subjectId]);
        $subjectName = $subStmt->fetchColumn() ?: 'Unknown';
        
        response(['id' => $sessionId, 'user_id' => $userId, 'subject_id' => $subjectId, 'subject_name' => $subjectName, 'duration' => $duration, 'notes' => $notes, 'session_date' => $sessionDate], 201);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to create session.', 'details' => $ex->getMessage()], 500);
    }
}

if ($method === 'PUT') {
    $data = input();
    $id = (int) ($data['id'] ?? 0);
    $duration = isset($data['duration']) ? (float) $data['duration'] : null;
    $notes = trim($data['notes'] ?? '');
    $sessionDate = trim($data['session_date'] ?? '');

    if (!$id) {
        response(['error' => 'Missing id.'], 400);
    }
    try {
        $stmt = $pdo->prepare('UPDATE sessions SET duration = ?, notes = ?, session_date = ? WHERE id = ?');
        $stmt->execute([$duration, $notes, $sessionDate, $id]);
        response(['success' => true]);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to update session.', 'details' => $ex->getMessage()], 500);
    }
}

if ($method === 'DELETE') {
    $data = input();
    $id = (int) ($data['id'] ?? 0);
    if (!$id) {
        response(['error' => 'Missing id.'], 400);
    }
    try {
        $stmt = $pdo->prepare('DELETE FROM sessions WHERE id = ?');
        $stmt->execute([$id]);
        response(['success' => true]);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to delete session.', 'details' => $ex->getMessage()], 500);
    }
}

response(['error' => 'Method not allowed.'], 405);
