#!/usr/bin/env python3
"""
Excel to PostgreSQL SQL Generator for Bahá'í Community Data

This program reads Excel files containing denormalized Bahá'í community data
and generates normalized SQL INSERT statements for PostgreSQL.

Schema:
    - persons: Individual person records
    - locations: Hierarchical geographic data
    - programs: Program definitions (pre-populated)
    - person_program_roles: Junction table for person-program relationships

Author: Claude Code
Date: 2025-10-16
"""

import sys
import csv
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from collections import defaultdict
import logging
import argparse


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('excel_to_sql.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class Person:
    """Represents a person record."""
    bahai_id: Optional[str] = None
    first_names: Optional[str] = None
    family_name: Optional[str] = None
    sex: Optional[str] = None
    date_of_birth: Optional[date] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    location_id: Optional[int] = None
    notes: Optional[str] = None

    # Excel row number for debugging
    row_number: int = 0


@dataclass
class Location:
    """Represents a location in the hierarchy."""
    name: str
    location_type: str
    parent_location_id: Optional[int] = None
    country_code: Optional[str] = None
    location_id: Optional[int] = None

    def __hash__(self):
        """Make location hashable for set operations."""
        return hash((self.name, self.location_type, self.parent_location_id))

    def __eq__(self, other):
        """Compare locations for equality."""
        if not isinstance(other, Location):
            return False
        return (self.name == other.name and
                self.location_type == other.location_type and
                self.parent_location_id == other.parent_location_id)


@dataclass
class ProgramRole:
    """Represents a person's role in a program."""
    person_identifier: str  # Either bahai_id or a generated identifier
    bahai_id: Optional[str]  # The actual Bahá'í ID if available
    program_code: str
    role_type: str  # 'tutor' or 'participant'
    status_type: str  # 'current' or 'previous'
    start_date: date
    end_date: Optional[date] = None
    notes: Optional[str] = None


@dataclass
class Statistics:
    """Track processing statistics."""
    total_rows: int = 0
    persons_processed: int = 0
    locations_created: int = 0
    program_roles_created: int = 0
    errors: int = 0
    warnings: int = 0
    error_details: List[str] = field(default_factory=list)

    def add_error(self, message: str):
        """Add an error message."""
        self.errors += 1
        self.error_details.append(message)
        logger.error(message)

    def add_warning(self, message: str):
        """Add a warning message."""
        self.warnings += 1
        logger.warning(message)


class ExcelReader:
    """Read Excel files using only standard library (XML parsing)."""

    def __init__(self, filepath: Path):
        """Initialize reader with Excel file path."""
        self.filepath = filepath
        self.shared_strings = []
        self.rows = []

    def read(self) -> List[List[str]]:
        """Read Excel file and return rows as list of lists."""
        logger.info(f"Reading Excel file: {self.filepath}")

        try:
            with zipfile.ZipFile(self.filepath, 'r') as zip_ref:
                # Read shared strings
                try:
                    with zip_ref.open('xl/sharedStrings.xml') as f:
                        self._parse_shared_strings(f.read())
                except KeyError:
                    logger.warning("No shared strings found")

                # Read worksheet
                with zip_ref.open('xl/worksheets/sheet1.xml') as f:
                    self._parse_worksheet(f.read())

        except Exception as e:
            logger.error(f"Error reading Excel file: {e}")
            raise

        logger.info(f"Read {len(self.rows)} rows")
        return self.rows

    def _parse_shared_strings(self, xml_data: bytes):
        """Parse shared strings from Excel XML."""
        root = ET.fromstring(xml_data)
        ns = {'': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

        for si in root.findall('.//si', ns):
            t = si.find('.//t', ns)
            if t is not None and t.text:
                self.shared_strings.append(t.text)
            else:
                self.shared_strings.append('')

    def _parse_worksheet(self, xml_data: bytes):
        """Parse worksheet data from Excel XML."""
        root = ET.fromstring(xml_data)
        ns = {'': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

        for row in root.findall('.//row', ns):
            row_data = []
            cells = row.findall('.//c', ns)

            if not cells:
                continue

            # Track column positions
            last_col = 0
            for cell in cells:
                # Get cell reference (e.g., "A1")
                cell_ref = cell.get('r')
                col_num = self._col_letter_to_num(re.match(r'([A-Z]+)', cell_ref).group(1))

                # Fill in empty cells
                while last_col < col_num - 1:
                    row_data.append('')
                    last_col += 1

                # Get cell value
                cell_type = cell.get('t')
                v = cell.find('.//v', ns)

                if v is not None and v.text:
                    if cell_type == 's':  # Shared string
                        idx = int(v.text)
                        if idx < len(self.shared_strings):
                            row_data.append(self.shared_strings[idx])
                        else:
                            row_data.append('')
                    else:
                        row_data.append(v.text)
                else:
                    row_data.append('')

                last_col = col_num

            self.rows.append(row_data)

    @staticmethod
    def _col_letter_to_num(col: str) -> int:
        """Convert Excel column letter to number (A=1, Z=26, AA=27, etc.)."""
        num = 0
        for c in col:
            num = num * 26 + (ord(c.upper()) - ord('A')) + 1
        return num


class SQLGenerator:
    """Generate SQL INSERT statements from normalized data."""

    def __init__(self, output_file: Path, batch_size: int = 100):
        """Initialize SQL generator."""
        self.output_file = output_file
        self.batch_size = batch_size
        self.stats = Statistics()

        # Track generated IDs
        self.location_ids: Dict[Tuple[str, str, Optional[int]], int] = {}
        self.next_location_id = 1

    def generate(self, persons: List[Person], locations: Set[Location],
                 roles: List[ProgramRole], processor_stats: Statistics) -> Statistics:
        """Generate SQL file from processed data."""
        logger.info(f"Generating SQL to: {self.output_file}")

        # Merge statistics from processor
        self.stats.total_rows = processor_stats.total_rows
        self.stats.errors = processor_stats.errors
        self.stats.warnings = processor_stats.warnings

        with open(self.output_file, 'w', encoding='utf-8') as f:
            self._write_header(f)
            self._write_locations(f, locations)
            self._write_persons(f, persons)
            self._write_program_roles(f, roles)
            self._write_footer(f)

        logger.info(f"SQL generation complete. File: {self.output_file}")
        return self.stats

    def _write_header(self, f):
        """Write SQL file header."""
        f.write(f"""-- SQL INSERT statements for Bahá'í Community Data
-- Generated: {datetime.now().isoformat()}
-- Source: Excel import
--
-- Schema:
--   - persons: Individual records
--   - locations: Geographic hierarchy
--   - person_program_roles: Program participation
--
-- Usage: psql -d database_name -f {self.output_file.name}

BEGIN;

-- Set search path to bahai_community schema
SET search_path TO bahai_community;

-- Set client encoding
SET client_encoding = 'UTF8';

-- Create savepoint for error recovery
SAVEPOINT batch_start;

""")

    def _write_locations(self, f, locations: Set[Location]):
        """Write location INSERT statements in hierarchical order."""
        f.write("""
-- ============================================================
-- LOCATIONS (Hierarchical Geographic Data)
-- ============================================================
-- Locations are inserted in hierarchical order (parent before child)
-- to satisfy foreign key constraints.

""")

        # Sort locations by hierarchy level
        sorted_locations = self._sort_locations_by_hierarchy(list(locations))

        batch = []
        for location in sorted_locations:
            # Location ID should already be assigned during sorting
            key = (location.name, location.location_type, location.parent_location_id)
            if key in self.location_ids:
                location.location_id = self.location_ids[key]
            else:
                # This shouldn't happen if sorting works correctly, but handle it
                self.location_ids[key] = self.next_location_id
                location.location_id = self.next_location_id
                self.next_location_id += 1

            batch.append(location)

            if len(batch) >= self.batch_size:
                self._write_location_batch(f, batch)
                batch = []

        # Write remaining batch
        if batch:
            self._write_location_batch(f, batch)

        # Update the sequence to prevent conflicts with future auto-generated IDs
        if sorted_locations:
            f.write("""-- Update location ID sequence to prevent conflicts
SELECT setval('bahai_community.locations_id_seq', (SELECT MAX(id) FROM bahai_community.locations));

""")

        self.stats.locations_created = len(sorted_locations)

    def _sort_locations_by_hierarchy(self, locations: List[Location]) -> List[Location]:
        """Sort locations by hierarchy level (parents first).

        This ensures parent locations are inserted before their children,
        satisfying foreign key constraints.
        """
        if not locations:
            return []

        # First, assign temporary IDs to all locations
        temp_id_map: Dict[Tuple[str, str, Optional[int]], int] = {}
        for loc in locations:
            key = (loc.name, loc.location_type, loc.parent_location_id)
            if key not in temp_id_map:
                temp_id_map[key] = len(temp_id_map) + 1

        # Build adjacency list (parent_id -> [children])
        children: Dict[Optional[int], List[Location]] = defaultdict(list)
        for loc in locations:
            children[loc.parent_location_id].append(loc)

        # Perform breadth-first traversal starting from root (parent_id = None)
        sorted_locs = []
        visited = set()

        def bfs(parent_id: Optional[int]):
            """Breadth-first traversal to ensure parents before children."""
            queue = [parent_id]

            while queue:
                current_parent = queue.pop(0)

                for loc in children[current_parent]:
                    key = (loc.name, loc.location_type, loc.parent_location_id)

                    if key not in visited:
                        visited.add(key)
                        sorted_locs.append(loc)

                        # Get the ID this location will have
                        if key in self.location_ids:
                            child_id = self.location_ids[key]
                        else:
                            # Assign new ID
                            child_id = self.next_location_id
                            self.location_ids[key] = child_id
                            self.next_location_id += 1

                        # Add to queue to process its children
                        queue.append(child_id)

        # Start from root (NULL parent)
        bfs(None)

        logger.debug(f"Sorted {len(sorted_locs)} locations hierarchically")
        return sorted_locs

    def _write_location_batch(self, f, batch: List[Location]):
        """Write a batch of location INSERT statements."""
        if not batch:
            return

        f.write(f"-- Batch of {len(batch)} locations\n")

        for loc in batch:
            location_name = self._escape_sql_string(loc.name)
            loc_type = self._escape_sql_string(loc.location_type)
            parent_id = loc.parent_location_id if loc.parent_location_id else 'NULL'

            # Explicitly set id to ensure referential integrity with persons table
            sql = f"""INSERT INTO bahai_community.locations (id, location_name, location_type, parent_location_id)
VALUES ({loc.location_id}, '{location_name}', '{loc_type}', {parent_id})
ON CONFLICT (location_name, location_type, parent_location_id) DO UPDATE SET id = EXCLUDED.id;
"""
            f.write(sql)

        f.write("\n")

    def _write_persons(self, f, persons: List[Person]):
        """Write person INSERT statements."""
        f.write("""
-- ============================================================
-- PERSONS (Individual Records)
-- ============================================================

""")

        batch = []
        for person in persons:
            # Include ALL persons, regardless of Bahá'í ID status
            batch.append(person)

            if len(batch) >= self.batch_size:
                self._write_person_batch(f, batch)
                batch = []

        # Write remaining batch
        if batch:
            self._write_person_batch(f, batch)

        # Count ALL persons, not just those with Bahá'í IDs
        self.stats.persons_processed = len(persons)
        persons_without_bahai_id = len([p for p in persons if not p.bahai_id])
        if persons_without_bahai_id > 0:
            f.write(f"-- Note: {persons_without_bahai_id} persons without Bahá'í ID included (non-Bahá'í participants)\n\n")

    def _write_person_batch(self, f, batch: List[Person]):
        """Write a batch of person INSERT statements."""
        if not batch:
            return

        f.write(f"-- Batch of {len(batch)} persons\n")

        for person in batch:
            # Handle Bahá'í ID - it can be NULL
            if person.bahai_id:
                bahai_id = f"'{self._escape_sql_string(person.bahai_id)}'"
            else:
                bahai_id = 'NULL'

            first_names = f"'{self._escape_sql_string(person.first_names)}'" if person.first_names else 'NULL'
            family_name = f"'{self._escape_sql_string(person.family_name)}'" if person.family_name else 'NULL'
            sex = f"'{self._escape_sql_string(person.sex)}'" if person.sex else 'NULL'
            dob = f"'{person.date_of_birth}'" if person.date_of_birth else 'NULL'
            email = f"'{self._escape_sql_string(person.email)}'" if person.email else 'NULL'
            phone = f"'{self._escape_sql_string(person.phone)}'" if person.phone else 'NULL'
            address = f"'{self._escape_sql_string(person.address)}'" if person.address else 'NULL'
            postal_code = f"'{self._escape_sql_string(person.postal_code)}'" if person.postal_code else 'NULL'
            location_id = person.location_id if person.location_id else 'NULL'

            # Add row number to notes/comments for tracking purposes
            if person.notes:
                notes_text = f"{person.notes} [Excel row: {person.row_number}]"
            else:
                notes_text = f"Excel row: {person.row_number}"
            notes = f"'{self._escape_sql_string(notes_text)}'"

            # For people without Bahá'í ID, add a comment
            if not person.bahai_id:
                f.write(f"-- Person from row {person.row_number}: {person.first_names} {person.family_name} (non-Bahá'í participant)\n")

            # Build the INSERT statement
            if person.bahai_id:
                # If we have a Bahá'í ID, use it for conflict resolution
                sql = f"""INSERT INTO bahai_community.persons (bahai_id, first_names, family_name, sex, date_of_birth, email, telephone, address, locality_id, comments)
VALUES ({bahai_id}, {first_names}, {family_name}, {sex}, {dob}, {email}, {phone}, {address}, {location_id}, {notes})
ON CONFLICT (bahai_id) DO UPDATE SET
    first_names = EXCLUDED.first_names,
    family_name = EXCLUDED.family_name,
    sex = EXCLUDED.sex,
    date_of_birth = EXCLUDED.date_of_birth,
    email = EXCLUDED.email,
    telephone = EXCLUDED.telephone,
    address = EXCLUDED.address,
    locality_id = EXCLUDED.locality_id,
    comments = EXCLUDED.comments,
    updated_at = CURRENT_TIMESTAMP;
"""
            else:
                # For non-Bahá'ís, insert without conflict clause (or use name+dob as unique key)
                sql = f"""INSERT INTO bahai_community.persons (bahai_id, first_names, family_name, sex, date_of_birth, email, telephone, address, locality_id, comments)
VALUES ({bahai_id}, {first_names}, {family_name}, {sex}, {dob}, {email}, {phone}, {address}, {location_id}, {notes});
"""
            f.write(sql)

        f.write("\n")

    def _write_program_roles(self, f, roles: List[ProgramRole]):
        """Write program role INSERT statements."""
        f.write("""
-- ============================================================
-- PERSON PROGRAM ROLES (Junction Table)
-- ============================================================

""")

        batch = []
        for role in roles:
            batch.append(role)

            if len(batch) >= self.batch_size:
                self._write_role_batch(f, batch)
                batch = []

        # Write remaining batch
        if batch:
            self._write_role_batch(f, batch)

        self.stats.program_roles_created = len(roles)

    def _write_role_batch(self, f, batch: List[ProgramRole]):
        """Write a batch of program role INSERT statements."""
        if not batch:
            return

        f.write(f"-- Batch of {len(batch)} program roles\n")

        for role in batch:
            program_code = self._escape_sql_string(role.program_code)
            role_type = self._escape_sql_string(role.role_type)
            status_type = self._escape_sql_string(role.status_type)
            start_date = f"'{role.start_date}'"
            end_date = f"'{role.end_date}'" if role.end_date else 'NULL'

            # Build person lookup condition based on available identifiers
            if role.bahai_id:
                # If we have a Bahá'í ID, use it as the primary lookup
                bahai_id = self._escape_sql_string(role.bahai_id)
                person_condition = f"bahai_id = '{bahai_id}'"
            else:
                # For non-Bahá'ís, match using the row number stored in comments
                # Extract row number from person_identifier (format: "row_123")
                if role.person_identifier.startswith('row_'):
                    row_num = role.person_identifier.split('_')[1]
                    person_condition = f"comments LIKE '%Excel row: {row_num}%'"
                    f.write(f"-- Program role for non-Bahá'í participant from Excel row {row_num}\n")
                else:
                    # Shouldn't happen but handle gracefully
                    f.write(f"-- Warning: Unable to link program role for person identifier: {role.person_identifier}\n")
                    continue

            # Use a subquery to get the person_id
            sql = f"""INSERT INTO bahai_community.person_program_roles (person_id, program_id, role_type, status_type, start_date, end_date)
SELECT
    p.id,
    pr.id,
    '{role_type}'::role_type,
    '{status_type}'::status_type,
    {start_date},
    {end_date}
FROM bahai_community.persons p, bahai_community.programs pr
WHERE p.{person_condition}
  AND pr.program_code = '{program_code}'
ON CONFLICT (person_id, program_id, role_type, status_type) DO UPDATE SET
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    updated_at = CURRENT_TIMESTAMP;
"""
            f.write(sql)

        f.write("\n")

    def _write_footer(self, f):
        """Write SQL file footer with statistics."""
        f.write(f"""
-- ============================================================
-- COMMIT TRANSACTION
-- ============================================================

COMMIT;

-- ============================================================
-- STATISTICS
-- ============================================================
-- Total rows processed: {self.stats.total_rows}
-- Persons inserted: {self.stats.persons_processed}
-- Locations created: {self.stats.locations_created}
-- Program roles created: {self.stats.program_roles_created}
-- Errors: {self.stats.errors}
-- Warnings: {self.stats.warnings}
--
-- Generated: {datetime.now().isoformat()}
-- ============================================================
""")

    @staticmethod
    def _escape_sql_string(value: Optional[str]) -> str:
        """Escape SQL string to prevent injection."""
        if value is None:
            return ''
        # Replace single quotes with two single quotes (SQL standard)
        return str(value).replace("'", "''")


class DataProcessor:
    """Process Excel data and transform into normalized records."""

    # Column mappings based on winnowed.xlsx structure
    # Columns are 0-indexed
    PERSON_COLUMNS = {
        'first_names': 0,        # Col 1: First Name(s)
        'family_name': 1,        # Col 2: Family Name
        'sex': 2,                # Col 3: Sex
        'date_of_birth': 5,      # Col 6: Date of Birth
        'bahai_id': 8,           # Col 9: Bahá'í ID
        'address': 25,           # Col 26: Address
        'phone': 26,             # Col 27: Telephone
        'email': 27,             # Col 28: Email
    }

    LOCATION_COLUMNS = {
        'focus_neighbourhood': 17,   # Col 18: Focus Neighbourhood
        'locality': 18,              # Col 19: Locality
        'electoral_unit': 19,        # Col 20: Electoral Unit
        'cluster': 20,               # Col 21: Cluster
        'group_of_clusters': 21,     # Col 22: Group of Clusters
        'subregion': 22,             # Col 23: Subregion
        'region': 23,                # Col 24: Region
        'national_community': 24,    # Col 25: National Community
    }

    # Location hierarchy definition (from most specific to most general)
    # This defines the parent-child relationships
    LOCATION_HIERARCHY = [
        'national_community',    # Country level
        'region',                # State/Province
        'subregion',             # Sub-state region
        'group_of_clusters',     # Group of clusters
        'cluster',               # Cluster
        'electoral_unit',        # Electoral unit
        'locality',              # City/Town
        'focus_neighbourhood',   # Neighborhood
    ]

    def __init__(self):
        """Initialize data processor."""
        self.persons: List[Person] = []
        self.locations: Set[Location] = set()
        self.roles: List[ProgramRole] = []
        self.stats = Statistics()

        # Track location hierarchy for ID assignment
        self.location_map: Dict[Tuple[str, str, Optional[int]], int] = {}
        self.next_location_id = 1

    def process(self, rows: List[List[str]]) -> Tuple[List[Person], Set[Location], List[ProgramRole]]:
        """Process Excel rows and return normalized data."""
        logger.info(f"Processing {len(rows)} rows")

        if len(rows) < 2:
            raise ValueError("Excel file must have at least header and one data row")

        # Extract headers
        headers = rows[0]
        program_headers = self._extract_program_headers(rows, headers)

        # Process data rows
        for row_num, row in enumerate(rows[1:], start=2):
            try:
                self._process_row(row_num, row, headers, program_headers)
            except Exception as e:
                self.stats.add_error(f"Row {row_num}: {str(e)}")

        self.stats.total_rows = len(rows) - 1  # Subtract header row

        logger.info(f"Processed {self.stats.total_rows} rows")
        logger.info(f"Created {len(self.persons)} persons, {len(self.locations)} locations, {len(self.roles)} roles")

        return self.persons, self.locations, self.roles

    def _extract_program_headers(self, rows: List[List[str]], headers: List[str]) -> Dict[int, Tuple[str, str]]:
        """Extract program codes from subheader row.

        The Excel structure has:
        - Header row: Contains section headers like "Currently teaching a children's class"
          but many columns have empty headers (they're continuations of previous sections)
        - Subheader row: Contains program codes like "G1", "G2", "BC", "Book1", etc.

        We need to capture ALL columns that have program codes in the subheader,
        tracking which section header they belong to.

        Returns:
            Dict mapping column index to (program_code, header_text) tuple
        """
        program_headers = {}

        # Program data starts around column 28 (AC)
        PROGRAM_START_COL = 28

        # Get subheader row
        subheaders = rows[1] if len(rows) > 1 else []

        # Track the current section header
        current_section_header = ""

        # Scan from PROGRAM_START_COL onwards
        for i in range(PROGRAM_START_COL, len(headers)):
            header = str(headers[i]).strip() if i < len(headers) else ""
            subheader = str(subheaders[i]).strip() if i < len(subheaders) else ""
            header_lower = header.lower()

            # Check if this is a new section header (has program-related keywords)
            is_program_section = any(keyword in header_lower for keyword in [
                'teaching', 'taught', 'tutor', 'tutoring',
                'animating', 'animated', 'coordinating',
                'serving', 'served', 'participating', 'participated',
                'study circle', 'children', "children's class",
                'junior youth'
            ])

            # Update current section if we hit a new program-related header
            if header and is_program_section:
                current_section_header = header

            # If subheader has a program code, include this column
            # Program codes are typically: G1-G6, BC, WJ, HO, Book1, Book2, etc.
            if subheader and current_section_header:
                # Validate it looks like a program code (short, alphanumeric)
                # or contains "Book"
                is_valid_code = (
                    (len(subheader) <= 10 and subheader.replace(' ', '').replace('-', '').replace('_', '').isalnum()) or
                    'book' in subheader.lower()
                )

                if is_valid_code:
                    program_headers[i] = (subheader, current_section_header)
                    logger.debug(f"Column {i}: Section='{current_section_header[:40]}' Code='{subheader}'")

        logger.info(f"Found {len(program_headers)} program columns")
        return program_headers

    def _process_row(self, row_num: int, row: List[str], headers: List[str],
                     program_headers: Dict[int, Tuple[str, str]]):
        """Process a single data row."""
        # Ensure row has enough columns
        while len(row) < max(self.PERSON_COLUMNS.values()) + 1:
            row.append('')

        # Extract person data
        person = self._extract_person(row_num, row)

        # Check if we have at least a name to identify the person
        if not person.first_names and not person.family_name:
            self.stats.add_warning(f"Row {row_num}: No name found, skipping empty row")
            return

        # Generate a unique identifier for tracking (use bahai_id if available, else row number)
        person_identifier = person.bahai_id if person.bahai_id else f"row_{row_num}"

        # Note if Bahá'í ID is missing (informational only, not an error)
        if not person.bahai_id:
            logger.debug(f"Row {row_num}: Person '{person.first_names} {person.family_name}' has no Bahá'í ID (non-Bahá'í participant)")

        # Extract and process location hierarchy
        location_id = self._process_location_hierarchy(row_num, row)
        person.location_id = location_id

        self.persons.append(person)

        # Process program roles using the identifier
        self._process_program_roles(row_num, row, person_identifier, program_headers, headers)

    def _extract_person(self, row_num: int, row: List[str]) -> Person:
        """Extract person data from row."""
        person = Person(row_number=row_num)

        # Extract basic person fields
        for field, col_idx in self.PERSON_COLUMNS.items():
            if col_idx < len(row):
                value = row[col_idx].strip() if row[col_idx] else None

                if value:
                    if field == 'date_of_birth':
                        # Parse date
                        value = self._parse_date(value)
                    elif field == 'sex':
                        # Normalize sex values
                        value = self._normalize_sex(value)

                    setattr(person, field, value)

        return person

    def _process_location_hierarchy(self, row_num: int, row: List[str]) -> Optional[int]:
        """Process location hierarchy and return leaf location ID."""
        parent_id = None
        leaf_location_id = None

        for level, location_type in enumerate(self.LOCATION_HIERARCHY):
            col_idx = self.LOCATION_COLUMNS.get(location_type)

            if col_idx is None or col_idx >= len(row):
                continue

            location_name = row[col_idx].strip() if row[col_idx] else None

            if not location_name:
                continue

            # Create location object
            location = Location(
                name=location_name,
                location_type=location_type,
                parent_location_id=parent_id,
                country_code='US' if location_type == 'country' else None
            )

            # Track location for SQL generation
            self.locations.add(location)

            # Get or assign location ID
            key = (location.name, location.location_type, location.parent_location_id)
            if key not in self.location_map:
                self.location_map[key] = self.next_location_id
                parent_id = self.next_location_id
                self.next_location_id += 1
            else:
                parent_id = self.location_map[key]

            leaf_location_id = parent_id

        return leaf_location_id

    def _process_program_roles(self, row_num: int, row: List[str], person_identifier: str,
                               program_headers: Dict[int, Tuple[str, str]], headers: List[str]):
        """Process program participation from row."""
        # Get the actual Bahá'í ID if it exists
        bahai_id = row[self.PERSON_COLUMNS['bahai_id']].strip() if self.PERSON_COLUMNS['bahai_id'] < len(row) else None
        bahai_id = bahai_id if bahai_id else None
        for col_idx, (program_code, header_text) in program_headers.items():
            if col_idx >= len(row):
                continue

            value = row[col_idx].strip() if row[col_idx] else None

            if not value:
                continue

            # Determine role type and status from header text
            header_lower = header_text.lower()

            # Map header to role type
            # Note: Use 'tutor' not 'teacher' to match enum
            if 'tutor' in header_lower or 'tutoring' in header_lower:
                role_type = 'tutor'
            elif 'teaching' in header_lower or 'teacher' in header_lower:
                role_type = 'tutor'  # Teaching = tutoring in this context
            elif 'coordinating' in header_lower or 'coordinator' in header_lower:
                role_type = 'coordinator'
            elif 'serving' in header_lower:
                role_type = 'participant'  # Serving as participant
            else:
                role_type = 'participant'

            # Map header to status
            if 'currently' in header_lower or 'current' in header_lower:
                status_type = 'current'
            elif 'previously' in header_lower or 'previous' in header_lower:
                status_type = 'previous'
            else:
                status_type = 'current'  # Default

            # Normalize program code to match schema format
            normalized_code = self._normalize_program_code(program_code)

            # Generate start date (required field)
            start_date = self._generate_start_date(value, status_type)

            # Generate end date based on start_date to ensure end_date > start_date
            end_date = self._generate_end_date(start_date, status_type)

            # Create role
            role = ProgramRole(
                person_identifier=person_identifier,
                bahai_id=bahai_id,
                program_code=normalized_code,
                role_type=role_type,
                status_type=status_type,
                start_date=start_date,
                end_date=end_date,
                notes=f"Imported from Excel row {row_num}, value: {value[:50]}"
            )

            self.roles.append(role)

    @staticmethod
    def _normalize_program_code(code: str) -> str:
        """Normalize program code to match schema format.

        Schema uses:
        - 'Book1', 'Book2', ... 'Book14' (no spaces)
        - 'Book3_G1', 'Book3_G2', etc. (underscore for Book 3 grades)
        - 'Book8_U1', 'Book9_U1', etc. (underscore for units)
        - 'Book5_BR1', 'Book7_BR1', etc. (underscore for branch courses)
        - 'G1', 'G2', ... 'G6' (children's classes)
        - 'BC', 'WJ', 'HO', etc. (junior youth - already correct)

        Excel may have:
        - 'Book 1' (with space)
        - 'Book 10\n(U1)' (newline and parentheses)
        - 'Book 3\nGrade 1' (newline and Grade text)
        """
        # Remove extra whitespace and newlines
        code = code.strip().replace('\n', ' ').replace('\r', ' ')

        # Handle "Book X (UY)" format -> "BookX_UY"
        match = re.match(r'Book\s+(\d+)\s*\(?\s*U(\d+)\)?', code, re.IGNORECASE)
        if match:
            book_num, unit_num = match.groups()
            return f"Book{book_num}_U{unit_num}"

        # Handle "Book X (BRY)" format -> "BookX_BRY"
        match = re.match(r'Book\s+(\d+)\s*\(?\s*BR(\d+)\)?', code, re.IGNORECASE)
        if match:
            book_num, branch_num = match.groups()
            return f"Book{book_num}_BR{branch_num}"

        # Handle "Book 3 (GX)" format -> "Book3_GX"
        match = re.match(r'Book\s+3\s*\(?\s*G(\d+)\)?', code, re.IGNORECASE)
        if match:
            grade_num = match.group(1)
            return f"Book3_G{grade_num}"

        # Handle "Book 3 Grade X" format -> "Book3_GX" (alternative format)
        match = re.match(r'Book\s+3\s+Grade\s+(\d+)', code, re.IGNORECASE)
        if match:
            grade_num = match.group(1)
            return f"Book3_G{grade_num}"

        # Handle simple "Book X" format -> "BookX"
        match = re.match(r'Book\s+(\d+)$', code, re.IGNORECASE)
        if match:
            book_num = match.group(1)
            return f"Book{book_num}"

        # Everything else (G1-G6, BC, WJ, etc.) stays as-is
        return code

    @staticmethod
    def _parse_date(value: str) -> Optional[date]:
        """Parse date from string or Excel serial date."""
        if not value:
            return None

        value_str = str(value).strip()

        # Try to parse Excel serial date first (most common in Excel exports)
        try:
            days = float(value_str)
            # Excel serial date starts at 1899-12-30 (accounting for Excel's 1900 leap year bug)
            if days > 0:
                base_date = datetime(1899, 12, 30)
                result_date = base_date + timedelta(days=days)
                # Sanity check: date should be between 1900 and 2100
                if 1900 <= result_date.year <= 2100:
                    return result_date.date()
        except (ValueError, OverflowError, AttributeError):
            pass

        # Try common date string formats
        formats = [
            '%Y-%m-%d',
            '%m/%d/%Y',
            '%d/%m/%Y',
            '%Y/%m/%d',
            '%m-%d-%Y',
            '%d-%m-%Y',
            '%Y',  # Just year
        ]

        for fmt in formats:
            try:
                return datetime.strptime(value_str, fmt).date()
            except ValueError:
                continue

        # If it's just a year (4 digits), try to parse it
        if value_str.isdigit() and len(value_str) == 4:
            try:
                year = int(value_str)
                if 1900 <= year <= 2100:
                    return date(year, 1, 1)
            except ValueError:
                pass

        logger.warning(f"Could not parse date: {value_str}")
        return None

    @staticmethod
    def _normalize_sex(value: str) -> Optional[str]:
        """Normalize sex values to M/F."""
        if not value:
            return None

        value_lower = value.lower().strip()

        if value_lower in ('m', 'male', 'man'):
            return 'M'
        elif value_lower in ('f', 'female', 'woman'):
            return 'F'
        else:
            return value[:1].upper() if len(value) > 0 else None

    @staticmethod
    def _generate_start_date(value: str, status_type: str) -> date:
        """Generate a reasonable start date for program participation."""
        # Try to parse date from value
        parsed_date = DataProcessor._parse_date(value)
        if parsed_date:
            return parsed_date

        # Generate default based on status
        if status_type == 'current':
            # Current roles: default to 1 year ago
            return date.today().replace(year=date.today().year - 1)
        else:
            # Previous roles: default to 2 years ago
            return date.today().replace(year=date.today().year - 2)

    @staticmethod
    def _generate_end_date(start_date: date, status_type: str) -> Optional[date]:
        """Generate end date for program participation.

        Args:
            start_date: The start date of the program participation
            status_type: Either 'current' or 'previous'

        Returns:
            End date if status is 'previous', None if status is 'current'
        """
        if status_type == 'previous':
            # Previous roles: end date should be after start date
            # Calculate 6 months after start_date
            end_date = start_date + timedelta(days=180)  # Approximately 6 months

            # Ensure end_date is not in the future
            today = date.today()
            if end_date > today:
                # If calculated end date is in future, use today
                end_date = today

            # Ensure end_date is strictly after start_date (schema constraint)
            if end_date <= start_date:
                end_date = start_date + timedelta(days=1)

            return end_date
        else:
            # Current roles: no end date
            return None


def main():
    """Main entry point for the program."""
    parser = argparse.ArgumentParser(
        description='Convert Excel files to PostgreSQL SQL INSERT statements',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process single Excel file
  python excel_to_sql.py winnowed.xlsx

  # Specify output file
  python excel_to_sql.py winnowed.xlsx -o output.sql

  # Custom batch size
  python excel_to_sql.py winnowed.xlsx -b 200

  # Verbose logging
  python excel_to_sql.py winnowed.xlsx -v
        """
    )

    parser.add_argument('input_file', type=Path, help='Input Excel file')
    parser.add_argument('-o', '--output', type=Path, help='Output SQL file (default: input_file.sql)')
    parser.add_argument('-b', '--batch-size', type=int, default=100, help='Batch size for SQL inserts (default: 100)')
    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')

    args = parser.parse_args()

    # Validate input file
    if not args.input_file.exists():
        logger.error(f"Input file not found: {args.input_file}")
        sys.exit(1)

    # Set output file
    if args.output:
        output_file = args.output
    else:
        output_file = args.input_file.with_suffix('.sql')

    # Set log level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        # Read Excel file
        reader = ExcelReader(args.input_file)
        rows = reader.read()

        # Process data
        processor = DataProcessor()
        persons, locations, roles = processor.process(rows)

        # Generate SQL
        generator = SQLGenerator(output_file, args.batch_size)
        stats = generator.generate(persons, locations, roles, processor.stats)

        # Print summary
        print("\n" + "="*60)
        print("PROCESSING COMPLETE")
        print("="*60)
        print(f"Input file:  {args.input_file}")
        print(f"Output file: {output_file}")
        print(f"")
        print(f"Statistics:")
        print(f"  Total rows:      {stats.total_rows:,}")
        print(f"  Persons:         {stats.persons_processed:,}")
        print(f"  Locations:       {stats.locations_created:,}")
        print(f"  Program roles:   {stats.program_roles_created:,}")
        print(f"  Errors:          {stats.errors:,}")
        print(f"  Warnings:        {stats.warnings:,}")
        print(f"")
        print(f"Log file: excel_to_sql.log")
        print("="*60)

        if stats.errors > 0:
            print("\nErrors encountered during processing:")
            for error in stats.error_details[:10]:  # Show first 10 errors
                print(f"  - {error}")
            if len(stats.error_details) > 10:
                print(f"  ... and {len(stats.error_details) - 10} more errors")

        sys.exit(0 if stats.errors == 0 else 1)

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
