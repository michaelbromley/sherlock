#!/bin/bash

# Script to download Chinook database SQL files
# These will be used to seed the MySQL and PostgreSQL databases

set -e

SEEDS_DIR="./seeds"
CHINOOK_REPO="https://raw.githubusercontent.com/lerocha/chinook-database/master"

echo "📦 Downloading Chinook database SQL files..."

# Create seeds directories if they don't exist
mkdir -p "$SEEDS_DIR/mysql"
mkdir -p "$SEEDS_DIR/postgres"

# Download MySQL version
echo "  → Downloading MySQL schema..."
curl -o "$SEEDS_DIR/mysql/01-chinook-mysql.sql" -L "$CHINOOK_REPO/ChinookDatabase/DataSources/Chinook_MySql.sql"

# Fix MySQL script: change Chinook to chinook (lowercase) and use IF NOT EXISTS
# Docker entrypoint creates the database, but we use IF NOT EXISTS to be safe
echo "  → Fixing MySQL script for Docker..."
sed -i.bak 's/`Chinook`/`chinook`/g; s/CREATE DATABASE `chinook`;/CREATE DATABASE IF NOT EXISTS `chinook`;/' "$SEEDS_DIR/mysql/01-chinook-mysql.sql"
rm -f "$SEEDS_DIR/mysql/01-chinook-mysql.sql.bak"

# Download PostgreSQL version
echo "  → Downloading PostgreSQL schema..."
curl -o "$SEEDS_DIR/postgres/01-chinook-postgres.sql" -L "$CHINOOK_REPO/ChinookDatabase/DataSources/Chinook_PostgreSql.sql"

# Fix PostgreSQL script: remove DROP/CREATE DATABASE commands
# Docker entrypoint already creates the database and connects to it
echo "  → Fixing PostgreSQL script for Docker..."
sed -i.bak '/DROP DATABASE IF EXISTS chinook;/d; /CREATE DATABASE chinook;/d; /\\c chinook;/d' "$SEEDS_DIR/postgres/01-chinook-postgres.sql"
rm -f "$SEEDS_DIR/postgres/01-chinook-postgres.sql.bak"

echo "✅ Chinook database files downloaded successfully!"
echo ""
echo "The following files are ready:"
echo "  - seeds/mysql/01-chinook-mysql.sql"
echo "  - seeds/postgres/01-chinook-postgres.sql"
echo ""
echo "You can now run: docker-compose up -d"
