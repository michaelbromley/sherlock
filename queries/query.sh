sqlcmd -S mssql.vulcan.lan,1433 -U sa -P "$(pass mssql.vulcan.lan | head -1)" -d SRP -i "JYSEP_Youth_Master_Report.sql" -o "report.csv" -s"," -W
