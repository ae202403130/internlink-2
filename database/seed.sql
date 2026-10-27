-- InternLink — demo data (run after schema.sql)
--
-- Demo logins (bcrypt cost 10):
--   student@wmsu.edu.ph  / student123
--   employer@wmsu.edu.ph / employer123
--   admin@wmsu.edu.ph    / admin123
--
-- Rows reference each other by email / title rather than hard-coded ids, so the
-- seed works no matter where the identity sequences currently are.

INSERT INTO users (role, email, password_hash, first_name, last_name, status) VALUES
('student',  'student@wmsu.edu.ph',  '$2b$10$vwOgShTgasd8SEQEEBZBXOabvM7WSht8eGDGW3dm3ZDiIYQSMZOei', 'Amina',  'Santos',        'active'),
('employer', 'employer@wmsu.edu.ph', '$2b$10$ZWAz7o93I9rjoWHBhojyaOfhdK.lwIw0YF1otgzY.e3PA0w3opJea', 'Career', 'Partner',       'active'),
('admin',    'admin@wmsu.edu.ph',    '$2b$10$CImWlcWPXvZQrkolg0msVuqGMNWwJqDFJ5fZZgS60Wx7Tf58XSUjq', 'System', 'Administrator', 'active');

INSERT INTO students (user_id, student_no, course, year_level, phone, address, bio, skills)
SELECT id, '2024-00001', 'BS Computer Science', '2nd Year', '09170000000', 'Zamboanga City',
       'Computer Science student interested in web development and practical internship experience.',
       'HTML, CSS, JavaScript, React, Git, MySQL'
FROM users WHERE email = 'student@wmsu.edu.ph';

INSERT INTO employers (user_id, company_name, description, location, website, approval_status)
SELECT id, 'Zamboanga Digital Labs',
       'Technology company offering practical student internship opportunities.',
       'Zamboanga City', 'https://example.com', 'approved'
FROM users WHERE email = 'employer@wmsu.edu.ph';

INSERT INTO categories (name, description) VALUES
('Computer Science',        'Software, web and computing opportunities'),
('Information Technology',  'IT support, networking and infrastructure'),
('Information Systems',     'Business systems and technology'),
('Business Administration', 'Business and operations roles'),
('Engineering',             'Engineering-related placements');

INSERT INTO jobs (employer_id, title, description, location, course, type, slots, deadline, status) VALUES
((SELECT id FROM employers WHERE company_name = 'Zamboanga Digital Labs'),
 'Frontend Development Intern', 'Assist with responsive interfaces, React components, accessibility and testing.',
 'Zamboanga City', 'Computer Science', 'Internship', 3, '2026-11-30', 'published'),
((SELECT id FROM employers WHERE company_name = 'Zamboanga Digital Labs'),
 'IT Support Trainee', 'Assist with troubleshooting, documentation and basic user support.',
 'Hybrid', 'Information Technology', 'OJT', 2, '2026-11-20', 'published'),
((SELECT id FROM employers WHERE company_name = 'Zamboanga Digital Labs'),
 'Junior UI/UX Intern', 'Create wireframes, prototypes and usability improvements.',
 'Remote', 'Computer Science', 'Internship', 2, '2026-12-05', 'pending');

INSERT INTO applications (job_id, student_id, cover_letter, status)
SELECT j.id, s.id, 'I am interested in gaining practical frontend development experience.', 'reviewing'
FROM jobs j, students s
WHERE j.title = 'Frontend Development Intern' AND s.student_no = '2024-00001';

INSERT INTO notifications (user_id, title, message)
SELECT u.id, n.title, n.message
FROM (VALUES
  ('student@wmsu.edu.ph',  'Application update',         'Your Frontend Development Intern application is under review.'),
  ('student@wmsu.edu.ph',  'New opportunity',            'A Computer Science internship is available.'),
  ('employer@wmsu.edu.ph', 'New applicant',              'A student submitted an application to your internship posting.'),
  ('admin@wmsu.edu.ph',    'Posting awaiting review',    'A new internship posting is waiting for approval.')
) AS n(email, title, message)
JOIN users u ON u.email = n.email;

INSERT INTO announcements (title, content, audience) VALUES
('Welcome to InternLink',  'Use this portal to discover internships and connect WMSU students with employers.', 'all'),
('Application Reminder',   'Complete your profile and résumé before applying.',                                 'student');
