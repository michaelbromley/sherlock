-- =====================================================
-- Business Intelligence Queries and Views
-- For Bahá'í Community Educational Program Management
-- =====================================================

SET search_path TO bahai_community;

-- =====================================================
-- 1. WHAT BOOKS HAS A PERSON TAKEN OR IS TAKING?
-- =====================================================

-- View: Person's complete study circle history
CREATE OR REPLACE VIEW person_study_circle_history AS
SELECT
    p.id as person_id,
    p.bahai_id,
    p.first_names || ' ' || p.family_name as full_name,
    pr.program_code,
    pr.program_name,
    pr.sequence_number as book_number,
    ppr.status_type,
    ppr.role_type,
    ppr.start_date,
    ppr.end_date,
    CASE
        WHEN ppr.status_type = 'current' THEN 'Currently ' ||
            CASE ppr.role_type
                WHEN 'participant' THEN 'Taking'
                WHEN 'tutor' THEN 'Tutoring'
            END
        WHEN ppr.status_type = 'previous' THEN 'Completed'
    END as status_description
FROM persons p
JOIN person_program_roles ppr ON p.id = ppr.person_id
JOIN programs pr ON ppr.program_id = pr.id
WHERE pr.program_type = 'study_circle'
ORDER BY p.family_name, p.first_names, pr.sequence_number;

-- Function: Get a specific person's book progress
CREATE OR REPLACE FUNCTION get_person_book_progress(p_bahai_id VARCHAR)
RETURNS TABLE(
    book_number INTEGER,
    book_name VARCHAR,
    status VARCHAR,
    role VARCHAR,
    start_date DATE,
    end_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pr.sequence_number,
        pr.program_name,
        ppr.status_type::VARCHAR,
        ppr.role_type::VARCHAR,
        ppr.start_date,
        ppr.end_date
    FROM persons p
    JOIN person_program_roles ppr ON p.id = ppr.person_id
    JOIN programs pr ON ppr.program_id = pr.id
    WHERE p.bahai_id = p_bahai_id
      AND pr.program_type = 'study_circle'
    ORDER BY pr.sequence_number, ppr.status_type DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. WHAT BOOKS HAVE THEY TUTORED?
-- =====================================================

-- View: Tutoring experience by person
CREATE OR REPLACE VIEW tutor_experience AS
SELECT
    p.id as person_id,
    p.bahai_id,
    p.first_names || ' ' || p.family_name as full_name,
    p.email,
    p.telephone,
    COUNT(DISTINCT CASE
        WHEN ppr.role_type = 'tutor' AND ppr.status_type = 'previous'
        THEN pr.id END) as books_tutored_completed,
    COUNT(DISTINCT CASE
        WHEN ppr.role_type = 'tutor' AND ppr.status_type = 'current'
        THEN pr.id END) as books_currently_tutoring,
    STRING_AGG(DISTINCT
        CASE WHEN ppr.role_type = 'tutor'
        THEN pr.program_code || ' (' || ppr.status_type || ')'
        END, ', '
        ORDER BY
        CASE WHEN ppr.role_type = 'tutor'
        THEN pr.program_code || ' (' || ppr.status_type || ')'
        END
    ) as tutoring_history
FROM persons p
LEFT JOIN person_program_roles ppr ON p.id = ppr.person_id
LEFT JOIN programs pr ON ppr.program_id = pr.id
WHERE pr.program_type = 'study_circle'
  AND p.is_archived = FALSE
GROUP BY p.id, p.bahai_id, p.first_names, p.family_name, p.email, p.telephone
HAVING COUNT(CASE WHEN ppr.role_type = 'tutor' THEN 1 END) > 0;

-- =====================================================
-- 3. WHO IS AVAILABLE TO TUTOR A NEW BOOK RIGHT NOW?
-- =====================================================

-- View: Available tutors (qualified but not currently tutoring)
CREATE OR REPLACE VIEW available_tutors AS
WITH tutor_qualifications AS (
    -- Find people who have completed Book 7 (tutor training)
    SELECT DISTINCT
        p.id,
        p.bahai_id,
        p.first_names || ' ' || p.family_name as full_name,
        p.email,
        p.telephone,
        l.location_name as locality
    FROM persons p
    JOIN person_program_roles ppr ON p.id = ppr.person_id
    JOIN programs pr ON ppr.program_id = pr.id
    LEFT JOIN locations l ON p.locality_id = l.id
    WHERE pr.program_code LIKE 'Book7%'
      AND ppr.role_type = 'participant'
      AND ppr.status_type = 'previous'  -- Completed Book 7
      AND p.is_archived = FALSE
),
current_tutoring_load AS (
    -- Count current tutoring commitments
    SELECT
        person_id,
        COUNT(*) as current_classes
    FROM person_program_roles ppr
    JOIN programs pr ON ppr.program_id = pr.id
    WHERE ppr.role_type = 'tutor'
      AND ppr.status_type = 'current'
      AND pr.program_type = 'study_circle'
    GROUP BY person_id
)
SELECT
    tq.*,
    COALESCE(ctl.current_classes, 0) as current_tutoring_load,
    CASE
        WHEN COALESCE(ctl.current_classes, 0) = 0 THEN 'Fully Available'
        WHEN COALESCE(ctl.current_classes, 0) = 1 THEN 'Limited Availability'
        ELSE 'Busy'
    END as availability_status
FROM tutor_qualifications tq
LEFT JOIN current_tutoring_load ctl ON tq.id = ctl.person_id
ORDER BY COALESCE(ctl.current_classes, 0), tq.full_name;

-- =====================================================
-- 4. WHO MIGHT BE ENROLLED IN TOO MANY BOOKS?
-- =====================================================

-- View: Overcommitted participants
CREATE OR REPLACE VIEW overcommitted_participants AS
WITH current_enrollments AS (
    SELECT
        p.id,
        p.bahai_id,
        p.first_names || ' ' || p.family_name as full_name,
        p.email,
        COUNT(DISTINCT pr.id) as concurrent_books,
        STRING_AGG(pr.program_code, ', ' ORDER BY pr.sequence_number) as enrolled_books,
        MIN(ppr.start_date) as earliest_start,
        MAX(pr.sequence_number) - MIN(pr.sequence_number) + 1 as book_span
    FROM persons p
    JOIN person_program_roles ppr ON p.id = ppr.person_id
    JOIN programs pr ON ppr.program_id = pr.id
    WHERE ppr.role_type = 'participant'
      AND ppr.status_type = 'current'
      AND pr.program_type = 'study_circle'
      AND p.is_archived = FALSE
    GROUP BY p.id, p.bahai_id, p.first_names, p.family_name, p.email
)
SELECT
    *,
    CASE
        WHEN concurrent_books >= 3 THEN 'HIGH RISK - Too many concurrent books'
        WHEN concurrent_books = 2 AND book_span > 2 THEN 'MEDIUM RISK - Non-sequential books'
        WHEN concurrent_books = 2 THEN 'MODERATE - Two concurrent books'
        ELSE 'OK'
    END as risk_assessment,
    CASE
        WHEN earliest_start < CURRENT_DATE - INTERVAL '6 months'
        THEN 'Consider reviewing progress - enrolled over 6 months'
        ELSE ''
    END as time_concern
FROM current_enrollments
WHERE concurrent_books >= 2
   OR earliest_start < CURRENT_DATE - INTERVAL '6 months'
ORDER BY concurrent_books DESC, book_span DESC;

-- =====================================================
-- 5. WHO IS OUR STRONGEST AND MOST CAPABLE TUTOR?
-- =====================================================

-- View: Tutor performance metrics
CREATE OR REPLACE VIEW tutor_performance_metrics AS
WITH tutor_stats AS (
    SELECT
        p.id as person_id,
        p.bahai_id,
        p.first_names || ' ' || p.family_name as full_name,
        p.email,
        l.location_name as locality,

        -- Experience metrics
        COUNT(DISTINCT CASE
            WHEN ppr.role_type = 'tutor' AND ppr.status_type = 'previous'
            THEN pr.id END) as books_tutored_completed,

        COUNT(DISTINCT CASE
            WHEN ppr.role_type = 'tutor' AND ppr.status_type = 'current'
            THEN pr.id END) as books_currently_tutoring,

        -- Diversity of experience
        COUNT(DISTINCT pr.program_code) as unique_books_tutored,

        -- Advanced books tutored (Books 8+)
        COUNT(DISTINCT CASE
            WHEN ppr.role_type = 'tutor' AND pr.sequence_number >= 8
            THEN pr.id END) as advanced_books_tutored,

        -- Total students taught (estimated by counting relationships)
        COUNT(CASE WHEN ppr.role_type = 'tutor' THEN 1 END) as total_tutoring_relationships,

        -- Longevity (earliest tutoring date)
        MIN(CASE WHEN ppr.role_type = 'tutor' THEN ppr.start_date END) as first_tutoring_date,

        -- Consistency (months of tutoring experience)
        EXTRACT(MONTH FROM AGE(CURRENT_DATE,
            MIN(CASE WHEN ppr.role_type = 'tutor' THEN ppr.start_date END)
        )) as months_of_experience

    FROM persons p
    LEFT JOIN person_program_roles ppr ON p.id = ppr.person_id
    LEFT JOIN programs pr ON ppr.program_id = pr.id
    LEFT JOIN locations l ON p.locality_id = l.id
    WHERE pr.program_type = 'study_circle'
      AND p.is_archived = FALSE
    GROUP BY p.id, p.bahai_id, p.first_names, p.family_name, p.email, l.location_name
)
SELECT
    *,
    -- Calculate a capability score
    (
        books_tutored_completed * 3 +           -- Weight completed books heavily
        unique_books_tutored * 2 +              -- Value diversity
        advanced_books_tutored * 4 +            -- Advanced books show mastery
        LEAST(months_of_experience / 6, 10) +   -- Experience factor (capped)
        books_currently_tutoring                -- Current activity
    ) as capability_score,

    -- Categorize tutors
    CASE
        WHEN books_tutored_completed >= 5 AND advanced_books_tutored >= 2
            THEN 'Master Tutor'
        WHEN books_tutored_completed >= 3 AND months_of_experience >= 12
            THEN 'Senior Tutor'
        WHEN books_tutored_completed >= 1
            THEN 'Active Tutor'
        WHEN books_currently_tutoring > 0
            THEN 'New Tutor'
        ELSE 'Prospective Tutor'
    END as tutor_level

FROM tutor_stats
WHERE books_tutored_completed > 0 OR books_currently_tutoring > 0
ORDER BY capability_score DESC NULLS LAST;

-- =====================================================
-- 6. WHO HAS TAKEN MOST BOOKS EXCEPT BOOK 7?
-- (Ready for tutor training)
-- =====================================================

-- View: Candidates ready for Book 7 (tutor training)
CREATE OR REPLACE VIEW book7_ready_candidates AS
WITH person_book_completion AS (
    SELECT
        p.id,
        p.bahai_id,
        p.first_names || ' ' || p.family_name as full_name,
        p.email,
        p.telephone,
        l.location_name as locality,

        -- Count completed books (1-6)
        COUNT(DISTINCT CASE
            WHEN pr.sequence_number <= 6
            AND ppr.status_type = 'previous'
            AND ppr.role_type = 'participant'
            THEN pr.sequence_number END) as books_1_to_6_completed,

        -- Check if Book 7 taken
        MAX(CASE
            WHEN pr.program_code LIKE 'Book7%'
            THEN 1 ELSE 0 END) as has_taken_book7,

        -- List completed books
        STRING_AGG(DISTINCT
            CASE WHEN ppr.status_type = 'previous'
                 AND ppr.role_type = 'participant'
                 AND pr.sequence_number <= 6
            THEN 'Book ' || pr.sequence_number::TEXT END,
            ', ' ORDER BY
            CASE WHEN ppr.status_type = 'previous'
                 AND ppr.role_type = 'participant'
                 AND pr.sequence_number <= 6
            THEN 'Book ' || pr.sequence_number::TEXT END
        ) as completed_books,

        -- Check current enrollment
        MAX(CASE
            WHEN ppr.status_type = 'current'
            AND ppr.role_type = 'participant'
            THEN pr.program_code END) as currently_enrolled_in

    FROM persons p
    LEFT JOIN person_program_roles ppr ON p.id = ppr.person_id
    LEFT JOIN programs pr ON ppr.program_id = pr.id
    LEFT JOIN locations l ON p.locality_id = l.id
    WHERE pr.program_type = 'study_circle'
      AND p.is_archived = FALSE
    GROUP BY p.id, p.bahai_id, p.first_names, p.family_name,
             p.email, p.telephone, l.location_name
)
SELECT
    *,
    CASE
        WHEN books_1_to_6_completed >= 6 AND has_taken_book7 = 0
            THEN 'READY NOW - Completed all prerequisites'
        WHEN books_1_to_6_completed >= 5 AND has_taken_book7 = 0
            THEN 'NEARLY READY - One more book needed'
        WHEN books_1_to_6_completed >= 4 AND has_taken_book7 = 0
            THEN 'APPROACHING - Two more books needed'
        WHEN has_taken_book7 = 1
            THEN 'ALREADY TRAINED'
        ELSE 'NOT YET READY'
    END as readiness_status,

    CASE
        WHEN books_1_to_6_completed >= 6 THEN 100
        WHEN books_1_to_6_completed = 5 THEN 83
        WHEN books_1_to_6_completed = 4 THEN 67
        WHEN books_1_to_6_completed = 3 THEN 50
        ELSE books_1_to_6_completed * 16.67
    END as readiness_percentage

FROM person_book_completion
WHERE books_1_to_6_completed >= 4  -- Show those who are close
   OR has_taken_book7 = 1           -- Or already trained
ORDER BY
    has_taken_book7,                -- Untrained first
    books_1_to_6_completed DESC,    -- Most prepared first
    full_name;

-- =====================================================
-- DASHBOARD SUMMARY VIEWS
-- =====================================================

-- Overall program health metrics
CREATE OR REPLACE VIEW program_health_dashboard AS
SELECT
    'Total Active Participants' as metric,
    COUNT(DISTINCT person_id) as value
FROM person_program_roles
WHERE status_type = 'current'
  AND role_type = 'participant'

UNION ALL

SELECT
    'Total Active Tutors' as metric,
    COUNT(DISTINCT person_id) as value
FROM person_program_roles
WHERE status_type = 'current'
  AND role_type = 'tutor'

UNION ALL

SELECT
    'Tutors Available Now' as metric,
    COUNT(*) as value
FROM available_tutors
WHERE availability_status = 'Fully Available'

UNION ALL

SELECT
    'Overcommitted Participants' as metric,
    COUNT(*) as value
FROM overcommitted_participants
WHERE risk_assessment LIKE 'HIGH RISK%'

UNION ALL

SELECT
    'Ready for Book 7' as metric,
    COUNT(*) as value
FROM book7_ready_candidates
WHERE readiness_status = 'READY NOW - Completed all prerequisites';

-- =====================================================
-- USEFUL QUERIES FOR COMMON QUESTIONS
-- =====================================================

-- Query: Find best tutor for a specific book
PREPARE find_tutor_for_book (VARCHAR) AS
SELECT
    p.first_names || ' ' || p.family_name as full_name,
    p.email,
    p.telephone,
    'Previously tutored this book' as qualification,
    1 as priority
FROM persons p
JOIN person_program_roles ppr ON p.id = ppr.person_id
JOIN programs pr ON ppr.program_id = pr.id
WHERE pr.program_code = $1
  AND ppr.role_type = 'tutor'
  AND ppr.status_type = 'previous'
  AND p.is_archived = FALSE
  AND p.id NOT IN (  -- Not currently tutoring too many
    SELECT person_id
    FROM person_program_roles ppr2
    JOIN programs pr2 ON ppr2.program_id = pr2.id
    WHERE ppr2.role_type = 'tutor'
      AND ppr2.status_type = 'current'
      AND pr2.program_type = 'study_circle'
    GROUP BY person_id
    HAVING COUNT(*) >= 2
  )

UNION

SELECT
    full_name,
    email,
    telephone,
    'Qualified tutor (completed Book 7)' as qualification,
    2 as priority
FROM available_tutors
WHERE current_tutoring_load < 2

ORDER BY priority, full_name
LIMIT 10;

-- Usage: EXECUTE find_tutor_for_book('Book3_G1');

-- =====================================================
-- ALERTING VIEWS FOR PROGRAM COORDINATION
-- =====================================================

-- View: Participants who have been stuck in a book too long
CREATE OR REPLACE VIEW stuck_participants_alert AS
SELECT
    p.first_names || ' ' || p.family_name as full_name,
    p.email,
    pr.program_name,
    ppr.start_date,
    CURRENT_DATE - ppr.start_date as days_enrolled,
    CASE
        WHEN CURRENT_DATE - ppr.start_date > 365 THEN 'CRITICAL - Over 1 year'
        WHEN CURRENT_DATE - ppr.start_date > 180 THEN 'HIGH - Over 6 months'
        WHEN CURRENT_DATE - ppr.start_date > 90 THEN 'MEDIUM - Over 3 months'
        ELSE 'MONITOR'
    END as urgency
FROM persons p
JOIN person_program_roles ppr ON p.id = ppr.person_id
JOIN programs pr ON ppr.program_id = pr.id
WHERE ppr.role_type = 'participant'
  AND ppr.status_type = 'current'
  AND pr.program_type = 'study_circle'
  AND ppr.start_date < CURRENT_DATE - INTERVAL '90 days'
  AND p.is_archived = FALSE
ORDER BY days_enrolled DESC;

-- =====================================================
-- REPORTING FUNCTIONS
-- =====================================================

-- Function: Generate a person's complete educational transcript
CREATE OR REPLACE FUNCTION generate_transcript(p_bahai_id VARCHAR)
RETURNS TABLE(
    category VARCHAR,
    program_name VARCHAR,
    role VARCHAR,
    status VARCHAR,
    start_date DATE,
    end_date DATE,
    duration_days INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pr.program_type::VARCHAR as category,
        pr.program_name,
        ppr.role_type::VARCHAR as role,
        ppr.status_type::VARCHAR as status,
        ppr.start_date,
        ppr.end_date,
        CASE
            WHEN ppr.end_date IS NOT NULL
            THEN (ppr.end_date - ppr.start_date)::INTEGER
            WHEN ppr.start_date IS NOT NULL
            THEN (CURRENT_DATE - ppr.start_date)::INTEGER
            ELSE NULL
        END as duration_days
    FROM persons p
    JOIN person_program_roles ppr ON p.id = ppr.person_id
    JOIN programs pr ON ppr.program_id = pr.id
    WHERE p.bahai_id = p_bahai_id
    ORDER BY pr.program_type, pr.sequence_number, ppr.status_type DESC;
END;
$$ LANGUAGE plpgsql;

-- Usage: SELECT * FROM generate_transcript('13046');
