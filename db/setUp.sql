DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO users (username, email, password_hash) VALUES
    ('testuser', 'testuser@example.com', '$2b$10$TqyG9BqX7FvVepM.2Q1kduBwJ5bNlG/x.N7.z5C9Hh9f2e4jW2x1K');