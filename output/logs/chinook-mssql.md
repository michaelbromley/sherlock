2025-11-11T21:21:13.268Z

```sql
SELECT name FROM sys.tables
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-11T21:21:19.759Z

```sql
SELECT DB_NAME() as current_database
```

```json
{
  "rowCount": 1,
  "rows": [
    {
      "current_database": "Chinook"
    }
  ]
}
```

---

2025-11-11T21:21:26.718Z

```sql
SELECT name FROM sys.databases WHERE name LIKE '%chinook%'
```

```json
{
  "rowCount": 1,
  "rows": [
    {
      "name": "Chinook"
    }
  ]
}
```

---

2025-11-11T21:21:57.091Z

```sql
SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_catalog = DB_NAME()
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-11T21:22:05.286Z

```sql
SELECT name FROM sys.tables
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-11T21:22:49.753Z

```sql
SELECT t.name, s.name as schema_name FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-11T21:25:34.041Z

```sql
SELECT TOP 5 [name] FROM sys.databases WHERE database_id > 4 ORDER BY [name]
```

```json
{
  "rowCount": 1,
  "rows": [
    {
      "name": "Chinook"
    }
  ]
}
```

---

2025-11-11T21:40:23.134Z

```sql
SELECT TOP 5 [name] FROM [Artist] ORDER BY [ArtistId]
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-11T21:41:31.830Z

```sql
SELECT TOP 5 [Name] FROM [Artist] ORDER BY [ArtistId]
```

```json
{
  "rowCount": 5,
  "rows": [
    {
      "Name": "AC/DC"
    },
    {
      "Name": "Accept"
    },
    {
      "Name": "Aerosmith"
    },
    {
      "Name": "Alanis Morissette"
    },
    {
      "Name": "Alice In Chains"
    }
  ]
}
```

---

2025-11-11T21:44:13.617Z

```sql
SELECT TOP 3 [Name] FROM [Artist] ORDER BY [ArtistId]
```

```json
{
  "rowCount": 3,
  "rows": [
    {
      "Name": "AC/DC"
    },
    {
      "Name": "Accept"
    },
    {
      "Name": "Aerosmith"
    }
  ]
}
```

---

2025-11-11T21:44:14.255Z

```sql
SELECT COUNT(*) as total_tracks FROM [Track]
```

```json
{
  "rowCount": 1,
  "rows": [
    {
      "total_tracks": 3503
    }
  ]
}
```

---

