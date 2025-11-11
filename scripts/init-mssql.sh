#!/bin/bash

# Script to initialize SQL Server with Chinook database
# This script should be run after the SQL Server container is up

set -e

echo "🔄 Waiting for SQL Server to be ready..."

# Wait for SQL Server to be ready (max 60 seconds)
for i in {1..60}; do
  if docker exec db-tool-mssql /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -Q "SELECT 1" -b > /dev/null 2>&1; then
    echo "✅ SQL Server is ready!"
    break
  fi
  if [ $i -eq 60 ]; then
    echo "❌ Timeout waiting for SQL Server to be ready"
    exit 1
  fi
  sleep 1
done

echo "📦 Creating chinook database..."
docker exec db-tool-mssql /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -Q "CREATE DATABASE chinook" -b

echo "📥 Importing Chinook schema and data..."
if [ -f "./seeds/mssql/01-chinook-mssql.sql" ]; then
  docker exec -i db-tool-mssql /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -d chinook -b < ./seeds/mssql/01-chinook-mssql.sql
  echo "✅ SQL Server Chinook database initialized successfully!"
else
  echo "❌ SQL file not found: ./seeds/mssql/01-chinook-mssql.sql"
  echo "   Run 'npm run setup:demo' first to download the Chinook database files"
  exit 1
fi
