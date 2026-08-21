-- ============================================
-- Migration 002: Push token untuk notifikasi mobile (Expo Push Notifications)
-- Jalankan: psql -U postgres -d cloud_absen -f database/migrations/002_push_token.sql
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token VARCHAR(255);
