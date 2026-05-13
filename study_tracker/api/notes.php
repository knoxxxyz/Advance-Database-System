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
        $stmt = $pdo->prepare('SELECT n.*, sub.name as subject_name FROM study_notes n LEFT JOIN subjects sub ON n.subject_id = sub.id WHERE n.user_id = ? ORDER BY n.created_at DESC');
        $stmt->execute([$userId]);
        response(['notes' => $stmt->fetchAll()]);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to load notes.', 'details' => $ex->getMessage()], 500);
    }
}

if ($method === 'POST') {
    $data = input();
    $userId = (int) ($data['user_id'] ?? 0);
    $subjectId = (int) ($data['subject_id'] ?? 0);
    $title = trim($data['title'] ?? '');
    $content = trim($data['content'] ?? '');
    $priority = trim($data['priority'] ?? 'medium');

    if (!$userId || !$subjectId || !$title || !$content) {
        response(['error' => 'user_id, subject_id, title and content are required.'], 400);
    }
    try {
        $stmt = $pdo->prepare('INSERT INTO study_notes (user_id, subject_id, title, content, priority) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$userId, $subjectId, $title, $content, $priority]);
        $noteId = (int) $pdo->lastInsertId();
        
        // Get subject name
        $subStmt = $pdo->prepare('SELECT name FROM subjects WHERE id = ?');
        $subStmt->execute([$subjectId]);
        $subjectName = $subStmt->fetchColumn() ?: 'Unknown';
        
        response(['id' => $noteId, 'user_id' => $userId, 'subject_id' => $subjectId, 'subject_name' => $subjectName, 'title' => $title, 'content' => $content, 'priority' => $priority, 'is_archived' => false, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')], 201);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to create note.', 'details' => $ex->getMessage()], 500);
    }
}

if ($method === 'PUT') {
    $data = input();
    $id = (int) ($data['id'] ?? 0);
    $title = trim($data['title'] ?? '');
    $content = trim($data['content'] ?? '');
    $priority = trim($data['priority'] ?? 'medium');
    $isArchived = isset($data['is_archived']) ? (int) (bool) $data['is_archived'] : 0;

    if (!$id) {
        response(['error' => 'Missing id.'], 400);
    }
    try {
        $stmt = $pdo->prepare('UPDATE study_notes SET title = ?, content = ?, priority = ?, is_archived = ? WHERE id = ?');
        $stmt->execute([$title, $content, $priority, $isArchived, $id]);
        response(['success' => true]);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to update note.', 'details' => $ex->getMessage()], 500);
    }
}

if ($method === 'DELETE') {
    $data = input();
    $id = (int) ($data['id'] ?? 0);
    if (!$id) {
        response(['error' => 'Missing id.'], 400);
    }
    try {
        $stmt = $pdo->prepare('DELETE FROM study_notes WHERE id = ?');
        $stmt->execute([$id]);
        response(['success' => true]);
    } catch (PDOException $ex) {
        response(['error' => 'Failed to delete note.', 'details' => $ex->getMessage()], 500);
    }
}

response(['error' => 'Method not allowed.'], 405);
