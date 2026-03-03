# Research Review Portal - Code Audit & Architecture Documentation

**Date:** March 3, 2026  
**Sprint:** 1 - Code Audit & Documentation  
**Status:** Complete

## Project Overview

The Research Review Portal is a WordPress plugin that facilitates multi-stage review workflows for academic submissions including conferences, publications, student projects, and grants. The system was originally a Node.js application and has been ported to WordPress.

## Plugin Structure

### Core Files

```
d:\Development\CityU-Research-Tracker\
├── research-review-portal.php     # Main plugin file
├── assets/
│   ├── portal.css                 # Frontend styling
│   └── portal.js                  # Frontend JavaScript
├── data/
│   ├── config.json               # System configuration
│   ├── reviewers.json            # Reviewer database
│   ├── submissions.json          # Submissions database
│   └── uploads/                  # File attachments by submission ID
├── includes/
│   ├── class-portal-data.php     # Data layer & business logic
│   └── class-portal-rest.php     # REST API endpoints
└── requirements.md               # Project requirements & implementation plan
```

## Architecture Analysis

### 1. Main Plugin File (`research-review-portal.php`)

**Purpose:** Plugin initialization and WordPress integration  
**Version:** 1.0.0  
**License:** MIT  

**Key Features:**
- Defines plugin constants and data directories
- Registers WordPress shortcode `[research_review_portal]`
- Enqueues CSS/JS assets with REST API configuration
- Minimal footprint - delegates logic to include files

**WordPress Integration:**
- Uses `add_shortcode()` for embedding portal in pages/posts
- Leverages `wp_enqueue_style/script()` for asset management
- Integrates with WordPress REST API via `wp_create_nonce()`

### 2. Data Layer (`class-portal-data.php`)

**Purpose:** Business logic, data validation, and JSON file management  
**Size:** 431 lines  

**Core Functionality:**

#### Data Storage
- **File-based JSON storage** (not WordPress database)
- Three main data files: submissions.json, reviewers.json, config.json
- File upload handling in `/data/uploads/{submissionId}/` structure

#### Submission Types & Workflows
```php
const WORKFLOW_STAGES = [
    'conference' => ['Initial Screening', 'Reviewer Assignment', 'Peer Review', 'Review Consolidation', 'Final Decision', 'Confirmation'],
    'publication' => ['Administrative Check', 'Reviewer Matching', 'Expert Review', 'Director Assessment', 'Final Decision', 'Tracking'],
    'student-project' => ['Advisor Matching', 'Advisor Consultation', 'Feasibility Check', 'Director Approval', 'Project Setup', 'Milestone Tracking'],
    'grant' => ['Compliance Check', 'Review Assignment', 'Multi-Criteria Review', 'Committee Meeting', 'Final Decision', 'Development Support', 'Submission Tracking']
];
```

#### ID Generation System
- **Automatic ID generation:** ARS-YYYY-001, PUB-YYYY-001, PROJ-YYYY-001, GRN-YYYY-001
- **Year-based counters** with zero-padding
- **Thread-safe implementation** using file locking

#### Validation System
- **Type-specific validation** for each submission type
- **Word count validation** for abstracts (250-500 words for conferences)
- **Field requirements** vary by submission type
- **File sanitization** with secure filename handling

#### Status Management
```php
const WITHDRAWABLE = ['Submitted - Awaiting Review', 'Submitted', 'Under Initial Review', 'Administrative Review', 'Revision Required', 'Revision Submitted'];
const PUBLIC_STATUSES = ['Accepted', 'Conditionally Accepted', 'Waitlisted', 'Confirmed for Presentation', 'Approved for Submission', 'Published'];
```

### 3. REST API Layer (`class-portal-rest.php`)

**Purpose:** WordPress REST API endpoints  
**Size:** 858 lines  
**Namespace:** `wp-json/research-portal/v1`

#### Available Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | System health check |
| POST | `/submit` | Submit new research proposal |
| GET | `/submissions` | List all submissions (filtered by email) |
| GET | `/submissions/public` | Public submissions list |
| GET | `/submissions/{id}` | Get specific submission details |
| PATCH | `/submissions/{id}` | Update submission (status, workflow) |
| POST | `/submissions/{id}/feedback` | Add reviewer feedback |
| POST | `/submissions/{id}/comments` | Add comments |
| POST | `/submissions/{id}/attachments` | Upload file attachments |
| GET | `/submissions/{id}/attachments/{filename}` | Download attachments |
| GET | `/assignment-summary` | Reviewer assignment overview |
| GET/PUT | `/config` | System configuration management |
| GET | `/reviewers` | List available reviewers |
| GET | `/reviews` | Get reviews for specific reviewer |

#### Security Implementation
- **WordPress nonce verification** for all endpoints
- **Currently open permissions** (`__return_true`) - needs authentication enhancement
- **File upload security** with filename sanitization
- **Input sanitization** using WordPress functions

### 4. Frontend Implementation (`portal.js` & `portal.css`)

**JavaScript Features:**
- **Single Page Application** behavior within WordPress
- **REST API integration** with fetch() and WordPress nonces
- **Multiple view modes:** submission, status checking, public listings
- **File upload handling** with progress feedback
- **Form validation** and error display

**CSS Design:**
- **Modern, clean design** with CSS custom properties
- **Responsive layout** with mobile considerations
- **University branding** colors (blue palette)
- **Component-based styling** with BEM-like naming

### 5. Data Structure Analysis

#### Current Reviewers (7 active)
```json
[
  {"id": "r1", "name": "Cris Ewell", "email": "cewell@cityu.edu", "submissionTypes": ["conference", "publication", "grant"]},
  {"id": "r2", "name": "George Bragg", "email": "gbragg@cityu.edu", "submissionTypes": ["conference", "publication"]},
  // ... 5 more reviewers
]
```

#### Configuration Structure
- **Stage Requirements:** Number of reviewers required per stage
- **Reviewer Pools:** Assignment of reviewers to submission types
- **Assignment Modes:** Random or managed assignment strategies
- **Cohort Management:** Support for grouping reviewers/submissions

#### Submission Data Model
- **Core Fields:** ID, type, status, timestamps, submitter info
- **Content Fields:** title, abstract, keywords, research area
- **Review Fields:** assignedReviewers, reviewStages, feedback
- **File Fields:** attachments array with metadata

## Technical Debt & Improvement Areas

### High Priority Issues

1. **Authentication & Authorization**
   - **Current State:** All REST endpoints use `__return_true` permission callback
   - **Risk:** No access control or user authentication
   - **Impact:** Security vulnerability, no user separation

2. **File Security**
   - **Current State:** Files stored in web-accessible directory
   - **Risk:** Direct file access bypassing access controls
   - **Impact:** Potential data leakage

3. **Data Persistence**
   - **Current State:** File-based JSON storage
   - **Risk:** Concurrent access issues, scalability limitations
   - **Impact:** Data corruption potential, performance issues

### Medium Priority Issues

4. **Error Handling**
   - **Current State:** Basic error responses
   - **Need:** Comprehensive error logging and user feedback

5. **Input Validation**
   - **Current State:** Custom validation in PHP
   - **Need:** Client-side validation, consistent sanitization

6. **User Interface**
   - **Current State:** Functional but basic
   - **Need:** Enhanced UX, better mobile support

### Low Priority Issues

7. **Code Organization**
   - **Current State:** Monolithic class files
   - **Need:** Better separation of concerns

8. **Performance**
   - **Current State:** File I/O for every request
   - **Need:** Caching, database migration consideration

## Existing Capabilities Assessment

### ✅ Working Features
- Multi-stage workflow engine
- File upload and attachment system  
- Reviewer assignment and feedback
- Status tracking and progression
- Public submission listings
- Email-based submission lookup

### ⚠️ Partial Implementation
- Workflow automation (manual progression required)
- Notification system (basic email)
- User management (no WordPress user integration)
- Review criteria (hardcoded templates)

### ❌ Missing Features
- Authentication and authorization
- Dashboard interfaces for different user roles
- Calendar integration and deadline management
- Advanced notification system
- Reporting and analytics
- SSO integration

## Integration Points with WordPress

### Current Integration
- **Shortcode System:** `[research_review_portal]` embeds the application
- **REST API:** Uses WordPress REST API infrastructure
- **Asset Management:** WordPress enqueue system for CSS/JS
- **Nonce Security:** WordPress nonce for AJAX security

### Requires Enhancement
- **User System:** No integration with WordPress users/roles
- **Database:** Uses custom JSON files vs. WordPress database
- **Permissions:** No role-based access control
- **Admin Interface:** No WordPress admin panel integration

## Development Environment Setup

### Prerequisites
- WordPress 5.0+
- PHP 7.4+
- Write permissions on `wp-content/plugins/research-review-portal/data/`

### Local Development
1. Clone repository to WordPress plugins directory
2. Activate plugin in WordPress admin
3. Create page with `[research_review_portal]` shortcode
4. Ensure data directory permissions (755 or 777)

### File Structure for Development
```bash
# Create necessary directories
mkdir -p data/uploads
chmod 755 data/
chmod 755 data/uploads/

# Set up version control
git init
git add .
git commit -m "Initial WordPress plugin structure"
```

## API Documentation Summary

### Submission Flow
1. **Submit** → POST `/submit` with form data
2. **Review** → PATCH `/submissions/{id}` for status updates  
3. **Feedback** → POST `/submissions/{id}/feedback` for reviewer comments
4. **Files** → POST/GET `/submissions/{id}/attachments` for file handling

### Data Flow
1. **Frontend** (portal.js) makes REST API calls
2. **REST Layer** (Portal_REST) validates and routes requests
3. **Data Layer** (Portal_Data) handles business logic and storage
4. **JSON Files** store persistent data

## Next Steps for Sprint 1

1. **Complete Enhanced User Management** ✅ Documented architecture
2. **Implement Anonymous Process Documentation** → Next task
3. **Prepare for Sprint 2** developments

## Recommendations for Phase 2+

### Security Enhancements
- Implement WordPress role-based permissions
- Move file storage outside web root
- Add comprehensive input validation
- Implement audit logging

### Performance Improvements  
- Consider WordPress database migration
- Add caching for frequently accessed data
- Implement pagination for large datasets
- Optimize file upload handling

### User Experience
- Create dedicated dashboards per user role
- Add real-time notifications
- Improve mobile responsiveness
- Implement progressive web app features

---

**Completion Status:** Code audit complete ✅  
**Next Task:** Enhanced User Management implementation  
**Documentation:** Ready for development team reference