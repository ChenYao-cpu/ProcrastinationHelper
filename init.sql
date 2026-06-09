-- 拖延症拆解助手 — 数据库初始化脚本
-- 适用于 MySQL 8.0+

CREATE DATABASE IF NOT EXISTS procrastination_helper
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE procrastination_helper;

CREATE TABLE IF NOT EXISTS tasks (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    time        INT DEFAULT 30,
    priority    INT DEFAULT 1,
    category    VARCHAR(50) DEFAULT 'other',
    deadline    DATE NULL,
    completed   TINYINT(1) DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建索引以加快查询
CREATE INDEX IF NOT EXISTS idx_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_deadline ON tasks(deadline);
