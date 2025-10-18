-- PostgreSQL Schema Design for Bahá'í Community Database
-- Designed in 3rd Normal Form (3NF)
-- Created: 2025-10-16

-- =====================================================
-- SCHEMA CREATION
-- =====================================================

CREATE SCHEMA IF NOT EXISTS bahai_community;
SET search_path TO bahai_community;

-- =====================================================
-- ENUM TYPES FOR DATA INTEGRITY
-- =====================================================

CREATE TYPE sex_type AS ENUM ('M', 'F', 'Other');
CREATE TYPE age_category_type AS ENUM ('Child', 'Junior Youth', 'Youth', 'Adult', 'Senior');
CREATE TYPE program_type AS ENUM ('childrens_class', 'junior_youth', 'study_circle');
CREATE TYPE role_type AS ENUM ('tutor', 'participant');
CREATE TYPE status_type AS ENUM ('current', 'previous');

-- =====================================================
-- LOCATION HIERARCHY TABLE
-- =====================================================
-- This table maintains the geographic hierarchy in 3NF
-- Each location only references its immediate parent

CREATE TABLE locations (
    id BIGSERIAL PRIMARY KEY,
    location_name VARCHAR(255) NOT NULL,
    location_type VARCHAR(50) NOT NULL CHECK (location_type IN (
        'focus_neighbourhood', 'locality', 'locality_unit',
        'electoral_unit', 'cluster', 'group_of_clusters',
        'subregion', 'region', 'national_community'
    )),
    parent_location_id BIGINT REFERENCES locations(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_name, location_type, parent_location_id)
);

CREATE INDEX idx_locations_parent ON locations(parent_location_id);
CREATE INDEX idx_locations_type ON locations(location_type);

-- =====================================================
-- PERSONS TABLE
-- =====================================================
-- Core person entity with only direct attributes
-- No transitive dependencies

CREATE TABLE persons (
    id BIGSERIAL PRIMARY KEY,
    bahai_id VARCHAR(50) UNIQUE,
    first_names VARCHAR(255) NOT NULL,
    family_name VARCHAR(255),
    sex sex_type,
    age_category age_category_type,
    estimated_age INTEGER CHECK (estimated_age >= 0 AND estimated_age <= 150),
    date_of_birth DATE,

    -- Registration information
    is_registered_bahai BOOLEAN DEFAULT FALSE,
    date_registered DATE,

    -- Contact information
    address TEXT,
    telephone VARCHAR(50),
    email VARCHAR(255),

    -- Administrative fields
    is_devotional_host BOOLEAN DEFAULT FALSE,
    is_conducting_hv BOOLEAN DEFAULT FALSE,
    is_participating_expansion BOOLEAN DEFAULT FALSE,

    -- Clearances
    background_check_expiry DATE,
    motor_vehicle_clearance DATE,

    -- Archive status
    is_archived BOOLEAN DEFAULT FALSE,
    archived_date DATE,

    -- Location reference (only immediate location)
    locality_id BIGINT REFERENCES locations(id),

    -- Comments and metadata
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_birth_date CHECK (date_of_birth <= CURRENT_DATE),
    CONSTRAINT check_registration CHECK (
        (is_registered_bahai = FALSE) OR
        (is_registered_bahai = TRUE AND date_registered IS NOT NULL)
    ),
    CONSTRAINT check_archive CHECK (
        (is_archived = FALSE) OR
        (is_archived = TRUE AND archived_date IS NOT NULL)
    )
);

-- Indexes for common queries
CREATE INDEX idx_persons_bahai_id ON persons(bahai_id);
CREATE INDEX idx_persons_name ON persons(family_name, first_names);
CREATE INDEX idx_persons_locality ON persons(locality_id);
CREATE INDEX idx_persons_email ON persons(email);
CREATE INDEX idx_persons_archived ON persons(is_archived);

-- =====================================================
-- PROGRAMS TABLE
-- =====================================================
-- Normalized educational programs

CREATE TABLE programs (
    id BIGSERIAL PRIMARY KEY,
    program_type program_type NOT NULL,
    program_code VARCHAR(50) NOT NULL,
    program_name VARCHAR(255) NOT NULL,
    sequence_number INTEGER,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(program_type, program_code)
);

CREATE INDEX idx_programs_type ON programs(program_type);
CREATE INDEX idx_programs_code ON programs(program_code);

-- =====================================================
-- PERSON_PROGRAM_ROLES TABLE (Junction Table)
-- =====================================================
-- Many-to-many relationship between persons and programs
-- Handles both teaching and participation roles

CREATE TABLE person_program_roles (
    id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    program_id BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    role_type role_type NOT NULL,
    status_type status_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure logical date constraints
    CONSTRAINT check_dates CHECK (
        (end_date IS NULL) OR (end_date > start_date)
    ),

    -- Ensure status matches dates
    CONSTRAINT check_status_dates CHECK (
        (status_type = 'current' AND end_date IS NULL) OR
        (status_type = 'previous' AND end_date IS NOT NULL)
    ),

    -- Prevent duplicate current roles for the same person/program/role combination
    UNIQUE(person_id, program_id, role_type, status_type)
);

-- Indexes for efficient querying
CREATE INDEX idx_person_program_person ON person_program_roles(person_id);
CREATE INDEX idx_person_program_program ON person_program_roles(program_id);
CREATE INDEX idx_person_program_role ON person_program_roles(role_type);
CREATE INDEX idx_person_program_status ON person_program_roles(status_type);
CREATE INDEX idx_person_program_dates ON person_program_roles(start_date, end_date);

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View: Current teachers by program
CREATE VIEW current_teachers AS
SELECT
    p.id as person_id,
    p.first_names,
    p.family_name,
    pr.program_name,
    pr.program_code,
    pr.program_type,
    ppr.start_date
FROM person_program_roles ppr
JOIN persons p ON ppr.person_id = p.id
JOIN programs pr ON ppr.program_id = pr.id
WHERE ppr.role_type = 'tutor'
  AND ppr.status_type = 'current'
  AND p.is_archived = FALSE;

-- View: Current participants by program
CREATE VIEW current_participants AS
SELECT
    p.id as person_id,
    p.first_names,
    p.family_name,
    pr.program_name,
    pr.program_code,
    pr.program_type,
    ppr.start_date
FROM person_program_roles ppr
JOIN persons p ON ppr.person_id = p.id
JOIN programs pr ON ppr.program_id = pr.id
WHERE ppr.role_type = 'participant'
  AND ppr.status_type = 'current'
  AND p.is_archived = FALSE;

-- View: Complete location hierarchy
CREATE VIEW location_hierarchy AS
WITH RECURSIVE location_path AS (
    -- Base case: locations without parents
    SELECT
        id,
        location_name,
        location_type,
        parent_location_id,
        location_name::TEXT as full_path,
        1 as level
    FROM locations
    WHERE parent_location_id IS NULL

    UNION ALL

    -- Recursive case
    SELECT
        l.id,
        l.location_name,
        l.location_type,
        l.parent_location_id,
        lp.full_path || ' > ' || l.location_name,
        lp.level + 1
    FROM locations l
    JOIN location_path lp ON l.parent_location_id = lp.id
)
SELECT * FROM location_path;

-- View: Person with full location details
CREATE VIEW persons_with_location AS
SELECT
    p.*,
    l.location_name as locality_name,
    lh.full_path as location_hierarchy
FROM persons p
LEFT JOIN locations l ON p.locality_id = l.id
LEFT JOIN location_hierarchy lh ON l.id = lh.id;

-- =====================================================
-- FUNCTIONS FOR DATA INTEGRITY
-- =====================================================

-- -- Function to update updated_at timestamp
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = CURRENT_TIMESTAMP;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- -- Triggers for automatic timestamp updates
-- CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_persons_updated_at BEFORE UPDATE ON persons
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_person_program_roles_updated_at BEFORE UPDATE ON person_program_roles
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA INSERTION (Programs)
-- =====================================================
-- Based on the data analysis, inserting the identified programs

-- Children's Classes (G1-G6)
INSERT INTO programs (program_type, program_code, program_name, sequence_number) VALUES
('childrens_class', 'G1', 'Grade 1', 1),
('childrens_class', 'G2', 'Grade 2', 2),
('childrens_class', 'G3', 'Grade 3', 3),
('childrens_class', 'G4', 'Grade 4', 4),
('childrens_class', 'G5', 'Grade 5', 5),
('childrens_class', 'G6', 'Grade 6', 6);

-- Junior Youth Programs
INSERT INTO programs (program_type, program_code, program_name) VALUES
('junior_youth', 'BC', 'Breezes of Confirmation'),
('junior_youth', 'WJ', 'Walking the Straight Path'),
('junior_youth', 'HO', 'Drawing on the Power of the Word'),
('junior_youth', 'GH', 'Glimmerings of Hope'),
('junior_youth', 'WS', 'Widening Circle'),
('junior_youth', 'HW', 'Human Well'),
('junior_youth', 'LE', 'Learning About Excellence'),
('junior_youth', 'DP', 'Thinking About Numbers'),
('junior_youth', 'TN', 'Observation and Insight'),
('junior_youth', 'OI', 'The Implications of the Physical'),
('junior_youth', 'HT', 'Habits and Tools'),
('junior_youth', 'MD', 'Mental Discipline'),
('junior_youth', 'SF', 'Skills for Service'),
('junior_youth', 'PH', 'Power of the Holy Spirit'),
('junior_youth', 'RL', 'Spirit of Faith');

-- Study Circles (Books)
INSERT INTO programs (program_type, program_code, program_name, sequence_number) VALUES
('study_circle', 'Book1', 'Book 1: Reflections on the Life of the Spirit', 1),
('study_circle', 'Book2', 'Book 2: Arising to Serve', 2),
('study_circle', 'Book3_G1', 'Book 3: Teaching Children''s Classes Grade 1', 3),
('study_circle', 'Book3_G2', 'Book 3: Teaching Children''s Classes Grade 2', 3),
('study_circle', 'Book3_G3', 'Book 3: Teaching Children''s Classes Grade 3', 3),
('study_circle', 'Book3_G4', 'Book 3: Teaching Children''s Classes Grade 4', 3),
('study_circle', 'Book3_G5', 'Book 3: Teaching Children''s Classes Grade 5', 3),
('study_circle', 'Book4', 'Book 4: The Twin Manifestations', 4),
('study_circle', 'Book5', 'Book 5: Releasing the Powers of Junior Youth', 5),
('study_circle', 'Book5_BR1', 'Book 5: Branch Course 1', 5),
('study_circle', 'Book5_BR2', 'Book 5: Branch Course 2', 5),
('study_circle', 'Book5_BR3', 'Book 5: Branch Course 3', 5),
('study_circle', 'Book6', 'Book 6: Teaching the Cause', 6),
('study_circle', 'Book7', 'Book 7: Walking Together on a Path of Service', 7),
('study_circle', 'Book7_BR1', 'Book 7: Branch Course 1', 7),
('study_circle', 'Book7_BR2', 'Book 7: Branch Course 2', 7),
('study_circle', 'Book8_U1', 'Book 8: The Covenant Unit 1', 8),
('study_circle', 'Book8_U2', 'Book 8: The Covenant Unit 2', 8),
('study_circle', 'Book8_U3', 'Book 8: The Covenant Unit 3', 8),
('study_circle', 'Book9_U1', 'Book 9: Gaining an Historical Perspective Unit 1', 9),
('study_circle', 'Book9_U2', 'Book 9: Gaining an Historical Perspective Unit 2', 9),
('study_circle', 'Book9_U3', 'Book 9: Gaining an Historical Perspective Unit 3', 9),
('study_circle', 'Book10_U1', 'Book 10: Building Vibrant Communities Unit 1', 10),
('study_circle', 'Book10_U2', 'Book 10: Building Vibrant Communities Unit 2', 10),
('study_circle', 'Book10_U3', 'Book 10: Building Vibrant Communities Unit 3', 10),
('study_circle', 'Book11_U1', 'Book 11: Material Means Unit 1', 11),
('study_circle', 'Book11_U2', 'Book 11: Material Means Unit 2', 11),
('study_circle', 'Book11_U3', 'Book 11: Material Means Unit 3', 11),
('study_circle', 'Book12_U1', 'Book 12: Family and Community Unit 1', 12),
('study_circle', 'Book12_U2', 'Book 12: Family and Community Unit 2', 12),
('study_circle', 'Book12_U3', 'Book 12: Family and Community Unit 3', 12),
('study_circle', 'Book13_U1', 'Book 13: Engaging in Social Action Unit 1', 13),
('study_circle', 'Book13_U2', 'Book 13: Engaging in Social Action Unit 2', 13),
('study_circle', 'Book13_U3', 'Book 13: Engaging in Social Action Unit 3', 13),
('study_circle', 'Book14_U1', 'Book 14: Participating in the Discourses of Society Unit 1', 14),
('study_circle', 'Book14_U2', 'Book 14: Participating in the Discourses of Society Unit 2', 14),
('study_circle', 'Book14_U3', 'Book 14: Participating in the Discourses of Society Unit 3', 14);

-- =====================================================
-- PERFORMANCE STATISTICS VIEWS
-- =====================================================

-- View: Program enrollment statistics
CREATE VIEW program_statistics AS
SELECT
    pr.program_type,
    pr.program_name,
    pr.program_code,
    COUNT(DISTINCT CASE WHEN ppr.role_type = 'tutor' AND ppr.status_type = 'current'
           THEN ppr.person_id END) as current_teachers,
    COUNT(DISTINCT CASE WHEN ppr.role_type = 'participant' AND ppr.status_type = 'current'
           THEN ppr.person_id END) as current_participants,
    COUNT(DISTINCT CASE WHEN ppr.role_type = 'tutor' AND ppr.status_type = 'previous'
           THEN ppr.person_id END) as previous_teachers,
    COUNT(DISTINCT CASE WHEN ppr.role_type = 'participant' AND ppr.status_type = 'previous'
           THEN ppr.person_id END) as previous_participants
FROM programs pr
LEFT JOIN person_program_roles ppr ON pr.id = ppr.program_id
GROUP BY pr.program_type, pr.program_name, pr.program_code, pr.sequence_number
ORDER BY pr.program_type, pr.sequence_number;

-- =====================================================
-- MIGRATION HELPER FUNCTION
-- =====================================================

-- -- Function to help with data migration from the original Excel structure
-- CREATE OR REPLACE FUNCTION migrate_person_program_relationship(
--     p_person_id BIGINT,
--     p_program_code VARCHAR(50),
--     p_role role_type,
--     p_is_current BOOLEAN
-- ) RETURNS VOID AS $$
-- DECLARE
--     v_program_id BIGINT;
--     v_status status_type;
-- BEGIN
--     -- Get program ID
--     SELECT id INTO v_program_id FROM programs WHERE program_code = p_program_code;

--     IF v_program_id IS NULL THEN
--         RAISE EXCEPTION 'Program code % not found', p_program_code;
--     END IF;

--     -- Determine status
--     v_status := CASE WHEN p_is_current THEN 'current'::status_type ELSE 'previous'::status_type END;

--     -- Insert relationship (ignore duplicates)
--     INSERT INTO person_program_roles (person_id, program_id, role_type, status_type)
--     VALUES (p_person_id, v_program_id, p_role, v_status)
--     ON CONFLICT (person_id, program_id, role_type, status_type) DO NOTHING;
-- END;
-- $$ LANGUAGE plpgsql;

-- =====================================================
-- GRANT PERMISSIONS (adjust as needed)
-- =====================================================

-- -- Example: Create a read-only role
-- CREATE ROLE bahai_reader;
-- GRANT USAGE ON SCHEMA bahai_community TO bahai_reader;
-- GRANT SELECT ON ALL TABLES IN SCHEMA bahai_community TO bahai_reader;
-- GRANT SELECT ON ALL SEQUENCES IN SCHEMA bahai_community TO bahai_reader;

-- -- Example: Create a data entry role
-- CREATE ROLE bahai_data_entry;
-- GRANT USAGE ON SCHEMA bahai_community TO bahai_data_entry;
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA bahai_community TO bahai_data_entry;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA bahai_community TO bahai_data_entry;

-- =====================================================
-- END OF SCHEMA DEFINITION
-- =====================================================
